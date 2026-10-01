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

    if(action==="start_timer"){
      const caseId=String(body.caseId||"").trim();
      const deviceClass=String(body.deviceClass||"").trim();
      const rows=await rpc<Array<{session_id:string;case_id:string;device_class:string;started_at:string}>>("designer_novice_timer_start",{
        p_case_id:caseId,
        p_device_class:deviceClass,
      });
      const session=rows[0];
      if(!session) throw new Error("Novice timing session could not be started.");
      return NextResponse.json({session});
    }

    if(action==="finish_timer"){
      const timingSessionId=String(body.timingSessionId||"").trim();
      if(!/^[0-9a-f-]{36}$/i.test(timingSessionId)) throw new Error("Valid novice timing session is required.");
      const rows=await rpc<Array<{session_id:string;case_id:string;device_class:string;duration_seconds:number;started_at:string;finished_at:string}>>("designer_novice_timer_finish",{
        p_session_id:timingSessionId,
      });
      const session=rows[0];
      if(!session) throw new Error("Novice timing session could not be finished.");
      return NextResponse.json({session});
    }

    if(action==="record_timed_attempt"){
      const timingSessionId=String(body.timingSessionId||"").trim();
      if(!/^[0-9a-f-]{36}$/i.test(timingSessionId)) throw new Error("Finish a valid server timing session first.");
      const noviceConfirmed=body.noviceConfirmed;
      const likedDesignCompleted=body.likedDesignCompleted;
      const blockingIssue=body.blockingIssue;
      if(typeof noviceConfirmed!=="boolean"||typeof likedDesignCompleted!=="boolean"||typeof blockingIssue!=="boolean"){
        throw new Error("Novice status, liked-design completion and blocking result must all be recorded.");
      }
      const note=String(body.note||"").replace(/\s+/g," ").trim().slice(0,1200);
      if(blockingIssue&&note.length<3) throw new Error("Blocking issues require a short note.");
      const attemptId=await rpc<string>("designer_novice_attempt_record_v2",{
        p_timing_session_id:timingSessionId,
        p_novice_confirmed:noviceConfirmed,
        p_liked_design_completed:likedDesignCompleted,
        p_blocking_issue:blockingIssue,
        p_note:note,
      });
      return NextResponse.json({attemptId});
    }

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
      return NextResponse.json({attemptId,legacyManualTiming:true});
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
