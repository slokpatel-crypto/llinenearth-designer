import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import {
  normalizeNoviceDesignerAttempt,
  normalizeNoviceStudyDecision,
  summarizeNoviceDesignerStudy,
  type NoviceDesignerAttemptRow,
  type NoviceDesignerDecisionRow,
} from "@/lib/designer/novice-designer-study";

export const runtime="nodejs";

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Novice Designer study backend is not configured.");
  const response=await fetch(`${config.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    const detail=(await response.text()).replace(/\s+/g," ").slice(0,300);
    throw new Error(`Novice Designer study request failed (${response.status}): ${detail}`);
  }
  return await response.json() as T;
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) {
    return NextResponse.json({
      configured:false,attempts:[],decisions:[],
      summary:summarizeNoviceDesignerStudy([],[]),
    },{headers:{"cache-control":"private, no-store"}});
  }
  try{
    const [attempts,decisions]=await Promise.all([
      rpc<NoviceDesignerAttemptRow[]>("designer_novice_attempt_list",{p_limit:1000}),
      rpc<NoviceDesignerDecisionRow[]>("designer_novice_study_decision_list",{p_limit:100}),
    ]);
    return NextResponse.json({
      configured:true,
      attempts,
      decisions,
      summary:summarizeNoviceDesignerStudy(attempts,decisions),
    },{headers:{"cache-control":"private, no-store","pragma":"no-cache"}});
  }catch(error){
    console.error("[operator/novice-designer-study]",error);
    return NextResponse.json({error:"Novice Designer study evidence could not be loaded."},{status:503});
  }
}

export async function POST(request:Request){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const action=String(body.action||"");

    if(action==="record_attempt"){
      const attempt=normalizeNoviceDesignerAttempt(body);
      const attemptId=await rpc<string>("designer_novice_attempt_record",{
        p_case_id:attempt.caseId,
        p_device_class:attempt.deviceClass,
        p_duration_seconds:attempt.durationSeconds,
        p_novice_confirmed:attempt.noviceConfirmed,
        p_liked_design_completed:attempt.likedDesignCompleted,
        p_blocking_issue:attempt.blockingIssue,
        p_note:attempt.note,
      });
      return NextResponse.json({attemptId});
    }

    if(action==="record_decision"){
      const decision=normalizeNoviceStudyDecision(body);
      const eventId=await rpc<string>("designer_novice_study_decision_record",{
        p_status:decision.status,
        p_target_seconds:decision.targetSeconds,
        p_signed_by:decision.signedBy,
        p_note:decision.note,
      });
      return NextResponse.json({eventId});
    }

    return NextResponse.json({error:"Unsupported novice-study action."},{status:400});
  }catch(error){
    console.error("[operator/novice-designer-study]",error);
    return NextResponse.json({
      error:error instanceof Error?error.message:"Novice Designer study operation failed.",
    },{status:409});
  }
}
