import type { FabricColorway } from "@/lib/fabric-stock";

export type VerifiedStockSnapshotRow={
  fabric_id:string;
  available_metres:number|string;
  provenance_ready:boolean;
};

export function verifiedStockAvailabilityMap(rows:VerifiedStockSnapshotRow[]){
  const out=new Map<string,boolean>();
  for(const row of rows){
    const id=String(row.fabric_id||"").trim();
    const available=Number(row.available_metres);
    if(!id||row.provenance_ready!==true||!Number.isFinite(available)) continue;
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
    stock:stock.map((fabric)=>verified.has(fabric.id)?{...fabric,inStock:fabric.inStock&&verified.get(fabric.id)===true}:fabric),
    verifiedFabricIds:[...verified.keys()],
  };
}
