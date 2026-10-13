import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { appendCreativeEvent } from "@/lib/designer/creative-profile-server";
import { KNOWLEDGE_DOMAINS } from "@/lib/designer/intelligence/proposal-contract";
import { archivedKnowledgeForOperator, archivedKnowledgeIndex } from "@/lib/designer/intelligence/archive";
import { auditedKnowledgeForOperator, auditedKnowledgeIndex } from "@/lib/designer/intelligence/audited-archive";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type Entry={id:string;received_at:string;payload:Record<string,unknown>};
async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}
async function readOperatorNotes(subtype:string,limit=25):Promise<Entry[]>{
  const config=getSupabaseAdminConfig();
  if(!config) throw Error("Cloud intelligence storage is unavailable");
  const params=new URLSearchParams({
    select:"id,received_at,payload",type:"eq.operator_note",source:"eq.operator",
    "payload->>subtype":"eq."+subtype,order:"received_at.desc,id.desc",limit:String(limit),
  });
  const response=await fetch(config.url+"/rest/v1/style_events?"+params,{
    headers:{...supabaseAdminHeaders(config),accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(9000)
  });
  if(!response.ok) throw Error("Could not read knowledge ledger");
  return await response.json() as Entry[];
}
function json(body:unknown,status=200){
  return NextResponse.json(body,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
}
export async function GET(){
  if(!await authorized()) return json({error:"Operator login required."},401);
  if(!getSupabaseAdminConfig()) return json({configured:false,archiveIndex:archivedKnowledgeIndex(),archive:archivedKnowledgeForOperator(),auditedIndex:auditedKnowledgeIndex(),audited:auditedKnowledgeForOperator(),proposals:[],reviews:[]});
  try{
    const [proposals,reviews]=await Promise.all([
      readOperatorNotes("anthropic_intelligence_proposal",25),
      readOperatorNotes("anthropic_knowledge_review",200)
    ]);
    return json({configured:true,archiveIndex:archivedKnowledgeIndex(),archive:archivedKnowledgeForOperator(),auditedIndex:auditedKnowledgeIndex(),audited:auditedKnowledgeForOperator(),proposals,reviews,disclaimer:"Unreviewed proposals cannot modify live tailoring or physical-fabric facts."});
  }catch{return json({error:"Knowledge review ledger unavailable."},503);}
}
export async function POST(request:Request){
  const origin=request.headers.get("origin");
  if(origin){try{if(new URL(origin).origin!==new URL(request.url).origin)return json({error:"Invalid origin"},403);}
    catch{return json({error:"Invalid origin"},403);}}
  if(!await authorized()) return json({error:"Operator login required."},401);
  if(!getSupabaseAdminConfig()) return json({error:"Cloud storage is not configured."},503);
  if(Number(request.headers.get("content-length")||0)>2500)return json({error:"Request too large"},413);
  let body:Record<string,unknown>;
  try{
    const input=await request.json() as unknown;
    if(!input||typeof input!=="object"||Array.isArray(input))throw Error("bad");
    body=input as Record<string,unknown>;
  }catch{return json({error:"Invalid JSON"},400);}
  const task=body.task,proposalId=body.proposalId,decision=body.decision;
  const signedBy=String(body.signedBy||"").trim().slice(0,100);
  const note=String(body.note||"").trim().slice(0,750);
  if(typeof task!=="string"||!KNOWLEDGE_DOMAINS.includes(task as typeof KNOWLEDGE_DOMAINS[number])
   ||typeof proposalId!=="string"||!/^[a-z][a-z0-9-]{2,89}$/.test(proposalId)
   ||!["approved_as_proposal","rejected"].includes(String(decision))
   ||signedBy.length<2||note.length<8){
    return json({error:"Valid task, proposal ID, decision, signedBy and review rationale are required."},400);
  }
  try{
    const proposals=await readOperatorNotes("anthropic_intelligence_proposal",25);
    const localMatch=[...archivedKnowledgeForOperator(),...auditedKnowledgeForOperator()].some(entry=>entry.domain===task && entry.proposals.some(p=>p.id===proposalId));
    const matching=localMatch || proposals.some(row=>row.payload.task===task&&
      Array.isArray(row.payload.proposals)&&row.payload.proposals.some((v:unknown)=>{
        const item=v as {id?:unknown}|null;
        return item?.id===proposalId;
      }));
    if(!matching)return json({error:"Proposal was not found in generated knowledge ledger."},404);
    const receipt=await appendCreativeEvent("operator_note",{
      subtype:"anthropic_knowledge_review",task,proposalId,decision,signedBy,note,
      scope:"knowledge_proposal_only",physicalFactsApproved:false,automaticRulesPromotion:false
    },{source:"operator",session:"anthropic-intelligence"});
    return json({ok:true,receipt,scope:"proposal_only"});
  }catch{return json({error:"Could not record knowledge review."},503);}
}
