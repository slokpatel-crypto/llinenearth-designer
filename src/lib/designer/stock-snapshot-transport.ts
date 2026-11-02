import type { VerifiedStockSnapshotRow } from "./stock-availability";

/** Validate a service-role stock snapshot's envelope before the Designer
 * can interpret any rows as physically verified availability.
 * Duplicate IDs stay duplicated so the downstream verifier rejects them.
 */
export function normalizeStockSnapshotTransport(
  input:unknown,requestedIds:readonly string[],
):VerifiedStockSnapshotRow[]{
  if(!Array.isArray(input)||input.length>requestedIds.length)
    throw new Error("Invalid stock snapshot transport response.");
  const requested=new Set(requestedIds);
  return input.map((raw):VerifiedStockSnapshotRow=>{
    if(!raw||typeof raw!=="object"||Array.isArray(raw))
      throw new Error("Invalid stock snapshot transport row.");
    const row=raw as Record<string,unknown>;
    if(typeof row.fabric_id!=="string"||!requested.has(row.fabric_id))
      throw new Error("Unexpected stock snapshot fabric ID.");
    // A missing/invalid quantity must never turn into verified zero stock.
    const metres=row.available_metres;
    return {
      fabric_id:row.fabric_id,
      available_metres:typeof metres==="number"||typeof metres==="string"?metres:NaN,
      provenance_ready:row.provenance_ready===true,
    };
  });
}
