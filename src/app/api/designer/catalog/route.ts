import { NextResponse } from "next/server";
import { designerFabricFromStock } from "@/lib/designer/engine";
import { loadDesignerFabricIntelligence } from "@/lib/fabric-intelligence-server";
import { attachCatalogFabricPhysics } from "@/lib/designer/fabric-physics-catalog";
import { loadActiveDesignerFabricStock } from "@/lib/designer/catalog-stock-server";

export const runtime = "nodejs";

export async function GET() {
  const live=await loadActiveDesignerFabricStock();
  const stock=live.stock;
  const base = stock.map(designerFabricFromStock);
  const intelligence = await loadDesignerFabricIntelligence(base.map((fabric)=>fabric.id));
  const fabricsWithPhysics = base.map((fabric)=>attachCatalogFabricPhysics(fabric,intelligence[fabric.id]));
  return NextResponse.json({
    shirts:fabricsWithPhysics.filter((fabric)=>fabric.allowedGarments.includes("shirt")),
    pants:fabricsWithPhysics.filter((fabric)=>fabric.allowedGarments.includes("pant")),
    calibrated:live.calibratedFabrics>0,
    calibratedFabrics:live.calibratedFabrics,
    verifiedStockFabrics:live.verifiedStockFabrics,
  });
}
