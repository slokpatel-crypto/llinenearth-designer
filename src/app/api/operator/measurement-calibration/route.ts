import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeMeasurementCalibrationDraft, summarizeMeasurementCalibration, type MeasurementCalibrationCaseRow } from "@/lib/designer/measurement-calibration";

export const runtime="nodejs";

async function operatorAuthorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

async function rpc<T>(name:string,body:Record<string,unknown>){
  const cloud=getSupabaseAdminConfig();
  if(!cloud) throw new Error("Supabase operator evidence is not configured.");
  const response=await fetch(cloud.url.replace(/\/$/,"")+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{...supabaseAdminHeaders(cloud),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(body),
    cache:"no-store",
    signal:AbortSignal.timeout(10_000),
  });
  if(!response.ok) throw new Error((await response.text()).slice(0,500)||"Measurement evidence RPC failed.");
  return await response.json() as T;
}

export async function GET(){
  if(!await operatorAuthorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return NextResponse.json({
    configured:false,cases:[],
    summary:{target:10,total:0,medianChestErrorCm:null,medianSleeveErrorCm:null,chestPass:false,sleevePass:false,complete:false},
  },{headers:{"cache-control":"private, no-store"}});
  try{
    const rows=await rpc<MeasurementCalibrationCaseRow[]>("measurement_calibration_case_list",{p_limit:500});
    const summary=summarizeMeasurementCalibration(rows);
    return NextResponse.json({configured:true,cases:summary.cases.slice(0,50),summary:{...summary,cases:undefined}},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[measurement-calibration:get]",error);
    return NextResponse.json({
      configured:true,cases:[],
      summary:{target:10,total:0,medianChestErrorCm:null,medianSleeveErrorCm:null,chestPass:false,sleevePass:false,complete:false},
      error:"Measurement calibration evidence could not be loaded.",
    },{status:503,headers:{"cache-control":"private, no-store"}});
  }
}

export async function POST(request:Request){
  if(!await operatorAuthorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const draft=normalizeMeasurementCalibrationDraft(await request.json());
    const eventId=await rpc<string>("measurement_calibration_case_record",{
      p_case_id:draft.caseId,
      p_self_chest_cm:draft.selfChestCm,
      p_tailor_chest_cm:draft.tailorChestCm,
      p_self_sleeve_cm:draft.selfSleeveCm,
      p_tailor_sleeve_cm:draft.tailorSleeveCm,
      p_evidence_source:draft.evidenceSource,
      p_checked_by:draft.checkedBy,
      p_note:draft.note,
    });
    return NextResponse.json({eventId,stored:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Measurement calibration evidence could not be stored."},{status:400});
  }
}
