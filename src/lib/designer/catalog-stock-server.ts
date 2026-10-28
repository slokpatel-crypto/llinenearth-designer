import "server-only";

import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";
import { designerFabricFromStock } from "@/lib/designer/engine";
import { loadDesignerFabricIntelligence } from "@/lib/fabric-intelligence-server";
import { attachCatalogFabricPhysics } from "@/lib/designer/fabric-physics-catalog";

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

/** One physical/provenance snapshot for catalogue, Creative Lab and assessment.
 * All three customer routes must resolve the same current fabric revision.
 */
export async function loadActiveDesignerCatalogueFabrics(){
  const live=await loadActiveDesignerFabricStock();
  const base=live.stock.map(designerFabricFromStock);
  const intelligence=await loadDesignerFabricIntelligence(base.map((fabric)=>fabric.id));
  const fabrics=base.map((fabric)=>attachCatalogFabricPhysics(fabric,intelligence[fabric.id]));
  return {...live,fabrics};
}
