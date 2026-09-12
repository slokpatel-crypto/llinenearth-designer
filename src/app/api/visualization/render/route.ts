import { NextResponse } from "next/server";
import type { DesignerBrief } from "@/lib/designer-types";
import type { DesignVersion } from "@/lib/refinement-engine";
import { renderDevelopmentSet } from "@/lib/visualization-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { brief?: DesignerBrief; version?: DesignVersion };
    if (!body.brief || !body.version) return NextResponse.json({ error: "Missing locked design or brief." }, { status: 400 });
    if (!body.version.finalized || !body.version.specHash) return NextResponse.json({ error: "Finalize the design before visualization." }, { status: 409 });
    const renderSet = renderDevelopmentSet(body.brief, body.version);
    return NextResponse.json({ renderSet });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create visualization." }, { status: 500 });
  }
}
