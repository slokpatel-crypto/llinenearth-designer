import type { FabricColorway } from "@/lib/fabric-stock";

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
