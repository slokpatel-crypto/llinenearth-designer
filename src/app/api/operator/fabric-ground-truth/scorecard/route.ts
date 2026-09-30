import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { loadFabricGroundTruthLabels } from "@/lib/fabric-ground-truth-labels";
import { scoreFabricGroundTruth } from "@/lib/fabric-ground-truth-scorecard";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const MIN_LABELS=40;

export async function GET(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) return NextResponse.json({error:"Unauthorized."},{status:401});
  const loaded=await loadFabricGroundTruthLabels();
  const score=scoreFabricGroundTruth([...loaded.labels.values()]);
  return NextResponse.json({
    configured:loaded.configured,
    explicitLabels:loaded.explicitLabels,
    backfilledLabels:loaded.backfilledLabels,
    minimumLabels:MIN_LABELS,
    reportable:score.uniqueFabrics>=MIN_LABELS,
    remaining:Math.max(0,MIN_LABELS-score.uniqueFabrics),
    ...score,
    interpretation:"Agreement compares Analyzer output with the final owner-labelled visual and styling fields. Physical material facts remain separate evidence.",
  },{headers:{"cache-control":"private, no-store"}});
}