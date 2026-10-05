import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  analyzeMenswearFabricWithStore,
  analyzeMenswearReferencePage,
  type FabricAnalyzerContext,
} from "@/lib/fabric-analyzer";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { validateVerifiedPhysicalEvidence } from "@/lib/physical-evidence-provenance";
import { DIRECT_FABRIC_CAPTURE_MAX_CHARS, isDirectFabricCapture } from "@/lib/fabric-capture-input";

export const runtime="nodejs";
export const maxDuration=60;

function json(body:unknown,init?:ResponseInit) {
  const response=NextResponse.json(body,init);
  response.headers.set("cache-control","private, no-store, max-age=0");
  response.headers.set("pragma","no-cache");
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

function physicalIndexInput(value:unknown) {
  return typeof value==="number" && Number.isFinite(value) ? value : undefined;
}

function imageInput(value:unknown) {
  const raw=String(value??"").trim();
  if(isDirectFabricCapture(raw)) {
    if(raw.length>DIRECT_FABRIC_CAPTURE_MAX_CHARS) throw new Error("Direct fabric capture is too large.");
    return raw;
  }
  return clean(raw,1800);
}

export async function POST(request:Request) {
  if(!await authorized()) return json({error:"Unauthorized."},{status:401});
  if(!sameOrigin(request)) return json({error:"Cross-site Analyzer requests are not allowed."},{status:403});
  const length=Number(request.headers.get("content-length")||0);
  if(length>3_800_000) return json({error:"Analyzer request is too large."},{status:413});

  try {
    const body=await request.json() as Record<string,unknown>;
    const fabricId=clean(body.fabricId,160) || undefined;
    const sourcePageUrl=clean(body.sourcePageUrl,1800);
    const imageUrl=imageInput(body.imageUrl);
    const force=body.force===true;

    if(sourcePageUrl && !imageUrl) {
      const result=await analyzeMenswearReferencePage(sourcePageUrl,{persist:true,fabricId});
      return json({
        mode:"official-reference-page",
        reference:result.reference,
        run:result.run,
      });
    }

    if(!imageUrl) return json({error:"Provide a trusted image URL, authenticated direct capture, or approved source page."},{status:400});

    const input:FabricAnalyzerContext={
      fabricId,
      imageUrl,
      macroImageUrl:imageInput(body.macroImageUrl) || undefined,
      foldImageUrl:imageInput(body.foldImageUrl) || undefined,
      sourcePageUrl:sourcePageUrl || undefined,
      sourceId:clean(body.sourceId,80) || undefined,
      declaredMaterial:clean(body.declaredMaterial,120) || undefined,
      declaredFabricType:clean(body.declaredFabricType,120) || undefined,
      supplierColorName:clean(body.supplierColorName,120) || undefined,
      supplierPatternName:clean(body.supplierPatternName,120) || undefined,
      notes:clean(body.notes,500) || undefined,
      swatchRealWidthMm:Number.isFinite(Number(body.swatchRealWidthMm)) ? Number(body.swatchRealWidthMm) : undefined,
      repeatRealMm:Number.isFinite(Number(body.repeatRealMm)) ? Number(body.repeatRealMm) : undefined,
      verifiedGsm:Number.isFinite(Number(body.verifiedGsm)) ? Number(body.verifiedGsm) : undefined,
      verifiedDrape:["Fluid","Balanced","Structured"].includes(String(body.verifiedDrape)) ? body.verifiedDrape as FabricAnalyzerContext["verifiedDrape"] : undefined,
      verifiedFiberContent:clean(body.verifiedFiberContent,220) || undefined,
      verifiedStructure:physicalIndexInput(body.verifiedStructure),
      verifiedBreathability:physicalIndexInput(body.verifiedBreathability),
      verifiedWrinkleResistance:physicalIndexInput(body.verifiedWrinkleResistance),
      verifiedStretch:physicalIndexInput(body.verifiedStretch),
      verifiedPhysicalSourceUrl:clean(body.verifiedPhysicalSourceUrl,1800) || undefined,
      verifiedPhysicalEvidenceNote:clean(body.verifiedPhysicalEvidenceNote,500) || undefined,
    };

    validateVerifiedPhysicalEvidence(input);

    const run=await analyzeMenswearFabricWithStore(input,{reuseReviewed:!force,persist:true});
    return json({mode:"private-fabric-analyzer-v4",run});
  } catch(error) {
    console.error("[operator/fabric-analyzer/analyze]",error);
    return json({error:error instanceof Error ? error.message : "Fabric Analyzer failed."},{status:400});
  }
}
