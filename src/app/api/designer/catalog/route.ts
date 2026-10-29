import { NextResponse } from "next/server";
import { loadActiveDesignerCatalogueFabrics } from "@/lib/designer/catalog-stock-server";

export const runtime = "nodejs";

export async function GET() {
  const live=await loadActiveDesignerCatalogueFabrics();
  const fabricsWithPhysics=live.fabrics;
  return NextResponse.json({
    shirts:fabricsWithPhysics.filter((fabric)=>fabric.allowedGarments.includes("shirt")),
    pants:fabricsWithPhysics.filter((fabric)=>fabric.allowedGarments.includes("pant")),
    calibrated:live.calibratedFabrics>0,
    calibratedFabrics:live.calibratedFabrics,
    verifiedStockFabrics:live.verifiedStockFabrics,
  },{headers:{"cache-control":"private, no-store"}});
}
