import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { DEVICE_QA_EVIDENCE_VERSION, evaluateDeviceQaEvidence, normalizeDeviceQaEvidenceReceipt } from "@/lib/designer/device-qa-evidence";

export const runtime="nodejs";

type Row={at:string;payload?:Record<string,unknown>};

export async function GET() {
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }
  const cloud=getSupabaseAdminConfig();
  if(!cloud) return NextResponse.json({configured:false,latest:{}},{headers:{"cache-control":"private, no-store"}});

  try{
    const params=new URLSearchParams({
      select:"at,payload",
      type:"eq.operator_note",
      source:"eq.operator",
      order:"at.desc",
      limit:"500",
    });
    const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
      cache:"no-store",
    });
    if(!response.ok) return NextResponse.json({configured:true,latest:{}},{headers:{"cache-control":"private, no-store"}});
    const rows=await response.json() as Row[];
    const latest:Record<string,{
      at:string;status:string;viewport:string;p95Ms:number|null;samples:number;note:string;
      evidenceVersion:string;performancePass:boolean;visualPass:boolean;
    }>={};
    for(const row of rows){
      const payload=row.payload||{};
      if(payload.subtype!=="designer_device_qa") continue;
      const requestedClass=typeof payload.deviceClass==="string"?payload.deviceClass:"";
      if(!["mobile","tablet","desktop"].includes(requestedClass) || latest[requestedClass]) continue;
      const evaluation=evaluateDeviceQaEvidence(payload);
      // Historical v2 rows with contradictory metadata or an explicit human
      // review must never be promoted into an accepted device gate by raw
      // latency/checkboxes alone. V1 remains visible but review-only.
      const verifiedV2=payload.version===DEVICE_QA_EVIDENCE_VERSION
        ?normalizeDeviceQaEvidenceReceipt(payload):null;
      const legacyP95=typeof payload.p95Ms==="number" && Number.isFinite(payload.p95Ms) && payload.p95Ms>=0 && payload.p95Ms<=10000?payload.p95Ms:null;
      const legacySamples=typeof payload.samples==="number" && Number.isSafeInteger(payload.samples) && payload.samples>=0 && payload.samples<=500?payload.samples:0;
      latest[requestedClass]={
        at:row.at,
        status:verifiedV2?.status==="accepted"&&evaluation.accepted?"accepted":"review",
        viewport:typeof payload.viewport==="string"?payload.viewport:"",
        p95Ms:evaluation.versionValid?(verifiedV2?evaluation.p95Ms:null):legacyP95,
        samples:evaluation.versionValid?(verifiedV2?evaluation.samples:0):legacySamples,
        note:typeof payload.note==="string"?payload.note.slice(0,400):"",
        evidenceVersion:typeof payload.version==="string"?payload.version:"designer-device-qa-v1",
        // Raw latency and checkboxes alone cannot certify an invalid or
        // legacy receipt, even when the displayed status remains review.
        performancePass:Boolean(verifiedV2&&evaluation.performancePass),
        visualPass:Boolean(verifiedV2&&evaluation.visualPass),
      };
    }
    return NextResponse.json({configured:true,latest},{headers:{"cache-control":"private, no-store"}});
  }catch{
    return NextResponse.json({configured:true,latest:{}},{headers:{"cache-control":"private, no-store"}});
  }
}
