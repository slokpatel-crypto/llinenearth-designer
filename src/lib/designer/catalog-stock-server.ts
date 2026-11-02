import "server-only";

import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";
import { verifiedDesignerCatalogueStock } from "@/lib/designer/public-inventory-availability";

export async function loadActiveDesignerFabricStock(){
  const metadata=await loadDesignerFabricMetadata();
  const metadataStock=applyDesignerFabricMetadataToStock(metadata);
  const liveStock=await applyLiveVerifiedStockAvailability(metadataStock);
  return {
    // The catalogue's nominal inStock flag is NOT supplier evidence. This
    // server response is restricted to verified positive ledger quantity AND
    // exact operator "available" confirmation, with both sources failing closed.
    stock:verifiedDesignerCatalogueStock(liveStock.stock,liveStock.verifiedFabricIds,metadata),
    calibratedFabrics:Object.keys(metadata).length,
    verifiedStockFabrics:liveStock.verifiedFabricIds.length,
  };
}
