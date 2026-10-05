import "server-only";

import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";

export async function loadActiveDesignerFabricStock(){
  const metadata=await loadDesignerFabricMetadata();
  const metadataStock=applyDesignerFabricMetadataToStock(metadata);
  const liveStock=await applyLiveVerifiedStockAvailability(metadataStock);
  return {
    stock:liveStock.stock.filter((fabric)=>fabric.inStock),
    calibratedFabrics:Object.keys(metadata).length,
    verifiedStockFabrics:liveStock.verifiedFabricIds.length,
  };
}
