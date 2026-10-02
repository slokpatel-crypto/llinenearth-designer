import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeMeterageCalibrationDraft } from "@/lib/designer/meterage-calibration";

export const runtime="nodejs";

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
  return rows
    .filter((row)=>row.garment===garment)
    .map((row)=>String(row.case_id||"").trim())
    .filter(Boolean);
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
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const action=String(body.action||"");

    if(action==="create"){
      const draft=normalizeMeterageCalibrationDraft(body);
      const caseIds=await evidenceCaseIds(draft.garment);
      if(caseIds.length<20){
        return NextResponse.json({
          error:"At least 20 production-order-backed real cut cases for "+draft.garment+" are required before a calibration draft can be registered.",
          evidenceCount:caseIds.length,
        },{status:409});
      }
      const modelId=await rpc<string>("production_meterage_model_create_v4",{
        p_garment:draft.garment,
        p_version:draft.version,
        p_bands:draft.bands,
        p_evidence_case_ids:caseIds,
        p_note:draft.note,
      });
      return NextResponse.json({modelId,evidenceCount:caseIds.length});
    }

    if(action==="approve"){
      const modelId=String(body.modelId||"").trim();
      const approvedBy=String(body.approvedBy||"").trim().slice(0,120);
      const approvalNote=String(body.approvalNote||"").trim().slice(0,1200);
      if(approvedBy.length<2) return NextResponse.json({error:"Owner/tailor approver is required."},{status:400});
      const updated=await rpc<boolean>("production_meterage_model_approve_v4",{
        p_model_id:modelId,p_approved_by:approvedBy,p_approval_note:approvalNote,
      });
      return NextResponse.json({updated:Boolean(updated)});
    }

    if(action==="retire"){
      const modelId=String(body.modelId||"").trim();
      const updated=await rpc<boolean>("production_meterage_model_retire",{p_model_id:modelId});
      return NextResponse.json({updated:Boolean(updated)});
    }

    return NextResponse.json({error:"Unsupported meterage calibration action."},{status:400});
  }catch(error){
    console.error("[operator/meterage-model]",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Meterage calibration operation failed."},{status:409});
  }
}
