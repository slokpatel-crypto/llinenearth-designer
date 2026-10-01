import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime="nodejs";

type Row={at:string;payload?:Record<string,unknown>};

export async function GET(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }

  const cloud=getSupabaseAdminConfig();
  if(!cloud) return NextResponse.json({configured:false,latest:null},{headers:{"cache-control":"private, no-store"}});

  try{
    const params=new URLSearchParams({
      select:"at,payload",
      type:"eq.operator_note",
      source:"eq.operator",
      order:"at.desc",
      limit:"300",
    });
    const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
      cache:"no-store",
    });
    if(!response.ok) return NextResponse.json({configured:true,latest:null},{headers:{"cache-control":"private, no-store"}});
    const rows=await response.json() as Row[];
    for(const row of rows){
      const payload=row.payload||{};
      if(String(payload.subtype||"")!=="roadmap_phase1_proof") continue;
      return NextResponse.json({
        configured:true,
        latest:{
          at:row.at,
          status:String(payload.status||"review"),
          fabricId:String(payload.fabricId||""),
          fabricName:String(payload.fabricName||""),
          pattern:String(payload.pattern||""),
          repeatMm:Number.isFinite(Number(payload.repeatMm))?Number(payload.repeatMm):null,
          scaleErrorPct:Number.isFinite(Number(payload.scaleErrorPct))?Number(payload.scaleErrorPct):null,
          scaleGatePass:payload.scaleGatePass===true,
          realModelSamples:Math.max(0,Math.floor(Number(payload.realModelSamples)||0)),
          realModelP95Ms:Number.isFinite(Number(payload.realModelP95Ms))?Number(payload.realModelP95Ms):null,
          realismRatings:Array.isArray(payload.realismRatings)?payload.realismRatings.map(Number).filter(Number.isFinite):[],
          strongRatings:Math.max(0,Math.floor(Number(payload.strongRatings)||0)),
          realismPass:payload.realismPass===true,
          note:String(payload.note||"").slice(0,700),
        },
      },{headers:{"cache-control":"private, no-store"}});
    }
    return NextResponse.json({configured:true,latest:null},{headers:{"cache-control":"private, no-store"}});
  }catch{
    return NextResponse.json({configured:true,latest:null},{headers:{"cache-control":"private, no-store"}});
  }
}
