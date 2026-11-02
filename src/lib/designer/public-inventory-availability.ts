import type { FabricColorway } from "../../fabric-stock";

/** Public availability is never inferred from a catalogue or gallery image.
 * The upstream verified snapshot must explicitly certify the fabric ID.
 */
export function requireVerifiedPublicAvailability(
  stock:readonly FabricColorway[],verifiedFabricIds:readonly string[],
):FabricColorway[]{
  const verified=new Set(verifiedFabricIds);
  return stock.map((fabric)=>({
    ...fabric,
    inStock:fabric.inStock===true && verified.has(fabric.id),
    availabilityVerified:verified.has(fabric.id),
  }));
}
