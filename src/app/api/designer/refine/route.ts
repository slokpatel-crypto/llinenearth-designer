import { NextResponse } from "next/server";
import { refineDesign, type LockableField } from "@/lib/refinement-engine";
import type { DesignCandidate } from "@/lib/designer-engine";
import type { DesignerBrief } from "@/lib/designer-types";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      brief?: DesignerBrief;
      candidate?: DesignCandidate;
      instruction?: string;
      lockedFields?: LockableField[];
      versionNumber?: number;
    };

    if (!body.brief || !body.candidate || !body.instruction?.trim()) {
      return NextResponse.json({ error: "Brief, candidate and refinement instruction are required." }, { status: 400 });
    }

    const result = refineDesign(body.brief, body.candidate, body.instruction, body.lockedFields ?? [], body.versionNumber ?? 2);
    return NextResponse.json({ result, mode: "deterministic_phase_5" });
  } catch {
    return NextResponse.json({ error: "Unable to refine this design right now." }, { status: 500 });
  }
}
