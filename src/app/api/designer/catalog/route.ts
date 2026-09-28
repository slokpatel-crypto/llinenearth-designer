import { NextResponse } from "next/server";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { designerFabricFromStock } from "@/lib/designer/engine";

export const runtime = "nodejs";

export async function GET() {
  const metadata = await loadDesignerFabricMetadata();
  const stock = applyDesignerFabricMetadataToStock(metadata).filter((fabric)=>fabric.inStock);
  const fabrics = stock.map(designerFabricFromStock);
  return NextResponse.json({
    shirts:fabrics.filter((fabric)=>fabric.allowedGarments.includes("shirt")),
    pants:fabrics.filter((fabric)=>fabric.allowedGarments.includes("pant")),
    calibrated:Object.keys(metadata).length > 0,
    calibratedFabrics:Object.keys(metadata).length,
  });
}
