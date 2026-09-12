import { NextResponse } from "next/server";
import { repairDevelopmentRender, type RenderSet, type RenderView } from "@/lib/visualization-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { renderSet?: RenderSet; view?: RenderView };
    if (!body.renderSet || !body.view) return NextResponse.json({ error: "Missing render set or view." }, { status: 400 });
    if (!["front", "back", "detail"].includes(body.view)) return NextResponse.json({ error: "Unsupported render view." }, { status: 400 });
    const renderSet = repairDevelopmentRender(body.renderSet, body.view);
    return NextResponse.json({ renderSet });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to repair visualization." }, { status: 500 });
  }
}
