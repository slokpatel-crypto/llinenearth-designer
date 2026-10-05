import { NextResponse } from "next/server";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { designerFabricFromStock } from "@/lib/designer/engine";
import { loadDesignerFabricIntelligence } from "@/lib/fabric-intelligence-server";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";
import { attachCatalogFabricPhysics } from "@/lib/designer/fabric-physics-catalog";

export const runtime = "nodejs";

export async function GET() {
  const metadata = await loadDesignerFabricMetadata();
  const metadataStock = applyDesignerFabricMetadataToStock(metadata);
  const liveStock = await applyLiveVerifiedStockAvailability(metadataStock);
  const stock = liveStock.stock.filter((fabric)=>fabric.inStock);
  const base = stock.map(designerFabricFromStock);
  const intelligence = await loadDesignerFabricIntelligence(base.map((fabric)=>fabric.id));
  const fabricsWithPhysics = base.map((fabric)=>attachCatalogFabricPhysics(fabric,intelligence[fabric.id]));
  return NextResponse.json({
    shirts:fabricsWithPhysics.filter((fabric)=>fabric.allowedGarments.includes("shirt")),
    pants:fabricsWithPhysics.filter((fabric)=>fabric.allowedGarments.includes("pant")),
    calibrated:Object.keys(metadata).length > 0,
    calibratedFabrics:Object.keys(metadata).length,
    verifiedStockFabrics:liveStock.verifiedFabricIds.length,
  });
}
