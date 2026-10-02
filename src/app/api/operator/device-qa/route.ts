import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { evaluateDeviceQaEvidence } from "@/lib/designer/device-qa-evidence";

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
      if(String(payload.subtype||"")!=="designer_device_qa") continue;
      const requestedClass=String(payload.deviceClass||"").slice(0,20);
      if(!["mobile","tablet","desktop"].includes(requestedClass) || latest[requestedClass]) continue;
      const evaluation=evaluateDeviceQaEvidence(payload);
      const legacyP95=Number.isFinite(Number(payload.p95Ms))?Number(payload.p95Ms):null;
      const legacySamples=Math.max(0,Math.floor(Number(payload.samples)||0));
      latest[requestedClass]={
        at:row.at,
        status:evaluation.accepted?"accepted":"review",
        viewport:String(payload.viewport||""),
        p95Ms:evaluation.p95Ms??legacyP95,
        samples:evaluation.samples||legacySamples,
        note:String(payload.note||"").slice(0,400),
        evidenceVersion:String(payload.version||"designer-device-qa-v1"),
        performancePass:evaluation.performancePass,
        visualPass:evaluation.visualPass,
      };
    }
    return NextResponse.json({configured:true,latest},{headers:{"cache-control":"private, no-store"}});
  }catch{
    return NextResponse.json({configured:true,latest:{}},{headers:{"cache-control":"private, no-store"}});
  }
}
