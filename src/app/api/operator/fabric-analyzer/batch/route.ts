import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  analyzeMenswearFabricWithStore,
  analyzeMenswearReferencePage,
  type FabricAnalyzerContext,
} from "@/lib/fabric-analyzer";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { validateVerifiedPhysicalEvidence } from "@/lib/physical-evidence-provenance";

export const runtime="nodejs";
export const maxDuration=60;

type BatchItem={
  fabricId?:string;
  imageUrl?:string;
  macroImageUrl?:string;
  foldImageUrl?:string;
  sourcePageUrl?:string;
  sourceId?:string;
  declaredMaterial?:string;
  declaredFabricType?:string;
  supplierColorName?:string;
  supplierPatternName?:string;
  notes?:string;
  swatchRealWidthMm?:number;
  repeatRealMm?:number;
  verifiedGsm?:number;
  verifiedDrape?:"Fluid"|"Balanced"|"Structured";
  verifiedFiberContent?:string;
  verifiedStructure?:number;
  verifiedBreathability?:number;
  verifiedWrinkleResistance?:number;
  verifiedStretch?:number;
  verifiedPhysicalSourceUrl?:string;
  verifiedPhysicalEvidenceNote?:string;
  force?:boolean;
};

function json(body:unknown,init?:ResponseInit) {
  const response=NextResponse.json(body,init);
  response.headers.set("cache-control","private, no-store, max-age=0");
  response.headers.set("x-content-type-options","nosniff");
  return response;
}

async function authorized() {
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

function sameOrigin(request:Request) {
  const origin=request.headers.get("origin");
  if(!origin) return true;
  try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}

function clean(value:unknown,limit:number) {
  return String(value??"").replace(/\s+/g," ").trim().slice(0,limit);
}

function physicalNumber(value:unknown) {
  return typeof value==="number" && Number.isFinite(value) ? value : undefined;
}

async function runItem(item:BatchItem,index:number) {
  try {
    const fabricId=clean(item.fabricId,160) || undefined;
    const sourcePageUrl=clean(item.sourcePageUrl,1800);
    const imageUrl=clean(item.imageUrl,1800);

    if(sourcePageUrl && !imageUrl) {
      const result=await analyzeMenswearReferencePage(sourcePageUrl,{persist:true,fabricId});
      return {index,fabricId,ok:true,mode:"official-reference-page",reference:result.reference,run:result.run};
    }

    if(!imageUrl) return {index,fabricId,ok:false,error:"Missing trusted imageUrl or approved sourcePageUrl."};

    const input:FabricAnalyzerContext={
      fabricId,
      imageUrl,
      macroImageUrl:clean(item.macroImageUrl,1800) || undefined,
      foldImageUrl:clean(item.foldImageUrl,1800) || undefined,
      sourcePageUrl:sourcePageUrl || undefined,
      sourceId:clean(item.sourceId,80) || undefined,
      declaredMaterial:clean(item.declaredMaterial,120) || undefined,
      declaredFabricType:clean(item.declaredFabricType,120) || undefined,
      supplierColorName:clean(item.supplierColorName,120) || undefined,
      supplierPatternName:clean(item.supplierPatternName,120) || undefined,
      notes:clean(item.notes,500) || undefined,
      swatchRealWidthMm:Number.isFinite(Number(item.swatchRealWidthMm)) ? Number(item.swatchRealWidthMm) : undefined,
      repeatRealMm:Number.isFinite(Number(item.repeatRealMm)) ? Number(item.repeatRealMm) : undefined,
      verifiedGsm:Number.isFinite(Number(item.verifiedGsm)) ? Number(item.verifiedGsm) : undefined,
      verifiedDrape:["Fluid","Balanced","Structured"].includes(String(item.verifiedDrape)) ? item.verifiedDrape : undefined,
      verifiedFiberContent:clean(item.verifiedFiberContent,220) || undefined,
      verifiedStructure:physicalNumber(item.verifiedStructure),
      verifiedBreathability:physicalNumber(item.verifiedBreathability),
      verifiedWrinkleResistance:physicalNumber(item.verifiedWrinkleResistance),
      verifiedStretch:physicalNumber(item.verifiedStretch),
      verifiedPhysicalSourceUrl:clean(item.verifiedPhysicalSourceUrl,1800) || undefined,
      verifiedPhysicalEvidenceNote:clean(item.verifiedPhysicalEvidenceNote,500) || undefined,
    };
    validateVerifiedPhysicalEvidence(input);
    const run=await analyzeMenswearFabricWithStore(input,{reuseReviewed:item.force!==true,persist:true});
    return {index,fabricId,ok:true,mode:"private-fabric-analyzer-v4",run};
  } catch(error) {
    return {index,fabricId:clean(item.fabricId,160)||undefined,ok:false,error:error instanceof Error?error.message:"Analysis failed."};
  }
}

export async function POST(request:Request) {
  if(!await authorized()) return json({error:"Unauthorized."},{status:401});
  if(!sameOrigin(request)) return json({error:"Cross-site Analyzer requests are not allowed."},{status:403});
  const length=Number(request.headers.get("content-length")||0);
  if(length>240_000) return json({error:"Batch request is too large."},{status:413});

  try {
    const body=await request.json() as {items?:BatchItem[]};
    const items=Array.isArray(body.items)?body.items.slice(0,12):[];
    if(!items.length) return json({error:"Provide at least one fabric analysis item."},{status:400});

    const results:Array<Awaited<ReturnType<typeof runItem>>>=new Array(items.length);
    let cursor=0;
    const worker=async()=>{
      while(true) {
        const index=cursor++;
        if(index>=items.length) return;
        results[index]=await runItem(items[index],index);
      }
    };
    await Promise.all([worker(),worker()]);
    return json({
      engine:"private-fabric-analyzer-batch-v1",
      total:results.length,
      succeeded:results.filter((item)=>item.ok).length,
      failed:results.filter((item)=>!item.ok).length,
      results,
    });
  } catch(error) {
    console.error("[operator/fabric-analyzer/batch]",error);
    return json({error:"Fabric Analyzer batch failed."},{status:400});
  }
}
