import { NextResponse } from "next/server";
import { generateDesignerDirections } from "@/lib/designer-engine";
import type { DesignerBrief } from "@/lib/designer-types";
import { recordPhase1Recommendation } from "@/lib/designer-telemetry";
import { findApprovedSafeFallback } from "@/lib/designer-safe-fallback";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import {
  publicStockPairing,
  recommendStockPairing,
  rankStockPairings,
  SHIRT_PANT_RULESET_VERSION,
} from "@/lib/shirt-pant-designer";

export async function POST(request: Request) {
  try {
    const brief = (await request.json()) as DesignerBrief;
    if (!brief?.fabric?.profile || !brief?.context) {
      return NextResponse.json({ error: "Fabric profile and context are required." }, { status: 400 });
    }

    const candidates = generateDesignerDirections(brief);
    const metadata = await loadDesignerFabricMetadata();
    const stock = applyDesignerFabricMetadataToStock(metadata);
    const rankedStock = rankStockPairings(brief,stock);
    const primaryStockEvaluation = rankedStock.find((item)=>item.mode === "Elevated")
      || rankedStock[0]
      || recommendStockPairing(brief,stock);
    const approvedFallback = await findApprovedSafeFallback(brief, primaryStockEvaluation,stock);
    const stockEvaluation = approvedFallback || primaryStockEvaluation;
    const visibleRanked = approvedFallback
      ? [approvedFallback,...rankedStock.filter((item)=>item.id !== approvedFallback.id)].slice(0,3)
      : rankedStock.length
        ? rankedStock.slice(0,3)
        : stockEvaluation
          ? [stockEvaluation]
          : [];
    const telemetry = await recordPhase1Recommendation(brief, stockEvaluation,visibleRanked);

    return NextResponse.json({
      candidates,
      stockPairing: publicStockPairing(stockEvaluation),
      stockPairings: visibleRanked.map(publicStockPairing),
      engine: "phase4_rules_v1",
      stockEngine: stockEvaluation ? SHIRT_PANT_RULESET_VERSION : null,
      telemetry: telemetry.provider,
    });
  } catch {
    return NextResponse.json({ error: "Unable to create design directions right now." }, { status: 500 });
  }
}
