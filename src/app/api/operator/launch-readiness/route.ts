import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { normalizeVaultId } from "@/lib/vault-id";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import {
  normalizeBetaAttempt,
  normalizeVerifiedBetaAttempt,
  normalizeLaunchChecklistDecision,
} from "@/lib/designer/launch-readiness-evidence";

export const runtime="nodejs";

function respond(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"cache-control":"private, no-store","pragma":"no-cache"}});}

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
  const unsafe=secureJsonRequestError(request,16384);
  if(unsafe) return respond({error:unsafe.error},unsafe.status);
  if(!await authorized()) return respond({error:"Unauthorized."},401);
  try{
    const body=await readSecureJsonObject(request,16384);
    if(body.action==="record_verified_beta"){
      let draft;
      try{draft=normalizeVerifiedBetaAttempt(body);}
      catch(error){return respond({error:error instanceof Error?error.message:"Invalid verified beta evidence."},400);}
      const receipt=await rpc<unknown>("launch_beta_attempt_record_v4",{
        p_case_id:draft.caseId,p_device_class:draft.deviceClass,p_revision_id:draft.revisionId,
        p_evidence_kind:draft.evidenceKind,p_blocking_bug:draft.blockingBug,p_note:draft.note,
      });
      const attemptId=normalizeVaultId(receipt);
      if(!attemptId) return respond({error:"Verified beta audit was not confirmed by the backend."},409);
      return respond({attemptId,verifiedFlowAudit:true,evidenceKind:draft.evidenceKind});
    }
    if(body.action==="record_beta"){
      let draft;
      try{draft=normalizeBetaAttempt(body);}
      catch(error){return respond({error:error instanceof Error?error.message:"Invalid legacy beta evidence."},400);}
      const receipt=await rpc<unknown>("launch_beta_attempt_record_v2",{
        p_case_id:draft.caseId,p_device_class:draft.deviceClass,p_design_locked:draft.designLocked,
        p_share_or_enquiry_completed:draft.shareOrEnquiryCompleted,
        p_blocking_bug:draft.blockingBug,p_note:draft.note,
      });
      const attemptId=normalizeVaultId(receipt);
      if(!attemptId) return respond({error:"Legacy beta audit was not confirmed by the backend."},409);
      return respond({attemptId,legacyManualEvidence:true});
    }
    if(body.action==="checklist"){
      let decision;
      try{decision=normalizeLaunchChecklistDecision(body);}
      catch(error){return respond({error:error instanceof Error?error.message:"Invalid launch checklist decision."},400);}
      const receipt=await rpc<unknown>("launch_checklist_event_record",{
        p_item_id:decision.itemId,p_status:decision.status,p_signed_by:decision.signedBy,p_note:decision.note,
      });
      const eventId=normalizeVaultId(receipt);
      if(!eventId) return respond({error:"Launch checklist sign-off was not confirmed by the backend."},409);
      return respond({eventId});
    }
    return respond({error:"Unsupported launch-readiness action."},400);
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return respond({error:error.message},413);
    if(error instanceof SecureJsonBodyInvalid) return respond({error:error.message},400);
    console.error("[operator/launch-readiness]",error);
    return respond({error:"Launch-readiness evidence could not be saved."},409);
  }
}
