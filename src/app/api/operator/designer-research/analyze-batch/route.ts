import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import {
  analyzeFashionResearchBatch,
  type ResearchSourceAnalysisInput,
} from "@/lib/designer/research-source-analysis";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

function validSource(value:unknown):value is ResearchSourceAnalysisInput {
  if(!value || typeof value!=="object") return false;
  const item=value as Partial<ResearchSourceAnalysisInput>;
  return Boolean(
    item.name && String(item.name).length<=180 &&
    item.url && String(item.url).length<=700 &&
    item.sourceType &&
    ["museum","designer","runway","tailoring","archive","operator"].includes(String(item.sourceType))
  );
}

export async function POST(request:Request) {
  const jar=await cookies();
  const authorized=await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if(!authorized) return NextResponse.json({error:"Operator login required."},{status:401});

  try {
    const body=await request.json() as {sources?:unknown};
    const sources=Array.isArray(body?.sources)?body.sources.filter(validSource).slice(0,4):[];
    if(!sources.length) return NextResponse.json({error:"Choose up to four public research sources."},{status:400});
    const results=await analyzeFashionResearchBatch(sources,4);
    return NextResponse.json({
      requested:sources.length,
      completed:results.filter((item)=>Boolean(item.analysis)).length,
      results,
    },{headers:{"cache-control":"no-store"}});
  } catch(error) {
    console.error("[designer-research/analyze-batch]",error);
    return NextResponse.json({error:"Batch research synthesis failed."},{status:502});
  }
}
