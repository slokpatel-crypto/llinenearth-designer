import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import {
  normalizeBetaAttempt,
  normalizeLaunchChecklistDecision,
} from "@/lib/designer/launch-readiness-evidence";

export const runtime="nodejs";

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Launch-readiness backend is not configured.");
  const response=await fetch(config.url.replace(/\/$/,"")+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    const detail=(await response.text()).replace(/\s+/g," ").slice(0,280);
    throw new Error("Launch-readiness request failed ("+response.status+"): "+detail);
  }
  return await response.json() as T;
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return NextResponse.json({configured:false,betaAttempts:[],checklistEvents:[]});
  try{
    const [betaAttempts,checklistEvents]=await Promise.all([
      rpc<unknown[]>("launch_beta_attempt_list",{p_limit:500}),
      rpc<unknown[]>("launch_checklist_event_list",{p_limit:500}),
    ]);
    return NextResponse.json({configured:true,betaAttempts,checklistEvents},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/launch-readiness]",error);
    return NextResponse.json({error:"Launch-readiness evidence could not be read."},{status:503});
  }
}

export async function POST(request:Request){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const action=String(body.action||"");
    if(action==="record_beta"){
      const draft=normalizeBetaAttempt(body);
      const attemptId=await rpc<string>("launch_beta_attempt_record",{
        p_case_id:draft.caseId,
        p_device_class:draft.deviceClass,
        p_core_flow_completed:draft.coreFlowCompleted,
        p_blocking_bug:draft.blockingBug,
        p_note:draft.note,
      });
      return NextResponse.json({attemptId});
    }
    if(action==="checklist"){
      const decision=normalizeLaunchChecklistDecision(body);
      const eventId=await rpc<string>("launch_checklist_event_record",{
        p_item_id:decision.itemId,
        p_status:decision.status,
        p_signed_by:decision.signedBy,
        p_note:decision.note,
      });
      return NextResponse.json({eventId});
    }
    return NextResponse.json({error:"Unsupported launch-readiness action."},{status:400});
  }catch(error){
    console.error("[operator/launch-readiness]",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Launch-readiness evidence could not be saved."},{status:409});
  }
}
