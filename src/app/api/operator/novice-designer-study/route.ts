import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { normalizeVaultId } from "@/lib/vault-id";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import {
  normalizeNoviceDesignerAttempt,
  normalizeNoviceStudyDecision,
  normalizeNoviceTimerStart,
  normalizeNoviceTimedAttempt,
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

function respond(body:unknown,status=200){
  return NextResponse.json(body,{status,headers:{"cache-control":"private, no-store","pragma":"no-cache"}});
}
function invalid(error:unknown){
  return respond({error:error instanceof Error?error.message:"Invalid novice study evidence."},400);
}
function confirmedTimerStart(receipt:unknown,caseId:string,deviceClass:string){
  if(!Array.isArray(receipt)||receipt.length!==1) return null;
  const row=receipt[0] as Record<string,unknown>|null;
  if(!row||typeof row!=="object"||Array.isArray(row)) return null;
  const id=normalizeVaultId(row.session_id);
  if(!id||row.case_id!==caseId||row.device_class!==deviceClass||typeof row.started_at!=="string")
    return null;
  return {session_id:id,case_id:caseId,device_class:deviceClass,started_at:row.started_at};
}
function confirmedTimerFinish(receipt:unknown,sessionId:string){
  if(!Array.isArray(receipt)||receipt.length!==1) return null;
  const row=receipt[0] as Record<string,unknown>|null;
  if(!row||typeof row!=="object"||Array.isArray(row)) return null;
  if(normalizeVaultId(row.session_id)!==sessionId||typeof row.case_id!=="string"||
     !["mobile","tablet","desktop"].includes(String(row.device_class))||
     typeof row.duration_seconds!=="number"||!Number.isFinite(row.duration_seconds)||
     row.duration_seconds<=0||row.duration_seconds>7200||
     typeof row.started_at!=="string"||typeof row.finished_at!=="string")
    return null;
  return row;
}

export async function POST(request:Request){
  const unsafe=secureJsonRequestError(request,16384);
  if(unsafe) return respond({error:unsafe.error},unsafe.status);
  if(!await authorized()) return respond({error:"Unauthorized."},401);
  try{
    const body=await readSecureJsonObject(request,16384);
    if(body.action==="start_timer"){
      let draft;
      try{draft=normalizeNoviceTimerStart(body);}catch(error){return invalid(error);}
      const receipt=await rpc<unknown>("designer_novice_timer_start",{
        p_case_id:draft.caseId,p_device_class:draft.deviceClass,
      });
      const session=confirmedTimerStart(receipt,draft.caseId,draft.deviceClass);
      if(!session) return respond({error:"Server timing session was not confirmed."},409);
      return respond({session});
    }
    if(body.action==="finish_timer"){
      const timingSessionId=normalizeVaultId(body.timingSessionId);
      if(!timingSessionId) return respond({error:"Valid novice timing session is required."},400);
      const receipt=await rpc<unknown>("designer_novice_timer_finish",{
        p_session_id:timingSessionId,
      });
      const session=confirmedTimerFinish(receipt,timingSessionId);
      if(!session) return respond({error:"Finished timing session was not confirmed."},409);
      return respond({session});
    }
    if(body.action==="record_timed_attempt"){
      let draft;
      try{draft=normalizeNoviceTimedAttempt(body);}catch(error){return invalid(error);}
      const timingSessionId=normalizeVaultId(draft.timingSessionId);
      if(!timingSessionId) return respond({error:"Finish a valid server timing session first."},400);
      const receipt=await rpc<unknown>("designer_novice_attempt_record_v2",{
        p_timing_session_id:timingSessionId,
        p_novice_confirmed:draft.noviceConfirmed,
        p_liked_design_completed:draft.likedDesignCompleted,
        p_blocking_issue:draft.blockingIssue,
        p_note:draft.note,
      });
      const attemptId=normalizeVaultId(receipt);
      if(!attemptId) return respond({error:"Timed novice attempt was not confirmed."},409);
      return respond({attemptId});
    }
    if(body.action==="record_attempt"){
      let draft;
      try{draft=normalizeNoviceDesignerAttempt(body);}catch(error){return invalid(error);}
      const receipt=await rpc<unknown>("designer_novice_attempt_record",{
        p_case_id:draft.caseId,p_device_class:draft.deviceClass,
        p_duration_seconds:draft.durationSeconds,
        p_novice_confirmed:draft.noviceConfirmed,
        p_liked_design_completed:draft.likedDesignCompleted,
        p_blocking_issue:draft.blockingIssue,p_note:draft.note,
      });
      const attemptId=normalizeVaultId(receipt);
      if(!attemptId) return respond({error:"Legacy novice attempt was not confirmed."},409);
      return respond({attemptId,legacyManualTiming:true});
    }
    if(body.action==="record_decision"){
      let draft;
      try{draft=normalizeNoviceStudyDecision(body);}catch(error){return invalid(error);}
      const receipt=await rpc<unknown>("designer_novice_study_decision_record",{
        p_status:draft.status,p_target_seconds:draft.targetSeconds,
        p_signed_by:draft.signedBy,p_note:draft.note,
      });
      const eventId=normalizeVaultId(receipt);
      if(!eventId) return respond({error:"Human novice-study decision was not confirmed."},409);
      return respond({eventId});
    }
    return respond({error:"Unsupported novice-study action."},400);
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return respond({error:error.message},413);
    if(error instanceof SecureJsonBodyInvalid) return respond({error:error.message},400);
    console.error("[operator/novice-designer-study]",error);
    return respond({error:"Novice Designer study operation failed."},409);
  }
}
