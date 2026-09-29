import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { analyzeFashionResearchSource, type ResearchSourceAnalysisInput } from "@/lib/designer/research-source-analysis";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;

function valid(body:unknown):body is ResearchSourceAnalysisInput {
  if(!body || typeof body!=="object") return false;
  const value=body as Partial<ResearchSourceAnalysisInput>;
  return Boolean(
    value.name && String(value.name).length<=180 &&
    value.url && String(value.url).length<=700 &&
    value.sourceType &&
    ["museum","designer","runway","tailoring","archive","operator"].includes(String(value.sourceType))
  );
}

export async function POST(request:Request) {
  const jar=await cookies();
  const authorized=await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if(!authorized) return NextResponse.json({error:"Operator login required."},{status:401});

  try {
    const body=await request.json() as unknown;
    if(!valid(body)) return NextResponse.json({error:"A valid public research source is required."},{status:400});
    const analysis=await analyzeFashionResearchSource(body);
    return NextResponse.json({analysis},{headers:{"cache-control":"no-store"}});
  } catch(error) {
    console.error("[designer-research/analyze]",error);
    return NextResponse.json({
      error:error instanceof Error ? error.message : "Research source could not be analyzed.",
    },{status:502});
  }
}
