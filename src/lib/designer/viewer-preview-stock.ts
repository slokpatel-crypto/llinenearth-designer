import type { FabricColorway } from "@/lib/fabric-stock";

/** The internal 3D lab is a *preview*, not a stock/order endpoint.
 * Keep every known catalogue fabric reconstructable from a Designer draft,
 * but never inherit nominal catalogue inStock as physical availability.
 * Live rows originate from the strict ledger AND operator-approved selector.
 */
export function composeViewerPreviewStock(
  catalogue: readonly FabricColorway[],
  verifiedAvailable: readonly FabricColorway[],
): FabricColorway[] {
  const eligible = new Map<string, FabricColorway>(verifiedAvailable
    .filter((fabric) => fabric.inStock === true && fabric.availabilityVerified === true)
    .map((fabric) => [fabric.id, fabric] as const));
  return catalogue.map((fabric) => eligible.get(fabric.id) ?? {
    ...fabric,
    inStock: false,
    availabilityVerified: false,
  });
}
