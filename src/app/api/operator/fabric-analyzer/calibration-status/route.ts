import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { loadFabricAnalyzerCalibrationCases } from "@/lib/fabric-analyzer-store";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }
  const cases=await loadFabricAnalyzerCalibrationCases(30);
  const scored=cases.filter((item)=>typeof item.last_score==="number");
  const averageScore=scored.length
    ? Math.round(scored.reduce((sum,item)=>sum+Number(item.last_score||0),0)/scored.length*10)/10
    : null;
  return NextResponse.json({
    totalCases:cases.length,
    scoredCases:scored.length,
    averageScore,
    cases:cases.map((item)=>({
      id:item.id,
      sourceId:item.source_id,
      sourceUrl:item.source_url,
      notes:item.notes,
      lastScore:item.last_score,
      lastRunAt:item.last_run_at,
      lastResult:item.last_result,
    })),
  },{headers:{"cache-control":"private, no-store"}});
}
