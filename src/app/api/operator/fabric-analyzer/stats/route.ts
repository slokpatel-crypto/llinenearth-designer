import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { loadFabricAnalyzerStats } from "@/lib/fabric-analyzer-store";
import { FABRIC_REFERENCE_COUNTS } from "@/lib/fabric-analyzer-reference-index";
import { REAL_MENSWEAR_FABRIC_EXAMPLE_COUNT } from "@/lib/fabric-analyzer-real-examples";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET() {
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }
  const database=await loadFabricAnalyzerStats();
  return NextResponse.json({
    engine:"private-fabric-analyzer-v4",
    visibleOnCustomerWeb:false,
    corpus:{
      materials:FABRIC_REFERENCE_COUNTS.materials,
      patterns:FABRIC_REFERENCE_COUNTS.patterns,
      colors:FABRIC_REFERENCE_COUNTS.colors,
      sources:FABRIC_REFERENCE_COUNTS.sources,
      realExamples:REAL_MENSWEAR_FABRIC_EXAMPLE_COUNT,
    },
    database,
  },{headers:{"cache-control":"private, no-store, max-age=0","x-content-type-options":"nosniff"}});
}
