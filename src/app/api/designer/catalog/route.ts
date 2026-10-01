import { NextResponse } from "next/server";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { designerFabricFromStock } from "@/lib/designer/engine";
import { enrichDesignerFabricsWithIntelligence } from "@/lib/fabric-intelligence-server";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";

export const runtime = "nodejs";

export async function GET() {
  const metadata = await loadDesignerFabricMetadata();
  const metadataStock = applyDesignerFabricMetadataToStock(metadata);
  const liveStock = await applyLiveVerifiedStockAvailability(metadataStock);
  const stock = liveStock.stock.filter((fabric)=>fabric.inStock);
  const base = stock.map(designerFabricFromStock);
  const {fabrics} = await enrichDesignerFabricsWithIntelligence(base);
  return NextResponse.json({
    shirts:fabrics.filter((fabric)=>fabric.allowedGarments.includes("shirt")),
    pants:fabrics.filter((fabric)=>fabric.allowedGarments.includes("pant")),
    calibrated:Object.keys(metadata).length > 0,
    calibratedFabrics:Object.keys(metadata).length,
    verifiedStockFabrics:liveStock.verifiedFabricIds.length,
  });
}
