import { NextResponse } from "next/server";
import { assertFashnRateLimit, FashnVisualizationError, renderFashnView } from "@/lib/ai-visualization";
import type { DesignerBrief } from "@/lib/designer-types";
import type { DesignVersion } from "@/lib/refinement-engine";
import { repairDevelopmentRender, type RenderSet, type RenderView } from "@/lib/visualization-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { renderSet?: RenderSet; view?: RenderView; brief?: DesignerBrief; version?: DesignVersion };
    if (!body.renderSet || !body.view) return NextResponse.json({ error: "Missing render set or view." }, { status: 400 });
    if (!["front", "back", "detail"].includes(body.view)) return NextResponse.json({ error: "Unsupported render view." }, { status: 400 });
    if (body.renderSet.provider === "fashn-edit" && (!body.brief || !body.version)) return NextResponse.json({ error: "Missing locked design or brief." }, { status: 400 });
    if (body.renderSet.provider === "fashn-edit") assertFashnRateLimit(request);
    const renderSet = body.renderSet.provider === "fashn-edit"
      ? await renderFashnView(body.renderSet, body.view, body.brief!, body.version!)
      : repairDevelopmentRender(body.renderSet, body.view);
    return NextResponse.json({ renderSet });
  } catch (error) {
    if (error instanceof FashnVisualizationError) return NextResponse.json({ error: error.message }, { status: error.code === "not_configured" ? 503 : error.code === "rate_limited" ? 429 : 502 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to repair visualization." }, { status: 500 });
  }
}
