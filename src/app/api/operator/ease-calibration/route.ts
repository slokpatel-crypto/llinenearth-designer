import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { normalizeVaultId } from "@/lib/vault-id";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import {
  normalizeEaseEvidenceDraft,
  normalizeHouseEaseCalibrationDraft,
  summarizeEaseEvidence,
} from "@/lib/designer/ease-calibration";

export const runtime="nodejs";

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("House-ease calibration backend is not configured.");
  const response=await fetch(`${config.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    const detail=(await response.text()).replace(/\s+/g," ").slice(0,300);
    throw new Error(`House-ease calibration request failed (${response.status}): ${detail}`);
  }
  return await response.json() as T;
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) {
    return NextResponse.json({
      configured:false,evidence:[],models:[],
      summary:summarizeEaseEvidence([]),
    },{headers:{"cache-control":"private, no-store"}});
  }
  try{
    const [evidence,models]=await Promise.all([
      rpc<Array<Record<string,unknown>>>("house_ease_evidence_list",{p_limit:2500}),
      rpc<Array<Record<string,unknown>>>("house_ease_model_list",{p_limit:100}),
    ]);
    return NextResponse.json({
      configured:true,
      evidence,
      models,
      summary:summarizeEaseEvidence(evidence),
    },{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/ease-calibration]",error);
    return NextResponse.json({error:"House-ease calibration evidence could not be loaded."},{status:503});
  }
}

function respond(body:unknown,status=200){
  return NextResponse.json(body,{status,headers:{"cache-control":"private, no-store","pragma":"no-cache"}});
}
function literalApprovalText(value:unknown,max:number,label:string,min=0){
  if(value===undefined||value===null){
    if(min>0) throw new Error(label+" is required.");
    return "";
  }
  if(typeof value!=="string") throw new Error(label+" must be text.");
  const normalized=value.replace(/\s+/g," ").trim();
  if(normalized.length>max) throw new Error(label+" is too long.");
  if(normalized.length<min) throw new Error(label+" is required.");
  return normalized;
}
function invalid(error:unknown){
  return respond({error:error instanceof Error?error.message:"Invalid house-ease evidence."},400);
}

export async function POST(request:Request){
  const unsafe=secureJsonRequestError(request,16384);
  if(unsafe) return respond({error:unsafe.error},unsafe.status);
  if(!await authorized()) return respond({error:"Unauthorized."},401);
  try{
    const body=await readSecureJsonObject(request,16384);
    if(body.action==="record_evidence"){
      let draft;
      try{draft=normalizeEaseEvidenceDraft(body);}catch(error){return invalid(error);}
      const receipt=await rpc<unknown>("house_ease_evidence_record",{
        p_case_id:draft.caseId,p_garment:draft.garment,p_fit_class:draft.fitClass,
        p_field:draft.field,p_body_cm:draft.bodyCm,p_finished_cm:draft.finishedCm,
        p_tailor:draft.tailor,p_garment_ref:draft.garmentRef,p_note:draft.note,
      });
      const evidenceId=normalizeVaultId(receipt);
      if(!evidenceId) return respond({error:"Physical ease evidence was not confirmed by the backend."},409);
      return respond({evidenceId,easeCm:draft.easeCm});
    }
    if(body.action==="create_model"){
      let draft;
      try{draft=normalizeHouseEaseCalibrationDraft(body);}catch(error){return invalid(error);}
      const evidence=await rpc<Array<Record<string,unknown>>>("house_ease_evidence_list",{p_limit:5000});
      if(!Array.isArray(evidence)) return respond({error:"Physical ease evidence list is invalid."},409);
      const summary=summarizeEaseEvidence(evidence);
      if(!summary.evidenceCoverageComplete){
        return respond({
          error:"Real finished-garment evidence is required for every current ease-table cell before a replacement draft can be registered.",
          summary,
        },409);
      }
      const receipt=await rpc<unknown>("house_ease_model_create",{
        p_version:draft.version,p_shirt_table:draft.shirt,
        p_trouser_table:draft.trouser,p_note:draft.note,
      });
      const modelId=normalizeVaultId(receipt);
      if(!modelId) return respond({error:"House-ease model creation was not confirmed."},409);
      return respond({modelId,summary});
    }
    if(body.action==="approve_model"){
      const modelId=normalizeVaultId(body.modelId);
      if(!modelId) return respond({error:"A valid house-ease model ID is required."},400);
      let approvedBy:string,approvalNote:string;
      try{
        approvedBy=literalApprovalText(body.approvedBy,120,"Owner/tailor approver",2);
        approvalNote=literalApprovalText(body.approvalNote,1200,"Approval note");
      }catch(error){return invalid(error);}
      const receipt=await rpc<unknown>("house_ease_model_approve",{
        p_model_id:modelId,p_approved_by:approvedBy,p_approval_note:approvalNote,
      });
      if(receipt!==true) return respond({error:"House-ease approval was not confirmed."},409);
      return respond({updated:true});
    }
    if(body.action==="retire_model"){
      const modelId=normalizeVaultId(body.modelId);
      if(!modelId) return respond({error:"A valid house-ease model ID is required."},400);
      const receipt=await rpc<unknown>("house_ease_model_retire",{p_model_id:modelId});
      if(receipt!==true) return respond({error:"House-ease retirement was not confirmed."},409);
      return respond({updated:true});
    }
    return respond({error:"Unsupported house-ease calibration action."},400);
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return respond({error:error.message},413);
    if(error instanceof SecureJsonBodyInvalid) return respond({error:error.message},400);
    console.error("[operator/ease-calibration]",error);
    return respond({error:"House-ease calibration operation failed."},409);
  }
}
