import { NextResponse } from "next/server";
import { generateDesignerDirections } from "@/lib/designer-engine";
import type { DesignerBrief } from "@/lib/designer-types";

export async function POST(request: Request) {
  try {
    const brief = (await request.json()) as DesignerBrief;
    if (!brief?.fabric?.profile || !brief?.context) {
      return NextResponse.json({ error: "Fabric profile and context are required." }, { status: 400 });
    }
    const candidates = generateDesignerDirections(brief);
    return NextResponse.json({ candidates, engine: "phase4_rules_v1" });
  } catch {
    return NextResponse.json({ error: "Unable to create design directions right now." }, { status: 500 });
  }
}
