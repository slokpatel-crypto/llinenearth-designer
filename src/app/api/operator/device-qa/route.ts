import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

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
    const latest:Record<string,{at:string;status:string;viewport:string;p95Ms:number|null;samples:number;note:string}>={};
    for(const row of rows){
      const payload=row.payload||{};
      if(String(payload.subtype||"")!=="designer_device_qa") continue;
      const deviceClass=String(payload.deviceClass||"").slice(0,20);
      if(!["mobile","tablet","desktop"].includes(deviceClass) || latest[deviceClass]) continue;
      latest[deviceClass]={
        at:row.at,
        status:String(payload.status||"review"),
        viewport:String(payload.viewport||""),
        p95Ms:Number.isFinite(Number(payload.p95Ms))?Number(payload.p95Ms):null,
        samples:Math.max(0,Math.floor(Number(payload.samples)||0)),
        note:String(payload.note||"").slice(0,400),
      };
    }
    return NextResponse.json({configured:true,latest},{headers:{"cache-control":"private, no-store"}});
  }catch{
    return NextResponse.json({configured:true,latest:{}},{headers:{"cache-control":"private, no-store"}});
  }
}
