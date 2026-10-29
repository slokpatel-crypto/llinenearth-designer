import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { normalizeVaultId } from "@/lib/vault-id";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeMeterageCalibrationDraft, distinctMeasuredCutCaseIds } from "@/lib/designer/meterage-calibration";

export const runtime="nodejs";

function respond(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"cache-control":"private, no-store","pragma":"no-cache"}});}

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Meterage calibration backend is not configured.");
  const response=await fetch(config.url.replace(/\/$/,"")+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    const detail=(await response.text()).replace(/\s+/g," ").slice(0,280);
    throw new Error("Meterage calibration request failed ("+response.status+"): "+detail);
  }
  return await response.json() as T;
}

async function evidenceCaseIds(garment:"shirt"|"trouser"){
  const rows=await rpc<Array<{case_id:string;garment:string}>>("production_cut_evidence_list",{p_limit:2000});
  const identities=distinctMeasuredCutCaseIds(rows,garment);
  if(identities===null) throw new Error("Production cut ledger contains invalid or repeated case identities; reconcile physical evidence before creating a meterage model.");
  return identities;
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return NextResponse.json({configured:false,models:[]});
  try{
    const models=await rpc<unknown[]>("production_meterage_model_list",{p_limit:100});
    return NextResponse.json({configured:true,models},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/meterage-model]",error);
    return NextResponse.json({error:"Meterage calibration registry could not be read."},{status:503});
  }
}

export async function POST(request:Request){
  const unsafe=secureJsonRequestError(request,16384);
  if(unsafe) return respond({error:unsafe.error},unsafe.status);
  if(!await authorized()) return respond({error:"Unauthorized."},401);
  try{
    const body=await readSecureJsonObject(request,16384);
    if(body.action==="create"){
      let draft;
      try{draft=normalizeMeterageCalibrationDraft(body);}
      catch(error){return respond({error:error instanceof Error?error.message:"Invalid meterage calibration."},400);}
      const caseIds=await evidenceCaseIds(draft.garment);
      if(caseIds.length<20) return respond({
        error:"At least 20 production-order-backed real cut cases for "+draft.garment+" are required before a calibration draft can be registered.",
        evidenceCount:caseIds.length,
      },409);
      const receipt=await rpc<unknown>("production_meterage_model_create_v4",{
        p_garment:draft.garment,p_version:draft.version,p_bands:draft.bands,
        p_evidence_case_ids:caseIds,p_note:draft.note,
      });
      const modelId=normalizeVaultId(receipt);
      if(!modelId) return respond({error:"Meterage model backend did not confirm a model ID."},409);
      return respond({modelId,evidenceCount:caseIds.length});
    }
    if(body.action==="approve"){
      const modelId=normalizeVaultId(body.modelId);
      const approvedBy=typeof body.approvedBy==="string"?body.approvedBy.trim():"";
      if(!modelId) return respond({error:"Valid meterage model ID is required."},400);
      if(approvedBy.length<2||approvedBy.length>120) return respond({error:"Owner/tailor approver must be 2–120 characters."},400);
      if(body.approvalNote!==undefined&&body.approvalNote!==null&&typeof body.approvalNote!=="string")
        return respond({error:"Approval note must be text."},400);
      const approvalNote=typeof body.approvalNote==="string"?body.approvalNote.trim():"";
      if(approvalNote.length>1200) return respond({error:"Approval note cannot exceed 1200 characters."},400);
      const updated=await rpc<unknown>("production_meterage_model_approve_v4",{
        p_model_id:modelId,p_approved_by:approvedBy,p_approval_note:approvalNote,
      });
      if(updated!==true) return respond({error:"Meterage model approval was not confirmed."},409);
      return respond({updated:true});
    }
    if(body.action==="retire"){
      const modelId=normalizeVaultId(body.modelId);
      if(!modelId) return respond({error:"Valid meterage model ID is required."},400);
      const updated=await rpc<unknown>("production_meterage_model_retire",{p_model_id:modelId});
      if(updated!==true) return respond({error:"Meterage model retirement was not confirmed."},409);
      return respond({updated:true});
    }
    return respond({error:"Unsupported meterage calibration action."},400);
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return respond({error:error.message},413);
    if(error instanceof SecureJsonBodyInvalid) return respond({error:error.message},400);
    console.error("[operator/meterage-model]",error);
    return respond({error:"Meterage calibration operation failed."},409);
  }
}
