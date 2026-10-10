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
    const available=typeof raw==="number"?raw:typeof raw==="string"&&raw.trim()!==""?Number(raw):NaN;
    if(!id||counts.get(id)!==1||row.provenance_ready!==true
       ||!Number.isFinite(available)||available<0) continue;
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
    stock:stock.map((fabric)=>verified.has(fabric.id)?{...fabric,inStock:fabric.inStock&&verified.get(fabric.id)===true,availabilityVerified:true}:fabric),
    verifiedFabricIds:[...verified.keys()],
  };
}
