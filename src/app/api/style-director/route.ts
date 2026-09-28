import { NextResponse } from "next/server";
import { createStyleDirectorLooks, type StyleDirectorAnswers } from "@/lib/style-director-agent";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";

export const runtime = "nodejs";

function valid(body: Partial<StyleDirectorAnswers>): body is StyleDirectorAnswers {
  return Boolean(body.occasion && body.mood && body.time && body.climate && body.garment && body.colorDirection);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<StyleDirectorAnswers>;
    if (!valid(body)) return NextResponse.json({ error: "Complete the style journey first." }, { status: 400 });
    const metadata = await loadDesignerFabricMetadata();
    const stock = applyDesignerFabricMetadataToStock(metadata);
    const looks = createStyleDirectorLooks(body, stock);
    if (!looks.length) return NextResponse.json({ error: "No matching LLinen Earth stock is available for this direction yet." }, { status: 404 });
    return NextResponse.json({ looks, engine: "llinen-style-director-v2", calibratedFabrics: Object.keys(metadata).length });
  } catch (error) {
    console.error("[style-director]", error);
    return NextResponse.json({ error: "The style director could not build your looks right now." }, { status: 500 });
  }
}
