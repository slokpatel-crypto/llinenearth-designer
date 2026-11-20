import { NextResponse } from "next/server";
import { createStyleDirectorLooks, type StyleDirectorAnswers } from "@/lib/style-director-agent";
import { createStyleDirectorPairingAlternatives } from "@/lib/designer/style-director-pairings";
import {
  createStyleDirectorFinishAlternatives, STYLE_DIRECTOR_FINISH_GROUPS,
  type StyleDirectorFinishKey,
} from "@/lib/designer/style-director-finishes";
import { loadDesignerFabricMetadata, applyDesignerFabricMetadataToStock } from "@/lib/designer-fabric-metadata";
import { loadDesignerFabricIntelligence } from "@/lib/fabric-intelligence-server";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";
import { createStyleDirectorHandoffToken } from "@/lib/designer/style-director-handoff";
import { designerFabricFromStock } from "@/lib/designer/engine";

export const runtime="nodejs";
const MAX_REQUEST_BYTES=8192;

function validAnswers(value:unknown):value is StyleDirectorAnswers {
  if(!value || typeof value!=="object" || Array.isArray(value)) return false;
  const a=value as Partial<StyleDirectorAnswers>;
  const values:Record<keyof StyleDirectorAnswers,readonly string[]>={
    occasion:["Wedding","Work","Date","Celebration","Travel","Everyday"],
    mood:["Quiet","Sharp","Relaxed","Statement"],
    time:["Day","Evening"],
    climate:["Hot","Indoor","Mixed"],
    garment:["shirt","trouser","suit","blazer"],
    colorDirection:["Light","Earthy","Blue","Dark","Surprise me"],
  };
  return Object.keys(a).length===6 && Object.entries(values).every(([key,choices])=>
    typeof a[key as keyof StyleDirectorAnswers]==="string" &&
    choices.includes(a[key as keyof StyleDirectorAnswers] as string));
}

async function readBoundedJson(request:Request):Promise<unknown>{
  if(request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json")
    throw new Error("Invalid JSON content type.");
  const declared=Number(request.headers.get("content-length")||0);
  if(!Number.isFinite(declared)||declared>MAX_REQUEST_BYTES) throw new Error("Request too large.");
  const reader=request.body?.getReader();
  if(!reader) throw new Error("Missing request body.");
  const chunks:Uint8Array[]=[];
  let size=0;
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size>MAX_REQUEST_BYTES) throw new Error("Request too large.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
  const bytes=new Uint8Array(size);let cursor=0;
  for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as unknown;}
  catch { throw new Error("Malformed JSON."); }
}

export async function POST(request:Request){
  let body:unknown;
  try { body=await readBoundedJson(request); }
  catch(e){
    const message=e instanceof Error?e.message:"Malformed request.";
    return NextResponse.json({error:message},{status:message==="Request too large."?413:400,headers:{"Cache-Control":"no-store"}});
  }
  if(!body||typeof body!=="object"||Array.isArray(body))
    return NextResponse.json({error:"Invalid finishing request."},{status:400});
  const v=body as Record<string,unknown>;
  const fields=["answers","lookId","shirtId","pantId","finishKey"];
  const choice=STYLE_DIRECTOR_FINISH_GROUPS.find(group=>group.key===v.finishKey);
  if(Object.keys(v).length!==fields.length || !fields.every(k=>Object.hasOwn(v,k)) || !validAnswers(v.answers)
    || !choice || !["lookId","shirtId","pantId"].every(k=>typeof v[k]==="string" && (v[k] as string).length>0 && (v[k] as string).length<=120))
    return NextResponse.json({error:"Choose an existing look, pairing and finish category."},{status:400,headers:{"Cache-Control":"no-store"}});

  try{
    const metadata=await loadDesignerFabricMetadata();
    const live=await applyLiveVerifiedStockAvailability(applyDesignerFabricMetadataToStock(metadata));
    const stock=live.stock;
    const ids=stock.filter(fabric=>fabric.inStock).map(fabric=>designerFabricFromStock(fabric).id);
    const intelligence=await loadDesignerFabricIntelligence(ids);
    const looks=createStyleDirectorLooks(v.answers,stock,intelligence);
    const original=looks.find(look=>look.id===v.lookId);
    if(!original?.realModel) return NextResponse.json({error:"The original look is no longer available."},{status:404,headers:{"Cache-Control":"no-store"}});
    const originalBase=original.realModel;
    const samePair=originalBase.shirtId===v.shirtId && originalBase.pantId===v.pantId;
    const base=samePair ? originalBase : createStyleDirectorPairingAlternatives(original,stock)
      .find(item=>item.shirtId===v.shirtId&&item.pantId===v.pantId)?.realModel;
    if(!base) return NextResponse.json({error:"This pairing is no longer eligible for refinements."},{status:404,headers:{"Cache-Control":"no-store"}});

    const alternatives=createStyleDirectorFinishAlternatives(base,choice.key as StyleDirectorFinishKey).map(item=>({
      ...item,
      handoffToken:createStyleDirectorHandoffToken({
        sourceLookId:original.id,shirtId:item.realModel.shirtId,pantId:item.realModel.pantId,
        occasion:item.realModel.occasion,climate:item.realModel.climate,intention:item.realModel.intention,
        style:item.realModel.style,styleSpec:item.realModel.styleSpec,
      }),
    }));
    return NextResponse.json({
      sourceLookId:original.id,shirtId:base.shirtId,pantId:base.pantId,
      finishKey:choice.key,alternatives,engine:"linen-style-director-finishes-v1",provisional:true,
    },{headers:{"Cache-Control":"no-store"}});
  } catch(error){
    console.error("[style-director-finishes]",error);
    return NextResponse.json({error:"Finishing directions are temporarily unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
