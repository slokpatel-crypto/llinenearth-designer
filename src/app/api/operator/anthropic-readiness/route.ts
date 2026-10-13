import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig } from "@/lib/supabase-admin";
import { appendCreativeEvent } from "@/lib/designer/creative-profile-server";
import { intakeKnowledgeProposals, KNOWLEDGE_DOMAINS } from "@/lib/designer/intelligence/proposal-contract";
import { requestClaudeKnowledge, type ClaudeKnowledgeTask } from "@/lib/designer/intelligence/anthropic-client";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}
function json(data:unknown,status=200){
  return NextResponse.json(data,{
    status,headers:{"cache-control":"private, no-store, max-age=0","x-content-type-options":"nosniff"}
  });
}
function sameOrigin(request:Request){
  const origin=request.headers.get("origin");
  if(!origin) return true;
  try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}

/** Readiness is a configuration check; it makes NO paid API request. */
export async function GET(){
  if(!await authorized()) return json({error:"Operator login required."},401);
  return json({
    configured:Boolean(process.env.ANTHROPIC_API_KEY),
    persistenceConfigured:Boolean(getSupabaseAdminConfig()),
    provider:"anthropic",verifiedRequest:false,
    jobs:[...KNOWLEDGE_DOMAINS],
    warning:"Provider validity, credits and model availability are not confirmed by this check."
  });
}

/**
 * Exactly one guarded model request per task. Durable Supabase claim prevents
 * concurrent/repeated purchases on different serverless instances.
 * All model-generated claims are quarantined pending human review.
 */
export async function POST(request:NextRequest){
  if(!sameOrigin(request)) return json({error:"Cross-origin generation is forbidden."},403);
  if(!await authorized()) return json({error:"Operator login required."},401);
  if(!process.env.ANTHROPIC_API_KEY) return json({error:"Provider credential not configured."},503);
  if(!getSupabaseAdminConfig()) return json({error:"Durable ledger is not configured."},503);
  const length=Number(request.headers.get("content-length")||"0");
  if(length>1024) return json({error:"Request too large."},413);
  let input:Record<string,unknown>;
  try{
    const parsed=await request.json() as unknown;
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)) throw Error("Invalid body");
    input=parsed as Record<string,unknown>;
  }catch{return json({error:"Invalid JSON request."},400);}
  const task=input.task;
  if(typeof task!=="string"||!KNOWLEDGE_DOMAINS.includes(task as ClaudeKnowledgeTask))
    return json({error:"Unknown knowledge task."},400);
  const day=new Date().toISOString().slice(0,10);
  const runId="EV-CLAUDE-INTEL-"+day+"-"+task;
  try{
    const claim=await appendCreativeEvent("operator_note",{
      subtype:"anthropic_intelligence_job",task,status:"claimed",runId
    },{id:runId,source:"operator",session:"anthropic-intelligence"});
    if(claim.duplicate) return json({status:"already_claimed",task,runId},409);
  }catch{
    return json({error:"Cannot create durable spend claim."},503);
  }
  try{
    const output=await requestClaudeKnowledge(task as ClaudeKnowledgeTask);
    let untrusted:unknown;
    try{untrusted=JSON.parse(output.text.trim().replace(/^\x60{3}json\s*|\s*\x60{3}$/g,""));}
    catch{throw Error("Provider output was not valid JSON");}
    const intake=intakeKnowledgeProposals(untrusted);
    const saved=await appendCreativeEvent("operator_note",{
      subtype:"anthropic_intelligence_proposal",task,runId,status:"pending_human_review",
      model:output.model,usage:{inputTokens:output.inputTokens,outputTokens:output.outputTokens},
      ...intake
    },{id:runId+"-result",source:"operator",session:"anthropic-intelligence"});
    return json({status:"saved_unverified",task,runId,alreadySaved:saved.duplicate,accepted:intake.proposals.length,
      rejected:intake.rejected,usage:{inputTokens:output.inputTokens,outputTokens:output.outputTokens}});
  }catch{
    // Never echo model output, provider errors, request headers, or keys.
    return json({error:"Generation or persistence failed; claim retained to avoid duplicate billing.",task,runId},502);
  }
}
