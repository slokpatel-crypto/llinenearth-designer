import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FABRIC_STOCK } from "@/lib/fabric-stock";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime="nodejs";

type BulkRow={
  fabricId?:unknown;
  availability?:unknown;
  weightGsm?:unknown;
  weightClass?:unknown;
  weave?:unknown;
  texture?:unknown;
  drape?:unknown;
  seasonTags?:unknown;
  formalityScore?:unknown;
  roleTags?:unknown;
  note?:unknown;
};

const fabricIds=new Set(FABRIC_STOCK.map((fabric)=>fabric.id));
const clean=(value:unknown,max=160)=>String(value??"").replace(/\s+/g," ").trim().slice(0,max);
const list=(value:unknown,maxItems:number,maxLength:number)=>{
  const source=Array.isArray(value)?value:String(value??"").split(/[;,|]/);
  return [...new Set(source.map((item)=>clean(item,maxLength)).filter(Boolean))].slice(0,maxItems);
};

function normalize(row:BulkRow) {
  const fabricId=clean(row.fabricId,140);
  if(!fabricIds.has(fabricId)) return null;

  const availability=clean(row.availability,20);
  const weightClass=clean(row.weightClass,20);
  const drape=clean(row.drape,20).toLowerCase();
  const gsm=Number(row.weightGsm);
  const formality=Number(row.formalityScore);
  const seasons=list(row.seasonTags,5,30).filter((item)=>["Spring","Summer","Autumn","Winter","All-season"].includes(item));
  const roles=list(row.roleTags,2,30).filter((item)=>["base_safe","accent_safe"].includes(item));
  const weave=clean(row.weave,100);
  const texture=clean(row.texture,100);
  const note=clean(row.note,500);

  const payload={
    subtype:"designer_fabric_metadata",
    fabricId,
    availability:["available","unavailable"].includes(availability)?availability:"unknown",
    ...(Number.isFinite(gsm)&&gsm>=40&&gsm<=1000?{weightGsm:Math.round(gsm)}:{}),
    ...(["Light","Medium","Heavy"].includes(weightClass)?{weightClass}:{}),
    ...(weave?{weave}:{}),
    ...(texture?{texture}:{}),
    ...(["fluid","soft","medium","structured"].includes(drape)?{drape}:{}),
    ...(seasons.length?{seasonTags:seasons}:{}),
    ...(Number.isFinite(formality)&&formality>=1&&formality<=5?{formalityScore:Math.round(formality*10)/10}:{}),
    ...(roles.length?{roleTags:roles}:{}),
    ...(note?{note}:{}),
  };

  const meaningful=payload.availability!=="unknown"
    || "weightGsm" in payload
    || "weightClass" in payload
    || "weave" in payload
    || "texture" in payload
    || "drape" in payload
    || "seasonTags" in payload
    || "formalityScore" in payload
    || "roleTags" in payload
    || "note" in payload;
  return meaningful?payload:null;
}

export async function POST(request:Request) {
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }

  try{
    const body=await request.json() as {rows?:BulkRow[]};
    if(!Array.isArray(body.rows) || body.rows.length<1 || body.rows.length>200) {
      return NextResponse.json({error:"Provide between 1 and 200 fabric metadata rows."},{status:400});
    }
    const normalized=body.rows.map(normalize).filter((row):row is NonNullable<ReturnType<typeof normalize>>=>Boolean(row));
    if(!normalized.length) return NextResponse.json({error:"No valid evidence rows contained verified values."},{status:400});

    const cloud=getSupabaseAdminConfig();
    if(!cloud) return NextResponse.json({stored:false,provider:"not_configured",accepted:normalized.length},{status:202});

    const now=Date.now();
    const events=normalized.map((payload,index)=>({
      id:`EV-FABRIC-BULK-${now}-${index}-${crypto.randomUUID().slice(0,8)}`,
      session_id:"DESIGNER-DATA-BULK",
      type:"operator_note",
      at:new Date(now+index).toISOString(),
      source:"operator",
      payload,
    }));

    const response=await fetch(`${cloud.url}/rest/v1/style_events`,{
      method:"POST",
      headers:{
        ...supabaseAdminHeaders(cloud),
        "content-type":"application/json",
        prefer:"return=minimal,resolution=ignore-duplicates",
      },
      body:JSON.stringify(events),
      cache:"no-store",
    });
    if(!response.ok) {
      const detail=(await response.text()).slice(0,300);
      console.error("[operator/designer-data/bulk]",response.status,detail);
      return NextResponse.json({error:"Bulk fabric evidence could not be stored."},{status:502});
    }
    return NextResponse.json({stored:true,provider:"supabase",accepted:events.length,submitted:body.rows.length});
  }catch(error){
    console.error("[operator/designer-data/bulk]",error);
    return NextResponse.json({error:"Bulk fabric evidence import failed."},{status:500});
  }
}
