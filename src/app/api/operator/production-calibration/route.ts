import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { normalizeVaultId } from "@/lib/vault-id";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeProductionCutEvidenceDraft, distinctMeasuredCutCaseIds } from "@/lib/designer/meterage-calibration";

export const runtime="nodejs";

function respond(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"cache-control":"private, no-store","pragma":"no-cache"}});}

type CutRow={
  evidence_id:string;
  case_id:string;
  order_id:string;
  revision_id:string;
  recipe_hash:string;
  garment:"shirt"|"trouser";
  fabric_id:string;
  fabric_width_cm:number|string;
  actual_metres:number|string;
  pattern_repeat_mm:number|string|null;
  pattern_matching:boolean;
  cut_context:string;
  checked_by:string;
  evidence_reference:string;
  note:string;
  created_at:string;
};

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
  if(!response.ok){
    const detail=(await response.text()).replace(/\s+/g," ").slice(0,280);
    throw new Error("Production cut evidence request failed ("+response.status+"): "+detail);
  }
  return await response.json() as T;
}

function median(values:number[]){
  if(!values.length) return null;
  const ordered=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(ordered.length/2);
  const value=ordered.length%2?ordered[middle]:(ordered[middle-1]+ordered[middle])/2;
  return Math.round(value*1000)/1000;
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return NextResponse.json({
    configured:false,cases:[],
    summary:{total:0,shirtCases:0,trouserCases:0,medianShirtMetres:null,medianTrouserMetres:null,readyForModel:false},
  },{headers:{"cache-control":"private, no-store"}});

  try{
    const rows=await rpc<CutRow[]>("production_cut_evidence_list",{p_limit:1000});
    const cases=rows.map((row)=>({
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
    const shirtIds=distinctMeasuredCutCaseIds(rows,"shirt");
    const trouserIds=distinctMeasuredCutCaseIds(rows,"trouser");
    return NextResponse.json({
      configured:true,cases:cases.slice(0,100),
      summary:{
        total:cases.length,
        shirtCases:shirtIds?.length??0,
        trouserCases:trouserIds?.length??0,
        medianShirtMetres:shirtIds===null?null:median(shirts.map((item)=>item.actualMetres)),
        medianTrouserMetres:trouserIds===null?null:median(trousers.map((item)=>item.actualMetres)),
        readyForModel:shirtIds!==null&&trouserIds!==null&&shirtIds.length>=20&&trouserIds.length>=20,
      },
    },{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/production-calibration:get]",error);
    return NextResponse.json({error:"Production cut evidence could not be read."},{status:503});
  }
}

export async function POST(request:Request){
  const unsafe=secureJsonRequestError(request,16384);
  if(unsafe) return respond({error:unsafe.error},unsafe.status);
  if(!await authorized()) return respond({error:"Unauthorized."},401);
  try{
    const body=await readSecureJsonObject(request,16384);
    if(body.action!==undefined&&body.action!=="record") return respond({error:"Unsupported production calibration action."},400);
    let draft;
    try{draft=normalizeProductionCutEvidenceDraft(body);}
    catch(error){return respond({error:error instanceof Error?error.message:"Invalid physical cut evidence."},400);}
    const receipt=await rpc<unknown>("production_cut_evidence_record",{
      p_case_id:draft.caseId,p_order_id:draft.orderId,p_garment:draft.garment,p_fabric_id:draft.fabricId,
      p_fabric_width_cm:draft.fabricWidthCm,p_actual_metres:draft.actualMetres,
      p_pattern_repeat_mm:draft.patternRepeatMm,p_pattern_matching:draft.patternMatching,
      p_cut_context:draft.cutContext,p_checked_by:draft.checkedBy,
      p_evidence_reference:draft.evidenceReference,p_note:draft.note,
    });
    const evidenceId=normalizeVaultId(receipt);
    if(!evidenceId) return respond({error:"Physical cut backend did not confirm an evidence ID."},409);
    return respond({evidenceId});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return respond({error:error.message},413);
    if(error instanceof SecureJsonBodyInvalid) return respond({error:error.message},400);
    console.error("[operator/production-calibration:post]",error);
    return respond({error:"Production cut evidence could not be recorded."},409);
  }
}
