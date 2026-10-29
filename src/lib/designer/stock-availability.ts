import type { FabricColorway } from "@/lib/fabric-stock";

export type VerifiedStockSnapshotRow={
  fabric_id:string;
  available_metres:number|string;
  provenance_ready:boolean;
};

export function verifiedStockAvailabilityMap(rows:VerifiedStockSnapshotRow[]){
  const out=new Map<string,boolean>();
  // A duplicated or contradictory server snapshot is not physical inventory
  // evidence. Never let the last row win and incorrectly sell an unavailable
  // roll; no unreviewed row can turn into a verified stock assertion.
  const counts=new Map<string,number>();
  for(const row of rows){
    const id=typeof row.fabric_id==="string"?row.fabric_id.trim():"";
    if(!id) continue;
    counts.set(id,(counts.get(id)||0)+1);
  }
  for(const row of rows){
    const id=typeof row.fabric_id==="string"?row.fabric_id.trim():"";
    const rawId=typeof row.fabric_id==="string"?row.fabric_id:"";
    const raw=row.available_metres;
    // Postgres decimal strings are acceptable; JS Number() also accepts hex,
    // binary and exponent spellings that are not measured metreage evidence.
    const decimal=typeof raw==="string"?raw.trim():null;
    const available=typeof raw==="number"?raw:
      decimal!==null&&/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(decimal)?Number(decimal):NaN;
    // Availability is the sum of exact 0.001m ledger movements. A finer
    // fraction or an unsafe integer is inconsistent with physical provenance.
    const millimetres=Math.round(available*1000);
    // A padded or coerced RPC identifier is not an exact physical fabric ID.
    // Count its canonical duplicate above so it also invalidates a competing
    // exact row instead of silently letting inconsistent evidence through.
    if(!id||rawId!==id||counts.get(id)!==1||row.provenance_ready!==true
       ||!Number.isFinite(available)||available<0
       ||!Number.isSafeInteger(millimetres)
       ||Math.abs(available*1000-millimetres)>1e-7) continue;
    out.set(id,available>0);
  }
  return out;
}

export function applyVerifiedStockAvailability(
  stock:FabricColorway[],
  rows:VerifiedStockSnapshotRow[],
){
  const verified=verifiedStockAvailabilityMap(rows);
  // A valid physical ledger row is not enough when the catalogue itself
  // contains duplicate identities: two different swatches must not both
  // inherit the same verified roll. Nor may an unexpected RPC row inflate
  // the customer-facing count of catalogue fabrics with verified stock.
  const catalogueCounts=new Map<string,number>();
  for(const fabric of stock){
    catalogueCounts.set(fabric.id,(catalogueCounts.get(fabric.id)||0)+1);
  }
  const uniqueCatalogueIds=new Set(
    [...catalogueCounts].filter(([,count])=>count===1).map(([id])=>id),
  );
  return {
    stock:stock.map((fabric)=>({
      ...fabric,
      // Bundled catalogue availability is not proof of a physical roll.
      // A missing, invalid, duplicate or unreachable live ledger snapshot
      // must never be promoted to customer-facing "in stock".
      inStock:uniqueCatalogueIds.has(fabric.id)&&fabric.inStock&&verified.get(fabric.id)===true,
      availabilityVerified:uniqueCatalogueIds.has(fabric.id)&&verified.has(fabric.id),
    })),
    verifiedFabricIds:[...verified.keys()].filter((id)=>uniqueCatalogueIds.has(id)),
  };
}
