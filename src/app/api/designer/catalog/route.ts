import { NextResponse } from "next/server";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { designerFabricFromStock } from "@/lib/designer/engine";
import { enrichDesignerFabricsWithIntelligence } from "@/lib/fabric-intelligence-server";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";
import { fabricCompatibilityMatrix, fabricPhysicsFromDesignerFabric } from "@/lib/designer/fabric-physics";

export const runtime = "nodejs";

export async function GET() {
  const metadata = await loadDesignerFabricMetadata();
  const metadataStock = applyDesignerFabricMetadataToStock(metadata);
  const liveStock = await applyLiveVerifiedStockAvailability(metadataStock);
  const stock = liveStock.stock.filter((fabric)=>fabric.inStock);
  const base = stock.map(designerFabricFromStock);
  const {fabrics} = await enrichDesignerFabricsWithIntelligence(base);
  const fabricsWithPhysics = fabrics.map((fabric)=>{
    const physicsProfile = fabricPhysicsFromDesignerFabric(fabric);
    return {
      ...fabric,
      physicsProfile,
      garmentCompatibility:fabricCompatibilityMatrix(physicsProfile),
    };
  });
  return NextResponse.json({
    shirts:fabricsWithPhysics.filter((fabric)=>fabric.allowedGarments.includes("shirt")),
    pants:fabricsWithPhysics.filter((fabric)=>fabric.allowedGarments.includes("pant")),
    calibrated:Object.keys(metadata).length > 0,
    calibratedFabrics:Object.keys(metadata).length,
    verifiedStockFabrics:liveStock.verifiedFabricIds.length,
  });
}
