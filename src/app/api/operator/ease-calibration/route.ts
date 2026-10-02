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

export async function POST(request:Request){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const action=String(body.action||"");

    if(action==="record_evidence"){
      const draft=normalizeEaseEvidenceDraft(body);
      const evidenceId=await rpc<string>("house_ease_evidence_record",{
        p_case_id:draft.caseId,
        p_garment:draft.garment,
        p_fit_class:draft.fitClass,
        p_field:draft.field,
        p_body_cm:draft.bodyCm,
        p_finished_cm:draft.finishedCm,
        p_tailor:draft.tailor,
        p_garment_ref:draft.garmentRef,
        p_note:draft.note,
      });
      return NextResponse.json({evidenceId,easeCm:draft.easeCm});
    }

    if(action==="create_model"){
      const draft=normalizeHouseEaseCalibrationDraft(body);
      const evidence=await rpc<Array<Record<string,unknown>>>("house_ease_evidence_list",{p_limit:5000});
      const summary=summarizeEaseEvidence(evidence);
      if(!summary.evidenceCoverageComplete){
        return NextResponse.json({
          error:"Real finished-garment evidence is required for every current ease-table cell before a replacement draft can be registered.",
          summary,
        },{status:409});
      }
      const modelId=await rpc<string>("house_ease_model_create",{
        p_version:draft.version,
        p_shirt_table:draft.shirt,
        p_trouser_table:draft.trouser,
        p_note:draft.note,
      });
      return NextResponse.json({modelId,summary});
    }

    if(action==="approve_model"){
      const modelId=String(body.modelId||"").trim();
      const approvedBy=String(body.approvedBy||"").trim().slice(0,120);
      const approvalNote=String(body.approvalNote||"").trim().slice(0,1200);
      if(approvedBy.length<2) return NextResponse.json({error:"Owner/tailor approver is required."},{status:400});
      const updated=await rpc<boolean>("house_ease_model_approve",{
        p_model_id:modelId,p_approved_by:approvedBy,p_approval_note:approvalNote,
      });
      return NextResponse.json({updated:Boolean(updated)});
    }

    if(action==="retire_model"){
      const modelId=String(body.modelId||"").trim();
      const updated=await rpc<boolean>("house_ease_model_retire",{p_model_id:modelId});
      return NextResponse.json({updated:Boolean(updated)});
    }

    return NextResponse.json({error:"Unsupported house-ease calibration action."},{status:400});
  }catch(error){
    console.error("[operator/ease-calibration]",error);
    return NextResponse.json({error:error instanceof Error?error.message:"House-ease calibration operation failed."},{status:409});
  }
}
