import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { verifyProductionCutLedger } from "@/lib/designer/production-cut-ledger-validation";
import { requireOperatorCreatedId } from "@/lib/designer/operator-created-id";
import { normalizeProductionCutEvidenceDraft } from "@/lib/designer/meterage-calibration";

export const runtime="nodejs";
const MAX_INCOMING_EVIDENCE_BYTES=32_768;
const MAX_UPSTREAM_EVIDENCE_BYTES=4_194_304;
function privateEvidenceJson(body:unknown,init?:ResponseInit){
  const response=NextResponse.json(body,init);
  response.headers.set("cache-control","private, no-store");
  return response;
}


async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const cloud=getSupabaseAdminConfig();
  if(!cloud) throw new Error("Production cut evidence backend is not configured.");
  const response=await fetch(cloud.url.replace(/\/$/,"")+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{...supabaseAdminHeaders(cloud),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  // Never read, echo or log private PostgREST SQL/source details.
  if(!response.ok) throw new Error("Production evidence upstream unavailable.");
  const mime=response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if(mime!=="application/json") throw new Error("Invalid production evidence response.");
  return await readBoundedJsonResponse(response,MAX_UPSTREAM_EVIDENCE_BYTES) as T;
}

function median(values:number[]){
  if(!values.length) return null;
  const ordered=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(ordered.length/2);
  const value=ordered.length%2?ordered[middle]:(ordered[middle-1]+ordered[middle])/2;
  return Math.round(value*1000)/1000;
}

export async function GET(){
  if(!await authorized()) return privateEvidenceJson({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return privateEvidenceJson({
    configured:false,cases:[],
    summary:{total:0,shirtCases:0,trouserCases:0,medianShirtMetres:null,medianTrouserMetres:null,readyForModel:false},
  },{headers:{"cache-control":"private, no-store"}});

  try{
    const rows=await rpc<unknown>("production_cut_evidence_list",{p_limit:1000});
    const verifiedRows=verifyProductionCutLedger(rows,1000);
    const cases=verifiedRows.map((row)=>({
      at:row.created_at,
      caseId:row.case_id,
      orderId:row.order_id,
      revisionId:row.revision_id,
      recipeHash:row.recipe_hash,
      garment:row.garment,
      fabricId:row.fabric_id,
      fabricWidthCm:Number(row.fabric_width_cm),
      actualMetres:Number(row.actual_metres),
      patternRepeatMm:row.pattern_repeat_mm===null?null:Number(row.pattern_repeat_mm),
      patternMatching:row.pattern_matching,
      cutContext:row.cut_context,
      checkedBy:row.checked_by,
      evidenceReference:row.evidence_reference,
      note:row.note,
      verifiedEvidence:true,
    }));
    const shirts=cases.filter((item)=>item.garment==="shirt");
    const trousers=cases.filter((item)=>item.garment==="trouser");
    return privateEvidenceJson({
      configured:true,cases:cases.slice(0,100),
      summary:{
        total:cases.length,
        shirtCases:shirts.length,
        trouserCases:trousers.length,
        medianShirtMetres:median(shirts.map((item)=>item.actualMetres)),
        medianTrouserMetres:median(trousers.map((item)=>item.actualMetres)),
        readyForModel:shirts.length>=20&&trousers.length>=20,
      },
    },{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/production-calibration:get] request failed (details redacted).");
    return privateEvidenceJson({error:"Production cut evidence could not be read."},{status:503});
  }
}

export async function POST(request:Request){
  if(!await authorized()) return privateEvidenceJson({error:"Unauthorized."},{status:401});
  let draft:ReturnType<typeof normalizeProductionCutEvidenceDraft>;
  try{
    const input=await readBoundedJsonResponse(request,MAX_INCOMING_EVIDENCE_BYTES);
    if(!input||typeof input!=="object"||Array.isArray(input))
      return privateEvidenceJson({error:"Valid production evidence JSON object required."},{status:400});
    const body=input as Record<string,unknown>;
    if(String(body.action||"record")!=="record")
      return privateEvidenceJson({error:"Unsupported production calibration action."},{status:400});
    draft=normalizeProductionCutEvidenceDraft(body);
  }catch{
    return privateEvidenceJson({error:"Invalid production cut evidence fields or JSON."},{status:400});
  }
  try{
    const evidenceId=await rpc<unknown>("production_cut_evidence_record",{
      p_case_id:draft.caseId,
      p_order_id:draft.orderId,
      p_garment:draft.garment,
      p_fabric_id:draft.fabricId,
      p_fabric_width_cm:draft.fabricWidthCm,
      p_actual_metres:draft.actualMetres,
      p_pattern_repeat_mm:draft.patternRepeatMm,
      p_pattern_matching:draft.patternMatching,
      p_cut_context:draft.cutContext,
      p_checked_by:draft.checkedBy,
      p_evidence_reference:draft.evidenceReference,
      p_note:draft.note,
    });
    return privateEvidenceJson({evidenceId:requireOperatorCreatedId(evidenceId)});
  }catch{
    console.error("[operator/production-calibration:post] request failed (details redacted).");
    return privateEvidenceJson({error:"Production evidence could not be recorded or verified."},{status:503});
  }
}
