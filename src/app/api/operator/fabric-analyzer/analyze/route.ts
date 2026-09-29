import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  analyzeMenswearFabricWithStore,
  analyzeMenswearReferencePage,
  type FabricAnalyzerContext,
} from "@/lib/fabric-analyzer";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";

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

export async function POST(request:Request) {
  if(!await authorized()) return json({error:"Unauthorized."},{status:401});
  if(!sameOrigin(request)) return json({error:"Cross-site Analyzer requests are not allowed."},{status:403});
  const length=Number(request.headers.get("content-length")||0);
  if(length>80_000) return json({error:"Analyzer request is too large."},{status:413});

  try {
    const body=await request.json() as Record<string,unknown>;
    const fabricId=clean(body.fabricId,160) || undefined;
    const sourcePageUrl=clean(body.sourcePageUrl,1800);
    const imageUrl=clean(body.imageUrl,1800);
    const force=body.force===true;

    if(sourcePageUrl && !imageUrl) {
      const result=await analyzeMenswearReferencePage(sourcePageUrl,{persist:true,fabricId});
      return json({
        mode:"official-reference-page",
        reference:result.reference,
        run:result.run,
      });
    }

    if(!imageUrl) return json({error:"Provide a trusted imageUrl or approved sourcePageUrl."},{status:400});

    const input:FabricAnalyzerContext={
      fabricId,
      imageUrl,
      macroImageUrl:clean(body.macroImageUrl,1800) || undefined,
      foldImageUrl:clean(body.foldImageUrl,1800) || undefined,
      sourcePageUrl:sourcePageUrl || undefined,
      sourceId:clean(body.sourceId,80) || undefined,
      declaredMaterial:clean(body.declaredMaterial,120) || undefined,
      declaredFabricType:clean(body.declaredFabricType,120) || undefined,
      supplierColorName:clean(body.supplierColorName,120) || undefined,
      supplierPatternName:clean(body.supplierPatternName,120) || undefined,
      notes:clean(body.notes,500) || undefined,
      swatchRealWidthMm:Number.isFinite(Number(body.swatchRealWidthMm)) ? Number(body.swatchRealWidthMm) : undefined,
      repeatRealMm:Number.isFinite(Number(body.repeatRealMm)) ? Number(body.repeatRealMm) : undefined,
    };

    const run=await analyzeMenswearFabricWithStore(input,{reuseReviewed:!force,persist:true});
    return json({mode:"private-fabric-analyzer-v4",run});
  } catch(error) {
    console.error("[operator/fabric-analyzer/analyze]",error);
    return json({error:error instanceof Error ? error.message : "Fabric Analyzer failed."},{status:400});
  }
}
