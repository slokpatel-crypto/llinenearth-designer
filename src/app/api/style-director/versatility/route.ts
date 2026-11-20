import { NextResponse } from "next/server";
import { createStyleDirectorLooks, type StyleDirectorAnswers } from "@/lib/style-director-agent";
import { createStyleDirectorPairingAlternatives } from "@/lib/designer/style-director-pairings";
import {
  createStyleDirectorFinishAlternatives, STYLE_DIRECTOR_FINISH_GROUPS, type StyleDirectorFinishKey,
} from "@/lib/designer/style-director-finishes";
import { evaluateStyleDirectorVersatility } from "@/lib/designer/style-director-versatility";
import { loadDesignerFabricMetadata, applyDesignerFabricMetadataToStock } from "@/lib/designer-fabric-metadata";
import { loadDesignerFabricIntelligence } from "@/lib/fabric-intelligence-server";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";
import { designerFabricFromStock } from "@/lib/designer/engine";

export const runtime="nodejs";
const MAX_BYTES=8192;

function answersAreValid(value:unknown):value is StyleDirectorAnswers {
  if(!value||typeof value!=="object"||Array.isArray(value)) return false;
  const a=value as Record<string,unknown>;
  const fields:Record<keyof StyleDirectorAnswers,readonly string[]>={
    occasion:["Wedding","Work","Date","Celebration","Travel","Everyday"],
    mood:["Quiet","Sharp","Relaxed","Statement"],
    time:["Day","Evening"],
    climate:["Hot","Indoor","Mixed"],
    garment:["shirt","trouser","suit","blazer"],
    colorDirection:["Light","Earthy","Blue","Dark","Surprise me"],
  };
  return Object.keys(a).length===6 && Object.entries(fields).every(([key,values])=>typeof a[key]==="string"&&values.includes(a[key] as string));
}

async function boundedJson(request:Request):Promise<unknown> {
  if(request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json")
    throw new Error("Invalid JSON content type.");
  const declared=Number(request.headers.get("content-length")||0);
  if(!Number.isFinite(declared)||declared>MAX_BYTES) throw new Error("Request too large.");
  const reader=request.body?.getReader();
  if(!reader) throw new Error("Missing request body.");
  const chunks:Uint8Array[]=[];let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size>MAX_BYTES) throw new Error("Request too large.");
      chunks.push(value);
    }
  }finally{
    await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
  const data=new Uint8Array(size);let i=0;
  for(const part of chunks){data.set(part,i);i+=part.byteLength;}
  try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(data)) as unknown;}
  catch{throw new Error("Malformed JSON.");}
}

export async function POST(request:Request){
  let payload:unknown;
  try{payload=await boundedJson(request);}
  catch(e){
    const message=e instanceof Error?e.message:"Malformed request.";
    return NextResponse.json({error:message},{status:message==="Request too large."?413:400,headers:{"Cache-Control":"no-store"}});
  }
  if(!payload||typeof payload!=="object"||Array.isArray(payload))
    return NextResponse.json({error:"Invalid versatility request."},{status:400,headers:{"Cache-Control":"no-store"}});
  const input=payload as Record<string,unknown>;
  const expected=["answers","lookId","shirtId","pantId","finishKey","finishId"];
  const selectedKey=input.finishKey;
  const selectedId=input.finishId;
  const finishIsValid=(selectedKey===null&&selectedId===null)
    || (typeof selectedKey==="string" && STYLE_DIRECTOR_FINISH_GROUPS.some(g=>g.key===selectedKey)
      && typeof selectedId==="string" && selectedId.length>0 && selectedId.length<=120);
  if(Object.keys(input).length!==expected.length || !expected.every(key=>Object.hasOwn(input,key))
    || !answersAreValid(input.answers) || !finishIsValid
    || !["lookId","shirtId","pantId"].every(k=>typeof input[k]==="string"&&(input[k] as string).length>0&&(input[k] as string).length<=120))
    return NextResponse.json({error:"Select an existing Style Director outfit and finish."},{status:400,headers:{"Cache-Control":"no-store"}});

  try{
    const metadata=await loadDesignerFabricMetadata();
    const live=await applyLiveVerifiedStockAvailability(applyDesignerFabricMetadataToStock(metadata));
    const stock=live.stock;
    const intelligence=await loadDesignerFabricIntelligence(stock.filter(f=>f.inStock).map(f=>designerFabricFromStock(f).id));
    const original=createStyleDirectorLooks(input.answers,stock,intelligence).find(look=>look.id===input.lookId);
    if(!original?.realModel)
      return NextResponse.json({error:"The source look is no longer available."},{status:404,headers:{"Cache-Control":"no-store"}});
    const base=original.realModel;
    const requested=base.shirtId===input.shirtId&&base.pantId===input.pantId
      ? base : createStyleDirectorPairingAlternatives(original,stock)
        .find(pair=>pair.shirtId===input.shirtId&&pair.pantId===input.pantId)?.realModel;
    if(!requested)
      return NextResponse.json({error:"This fabric pairing is no longer eligible."},{status:404,headers:{"Cache-Control":"no-store"}});
    const chosen=selectedKey===null?requested:
      createStyleDirectorFinishAlternatives(requested,selectedKey as StyleDirectorFinishKey)
        .find(item=>item.id===selectedId)?.realModel;
    if(!chosen)
      return NextResponse.json({error:"This finishing detail is no longer eligible."},{status:404,headers:{"Cache-Control":"no-store"}});
    return NextResponse.json({
      sourceLookId:original.id,
      shirtId:chosen.shirtId,pantId:chosen.pantId,
      finishId:selectedId,
      engine:"linen-style-director-versatility-v1",
      provisional:true,
      rows:evaluateStyleDirectorVersatility(chosen),
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("[style-director-versatility]",error);
    return NextResponse.json({error:"Outfit versatility is temporarily unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
