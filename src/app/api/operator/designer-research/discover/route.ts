import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { discoverFashionWebsites } from "@/lib/designer/research-source-discovery";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;

export async function GET(request:Request) {
  const jar=await cookies();
  const valid=await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if(!valid) return NextResponse.json({error:"Operator login required."},{status:401});

  const url=new URL(request.url);
  const requested=Number(url.searchParams.get("limit")||1000);
  const limit=Number.isFinite(requested)?Math.max(50,Math.min(1000,Math.round(requested))):1000;

  try {
    const sources=await discoverFashionWebsites(limit);
    return NextResponse.json({
      source:"Wikidata official-website statements",
      requested:limit,
      discovered:sources.length,
      sources,
    },{headers:{"cache-control":"no-store"}});
  } catch(error) {
    console.error("[designer-research/discover]",error);
    return NextResponse.json({error:"Fashion website discovery is temporarily unavailable."},{status:502});
  }
}
