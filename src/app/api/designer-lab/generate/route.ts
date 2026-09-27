import { NextResponse } from "next/server";
import type { DesignerBrief } from "@/lib/designer-types";
import { recordPhase1Recommendation } from "@/lib/designer-telemetry";
import { findApprovedSafeFallback } from "@/lib/designer-safe-fallback";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import {
  publicStockPairing,
  rankStockPairings,
  recommendStockPairing,
  SHIRT_PANT_RULESET_VERSION,
} from "@/lib/shirt-pant-designer";

export async function POST(request: Request) {
  try {
    const brief = (await request.json()) as DesignerBrief;
    if (!brief?.fabric?.stockId || !brief?.fabric?.profile || !brief?.context) {
      return NextResponse.json({ error: "A real LLinen Earth stock fabric and design context are required." }, { status: 400 });
    }

    const metadata = await loadDesignerFabricMetadata();
    const stock = applyDesignerFabricMetadataToStock(metadata);
    const ranked = rankStockPairings(brief,stock);
    const primary = ranked.find((item)=>item.mode === "Elevated")
      || ranked[0]
      || recommendStockPairing(brief,stock);

    const approvedFallback = await findApprovedSafeFallback(brief,primary,stock);
    const finalPrimary = approvedFallback || primary;
    const visible = approvedFallback
      ? [approvedFallback,...ranked.filter((item)=>item.id !== approvedFallback.id)].slice(0,3)
      : ranked.length
        ? ranked.slice(0,3)
        : finalPrimary
          ? [finalPrimary]
          : [];

    const telemetry = await recordPhase1Recommendation(brief,finalPrimary,visible);

    return NextResponse.json({
      stockPairings:visible.map(publicStockPairing),
      rulesVersion:finalPrimary ? SHIRT_PANT_RULESET_VERSION : null,
      telemetry:telemetry.provider,
      experience:"designer-lab-v1",
    });
  } catch (error) {
    console.error("[designer-lab/generate]",error);
    return NextResponse.json({ error:"The Designer Lab could not create a stock direction." }, { status:500 });
  }
}
