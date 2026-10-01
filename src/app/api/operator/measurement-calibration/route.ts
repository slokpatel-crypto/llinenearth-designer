import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime="nodejs";

type Row={at:string;payload?:Record<string,unknown>};

function finite(value:unknown){
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}
function median(values:number[]){
  if(!values.length) return null;
  const ordered=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(ordered.length/2);
  const value=ordered.length%2?ordered[middle]:(ordered[middle-1]+ordered[middle])/2;
  return Math.round(value*100)/100;
}

export async function GET(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }
  const cloud=getSupabaseAdminConfig();
  if(!cloud) return NextResponse.json({
    configured:false,
    cases:[],
    summary:{target:10,total:0,medianChestErrorCm:null,medianSleeveErrorCm:null,chestPass:false,sleevePass:false,complete:false},
  },{headers:{"cache-control":"private, no-store"}});

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
    if(!response.ok) throw new Error("read failed");
    const rows=await response.json() as Row[];
    const seen=new Set<string>();
    const cases:Array<{
      at:string;caseId:string;selfChestCm:number;tailorChestCm:number;chestErrorCm:number;
      selfSleeveCm:number;tailorSleeveCm:number;sleeveErrorCm:number;note:string;
    }>=[];
    for(const row of rows){
      const payload=row.payload||{};
      if(String(payload.subtype||"")!=="measurement_calibration_case") continue;
      const caseId=String(payload.caseId||"").slice(0,80);
      if(!caseId||seen.has(caseId)) continue;
      const selfChest=finite(payload.selfChestCm),tailorChest=finite(payload.tailorChestCm);
      const selfSleeve=finite(payload.selfSleeveCm),tailorSleeve=finite(payload.tailorSleeveCm);
      if(selfChest===null||tailorChest===null||selfSleeve===null||tailorSleeve===null) continue;
      seen.add(caseId);
      cases.push({
        at:row.at,caseId,
        selfChestCm:selfChest,tailorChestCm:tailorChest,chestErrorCm:Math.round(Math.abs(selfChest-tailorChest)*100)/100,
        selfSleeveCm:selfSleeve,tailorSleeveCm:tailorSleeve,sleeveErrorCm:Math.round(Math.abs(selfSleeve-tailorSleeve)*100)/100,
        note:String(payload.note||"").slice(0,500),
      });
    }
    const medianChestErrorCm=median(cases.map((item)=>item.chestErrorCm));
    const medianSleeveErrorCm=median(cases.map((item)=>item.sleeveErrorCm));
    const chestPass=cases.length>=10 && medianChestErrorCm!==null && medianChestErrorCm<1.5;
    const sleevePass=cases.length>=10 && medianSleeveErrorCm!==null && medianSleeveErrorCm<1;
    return NextResponse.json({
      configured:true,
      cases:cases.slice(0,50),
      summary:{
        target:10,total:cases.length,
        medianChestErrorCm,medianSleeveErrorCm,
        chestPass,sleevePass,
        complete:chestPass&&sleevePass,
      },
    },{headers:{"cache-control":"private, no-store"}});
  }catch{
    return NextResponse.json({
      configured:true,
      cases:[],
      summary:{target:10,total:0,medianChestErrorCm:null,medianSleeveErrorCm:null,chestPass:false,sleevePass:false,complete:false},
    },{headers:{"cache-control":"private, no-store"}});
  }
}
