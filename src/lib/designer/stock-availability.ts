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
    const raw=row.available_metres;
    // Postgres decimal strings are acceptable; JS Number() also accepts hex,
    // binary and exponent spellings that are not measured metreage evidence.
    const decimal=typeof raw==="string"?raw.trim():null;
    const available=typeof raw==="number"?raw:
      decimal!==null&&/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(decimal)?Number(decimal):NaN;
    // Availability is the sum of exact 0.001m ledger movements. A finer
    // fraction or an unsafe integer is inconsistent with physical provenance.
    const millimetres=Math.round(available*1000);
    if(!id||counts.get(id)!==1||row.provenance_ready!==true
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
  return {
    stock:stock.map((fabric)=>({
      ...fabric,
      // Bundled catalogue availability is not proof of a physical roll.
      // A missing, invalid, duplicate or unreachable live ledger snapshot
      // must never be promoted to customer-facing "in stock".
      inStock:fabric.inStock&&verified.get(fabric.id)===true,
      availabilityVerified:verified.has(fabric.id),
    })),
    verifiedFabricIds:[...verified.keys()],
  };
}
