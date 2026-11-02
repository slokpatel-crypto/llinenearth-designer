import type { FabricColorway } from "@/lib/fabric-stock";
import type { DesignerFabricMetadataMap } from "@/lib/designer-fabric-metadata-types";

/** Public availability is never inferred from a catalogue or gallery image.
 * Both the upstream physical ledger and an explicit operator availability
 * confirmation must certify the fabric ID; unavailable metadata fails closed.
 */
export function requireVerifiedPublicAvailability(
  stock:readonly FabricColorway[],verifiedFabricIds:readonly string[],
  operatorAvailableIds:readonly string[],
):FabricColorway[]{
  const verified=new Set(verifiedFabricIds);
  const operatorAvailable=new Set(operatorAvailableIds);
  return stock.map((fabric)=>({
    ...fabric,
    inStock:fabric.inStock===true && verified.has(fabric.id) && operatorAvailable.has(fabric.id),
    availabilityVerified:verified.has(fabric.id),
  }));
}

/** Designer's selectable LIVE catalogue is a subset of public verified stock.
 * Retain unconfirmed static swatches only in the existing browse-only client
 * fallback, where physical availability is visibly unverified.
 */
export function verifiedDesignerCatalogueStock(
  stock:readonly FabricColorway[],
  verifiedFabricIds:readonly string[],
  metadata:DesignerFabricMetadataMap,
):FabricColorway[]{
  const operatorAvailableIds=Object.entries(metadata)
    .filter(([id,entry])=>id===entry.fabricId && entry.availability==="available")
    .map(([id])=>id);
  return requireVerifiedPublicAvailability(stock,verifiedFabricIds,operatorAvailableIds)
    .filter((fabric)=>fabric.inStock);
}
