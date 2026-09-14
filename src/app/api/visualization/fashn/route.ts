import { NextResponse } from "next/server";
import { assertFashnRateLimit, FashnVisualizationError, renderFashnFront } from "@/lib/ai-visualization";
import type { DesignerBrief } from "@/lib/designer-types";
import type { DesignVersion } from "@/lib/refinement-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { brief?: DesignerBrief; version?: DesignVersion };
    if (!body.brief || !body.version) return NextResponse.json({ error: "Missing locked design or brief." }, { status: 400 });
    if (!body.version.finalized || !body.version.specHash) return NextResponse.json({ error: "Finalize the design before visualization." }, { status: 409 });
    assertFashnRateLimit(request);
    const renderSet = await renderFashnFront(body.brief, body.version);
    return NextResponse.json({ renderSet });
  } catch (error) {
    if (error instanceof FashnVisualizationError) {
      const status = error.code === "not_configured" ? 503 : error.code === "invalid_source" ? 400 : error.code === "rate_limited" ? 429 : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[visualization/fashn]", error);
    return NextResponse.json({ error: "FASHN could not create this render. Your locked design is safe; please try again." }, { status: 500 });
  }
}
