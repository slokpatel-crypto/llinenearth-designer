import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { validateOperatorLedgerRows } from "@/lib/designer/operator-optional-rpc";
import { requireOperatorCreatedId } from "@/lib/designer/operator-created-id";
import {
  secureJsonRequestError, readSecureJsonObject,
  SecureJsonBodyInvalid, SecureJsonBodyTooLarge,
} from "@/lib/secure-json-request";
import {
  normalizeBetaAttempt,
  normalizeVerifiedBetaAttempt,
  normalizeLaunchChecklistDecision,
} from "@/lib/designer/launch-readiness-evidence";

export const runtime="nodejs";
const MAX_INCOMING_BYTES=32_768;
const MAX_UPSTREAM_BYTES=4_194_304;

function privateLaunchJson(body:unknown,init?:ResponseInit){
  const response=NextResponse.json(body,init);
  response.headers.set("cache-control","private, no-store");
  response.headers.set("pragma","no-cache");
  return response;
}

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

async function rpc(name:string,payload:Record<string,unknown>):Promise<unknown>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Launch-readiness backend is not configured.");
  const response=await fetch(config.url.replace(/\/$/,"")+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  // Never read, reflect or log untrusted PostgREST SQL, credentials or customer details.
  if(!response.ok) throw new Error("Launch-readiness upstream unavailable.");
  const mime=response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if(mime!=="application/json") throw new Error("Invalid launch-readiness upstream response.");
  return readBoundedJsonResponse(response,MAX_UPSTREAM_BYTES);
}

export async function GET(){
  if(!await authorized()) return privateLaunchJson({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return privateLaunchJson({configured:false,betaAttempts:[],checklistEvents:[]});
  try{
    const [betaAttempts,checklistEvents]=await Promise.all([
      rpc("launch_beta_attempt_list",{p_limit:500}),
      rpc("launch_checklist_event_list",{p_limit:500}),
    ]);
    return privateLaunchJson({
      configured:true,
      betaAttempts:validateOperatorLedgerRows(betaAttempts,500),
      checklistEvents:validateOperatorLedgerRows(checklistEvents,500),
    });
  }catch{
    console.error("[operator/launch-readiness] private evidence read failed (details redacted).");
    return privateLaunchJson({error:"Launch-readiness evidence could not be read."},{status:503});
  }
}

export async function POST(request:Request){
  if(!await authorized()) return privateLaunchJson({error:"Unauthorized."},{status:401});
  const unsafe=secureJsonRequestError(request,MAX_INCOMING_BYTES);
  if(unsafe) return privateLaunchJson({error:unsafe.error},{status:unsafe.status});

  let name:string;
  let payload:Record<string,unknown>;
  let acknowledgement:"attemptId"|"eventId";
  let extra:Record<string,unknown>={};
  try{
    const body=await readSecureJsonObject(request,MAX_INCOMING_BYTES);
    const action=body.action;
    if(action==="record_verified_beta"){
      const draft=normalizeVerifiedBetaAttempt(body);
      name="launch_beta_attempt_record_v4";
      payload={
        p_case_id:draft.caseId,p_device_class:draft.deviceClass,
        p_revision_id:draft.revisionId,p_evidence_kind:draft.evidenceKind,
        p_blocking_bug:draft.blockingBug,p_note:draft.note,
      };
      acknowledgement="attemptId";
      extra={verifiedFlowAudit:true,evidenceKind:draft.evidenceKind};
    }else if(action==="record_beta"){
      const draft=normalizeBetaAttempt(body);
      name="launch_beta_attempt_record_v2";
      payload={
        p_case_id:draft.caseId,p_device_class:draft.deviceClass,
        p_design_locked:draft.designLocked,
        p_share_or_enquiry_completed:draft.shareOrEnquiryCompleted,
        p_blocking_bug:draft.blockingBug,p_note:draft.note,
      };
      acknowledgement="attemptId";
      extra={legacyManualEvidence:true};
    }else if(action==="checklist"){
      const decision=normalizeLaunchChecklistDecision(body);
      name="launch_checklist_event_record";
      payload={
        p_item_id:decision.itemId,p_status:decision.status,
        p_signed_by:decision.signedBy,p_note:decision.note,
      };
      acknowledgement="eventId";
    }else{
      return privateLaunchJson({error:"Unsupported launch-readiness action."},{status:400});
    }
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge)
      return privateLaunchJson({error:"Request payload is too large."},{status:413});
    if(error instanceof SecureJsonBodyInvalid)
      return privateLaunchJson({error:"Valid JSON object required."},{status:400});
    return privateLaunchJson({error:"Invalid launch-readiness evidence fields."},{status:400});
  }

  try{
    const createdId=requireOperatorCreatedId(await rpc(name,payload));
    return privateLaunchJson({[acknowledgement]:createdId,...extra});
  }catch{
    console.error("[operator/launch-readiness] private evidence write uncertain (details redacted).");
    return privateLaunchJson({
      error:"Launch-readiness evidence could not be confirmed. Reconcile the ledger before retrying.",
    },{status:503});
  }
}
