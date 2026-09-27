import { NextResponse } from "next/server";
import { generateDesignerDirections } from "@/lib/designer-engine";
import type { DesignerBrief } from "@/lib/designer-types";
import {
  publicStockPairing,
  recommendStockPairing,
  SHIRT_PANT_RULESET_VERSION,
} from "@/lib/shirt-pant-designer";

export async function POST(request: Request) {
  try {
    const brief = (await request.json()) as DesignerBrief;
    if (!brief?.fabric?.profile || !brief?.context) {
      return NextResponse.json({ error: "Fabric profile and context are required." }, { status: 400 });
    }

    const candidates = generateDesignerDirections(brief);
    const stockEvaluation = recommendStockPairing(brief);

    return NextResponse.json({
      candidates,
      stockPairing: publicStockPairing(stockEvaluation),
      engine: "phase4_rules_v1",
      stockEngine: stockEvaluation ? SHIRT_PANT_RULESET_VERSION : null,
    });
  } catch {
    return NextResponse.json({ error: "Unable to create design directions right now." }, { status: 500 });
  }
}
