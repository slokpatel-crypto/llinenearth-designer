import { NextResponse } from "next/server";
import { createStyleDirectorLooks, type StyleDirectorAnswers } from "@/lib/style-director-agent";
import { createStyleDirectorPairingAlternatives } from "@/lib/designer/style-director-pairings";
import { loadDesignerFabricMetadata, applyDesignerFabricMetadataToStock } from "@/lib/designer-fabric-metadata";
import { loadDesignerFabricIntelligence } from "@/lib/fabric-intelligence-server";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";
import { createStyleDirectorHandoffToken } from "@/lib/designer/style-director-handoff";
import { designerFabricFromStock } from "@/lib/designer/engine";

export const runtime="nodejs";
const MAX_BODY_BYTES=8192;

function validAnswers(value: unknown): value is StyleDirectorAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const a = value as Partial<StyleDirectorAnswers>;
  const checks: [keyof StyleDirectorAnswers, readonly string[]][] = [
    ["occasion",["Wedding","Work","Date","Celebration","Travel","Everyday"]],
    ["mood",["Quiet","Sharp","Relaxed","Statement"]],
    ["time",["Day","Evening"]],
    ["climate",["Hot","Indoor","Mixed"]],
    ["garment",["shirt","trouser","suit","blazer"]],
    ["colorDirection",["Light","Earthy","Blue","Dark","Surprise me"]],
  ];
  return Object.keys(a).length===checks.length &&
    checks.every(([key,choices])=>typeof a[key]==="string" && choices.includes(a[key] as string));
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentType=request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType!=="application/json") throw new Error("Invalid JSON content type.");
  const sizeHeader=Number(request.headers.get("content-length")||0);
  if (!Number.isFinite(sizeHeader) || sizeHeader>MAX_BODY_BYTES) throw new Error("Request too large.");
  const reader=request.body?.getReader();
  if (!reader) throw new Error("Missing request body.");
  const chunks:Uint8Array[]=[];
  let total=0;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done) break;
      total+=value.byteLength;
      if(total>MAX_BODY_BYTES) throw new Error("Request too large.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
  const payload=new Uint8Array(total);
  let offset=0;
  for(const part of chunks){payload.set(part,offset);offset+=part.byteLength;}
  try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(payload)) as unknown;}
  catch{throw new Error("Malformed JSON.");}
}

export async function POST(request:Request) {
  let body:unknown;
  try { body=await readBoundedJson(request); }
  catch(error) {
    const message=error instanceof Error ? error.message : "Malformed request.";
    return NextResponse.json({error:message},{status:message==="Request too large."?413:400,headers:{"Cache-Control":"no-store"}});
  }
  if(!body || typeof body!=="object" || Array.isArray(body)) return NextResponse.json({error:"Invalid pairing request."},{status:400});
  const input=body as {answers?:unknown;lookId?:unknown};
  if(Object.keys(input).length!==2 || !validAnswers(input.answers) || typeof input.lookId!=="string" || input.lookId.length<1 || input.lookId.length>120)
    return NextResponse.json({error:"Choose one original Style Director look."},{status:400});

  try {
    const metadata=await loadDesignerFabricMetadata();
    const live=await applyLiveVerifiedStockAvailability(applyDesignerFabricMetadataToStock(metadata));
    const stock=live.stock;
    const ids=stock.filter((fabric)=>fabric.inStock).map((fabric)=>designerFabricFromStock(fabric).id);
    const intelligence=await loadDesignerFabricIntelligence(ids);
    const looks=createStyleDirectorLooks(input.answers,stock,intelligence);
    const original=looks.find((look)=>look.id===input.lookId);
    if(!original?.realModel) return NextResponse.json({error:"This exact look is no longer available for pairing."},{status:404,headers:{"Cache-Control":"no-store"}});
    const alternatives=createStyleDirectorPairingAlternatives(original,stock).map((item)=>({
      ...item,
      handoffToken:createStyleDirectorHandoffToken({
        sourceLookId:original.id,
        shirtId:item.realModel.shirtId,pantId:item.realModel.pantId,
        occasion:item.realModel.occasion,climate:item.realModel.climate,
        intention:item.realModel.intention,style:item.realModel.style,styleSpec:item.realModel.styleSpec,
      }),
    }));
    return NextResponse.json({
      sourceLookId:original.id,
      heroFabricId:original.fabric.id,
      alternatives,
      engine:"linen-style-director-pairings-v1",
      provisional:true,
    },{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    console.error("[style-director-pairings]",error);
    return NextResponse.json({error:"Pairing alternatives are temporarily unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
