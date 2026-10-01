import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime="nodejs";

type Row={at:string;payload?:Record<string,unknown>};

function finite(value:unknown){
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
function median(values:number[]){
  if(!values.length) return null;
  const ordered=[...values].sort((a,b)=>a-b);
  const m=Math.floor(ordered.length/2);
  const value=ordered.length%2?ordered[m]:(ordered[m-1]+ordered[m])/2;
  return Math.round(value*100)/100;
}

export async function GET(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }
  const cloud=getSupabaseAdminConfig();
  if(!cloud) return NextResponse.json({
    configured:false,cases:[],
    summary:{total:0,shirtCases:0,trouserCases:0,medianShirtMetres:null,medianTrouserMetres:null,readyForModel:false},
  },{headers:{"cache-control":"private, no-store"}});

  try{
    const params=new URLSearchParams({
      select:"at,payload",type:"eq.operator_note",source:"eq.operator",order:"at.desc",limit:"800",
    });
    const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},cache:"no-store",
    });
    if(!response.ok) throw new Error("read failed");
    const rows=await response.json() as Row[];
    const seen=new Set<string>();
    const cases:Array<{
      at:string;caseId:string;revisionId:string;garment:"shirt"|"trouser";fabricId:string;
      fabricWidthCm:number;actualMetres:number;patternRepeatMm:number|null;patternMatching:boolean;
      cutContext:string;note:string;
    }>=[];
    for(const row of rows){
      const p=row.payload||{};
      if(String(p.subtype||"")!=="production_usage_case") continue;
      const caseId=String(p.caseId||"").slice(0,80);
      const garment=String(p.garment||"");
      const fabricWidthCm=finite(p.fabricWidthCm),actualMetres=finite(p.actualMetres);
      if(!caseId||seen.has(caseId)||!["shirt","trouser"].includes(garment)||fabricWidthCm===null||actualMetres===null) continue;
      seen.add(caseId);
      const repeat=finite(p.patternRepeatMm);
      cases.push({
        at:row.at,caseId,
        revisionId:String(p.revisionId||"").slice(0,180),
        garment:garment as "shirt"|"trouser",
        fabricId:String(p.fabricId||"").slice(0,160),
        fabricWidthCm,actualMetres,
        patternRepeatMm:repeat&&repeat>0?repeat:null,
        patternMatching:p.patternMatching===true,
        cutContext:String(p.cutContext||"").slice(0,160),
        note:String(p.note||"").slice(0,600),
      });
    }
    const shirts=cases.filter((item)=>item.garment==="shirt");
    const trousers=cases.filter((item)=>item.garment==="trouser");
    return NextResponse.json({
      configured:true,cases:cases.slice(0,100),
      summary:{
        total:cases.length,shirtCases:shirts.length,trouserCases:trousers.length,
        medianShirtMetres:median(shirts.map((item)=>item.actualMetres)),
        medianTrouserMetres:median(trousers.map((item)=>item.actualMetres)),
        readyForModel:shirts.length>=20&&trousers.length>=20,
      },
    },{headers:{"cache-control":"private, no-store"}});
  }catch{
    return NextResponse.json({
      configured:true,cases:[],
      summary:{total:0,shirtCases:0,trouserCases:0,medianShirtMetres:null,medianTrouserMetres:null,readyForModel:false},
    },{headers:{"cache-control":"private, no-store"}});
  }
}
