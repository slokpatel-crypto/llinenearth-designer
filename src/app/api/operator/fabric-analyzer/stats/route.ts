import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { loadFabricAnalysesForFabricIds, loadFabricAnalyzerStats } from "@/lib/fabric-analyzer-store";
import { FABRIC_STOCK } from "@/lib/fabric-stock";
import { FABRIC_REFERENCE_COUNTS } from "@/lib/fabric-analyzer-reference-index";
import { REAL_MENSWEAR_FABRIC_EXAMPLE_COUNT } from "@/lib/fabric-analyzer-real-examples";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET() {
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }
  const [database,bound]=await Promise.all([
    loadFabricAnalyzerStats(),
    loadFabricAnalysesForFabricIds(FABRIC_STOCK.map((fabric)=>fabric.id),{includeUnreviewed:true}),
  ]);
  const reviewedFabrics=bound.filter((row)=>row.review_status==="approved" || row.review_status==="corrected").length;
  const pendingFabrics=bound.filter((row)=>row.review_status==="unreviewed").length;
  const groundTruth={
    target:50,
    reviewedFabrics,
    pendingFabrics,
    stockBoundProfiles:bound.length,
    remaining:Math.max(0,50-reviewedFabrics),
  };
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
    groundTruth,
  },{headers:{"cache-control":"private, no-store, max-age=0","x-content-type-options":"nosniff"}});
}
