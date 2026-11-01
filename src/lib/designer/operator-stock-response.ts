import { FABRIC_STOCK } from "../fabric-stock.ts";

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KNOWN_FABRICS=new Set(FABRIC_STOCK.map(f=>f.id));
const DECIMAL=/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

export function requireStockCreatedId(value:unknown):string{
  if(typeof value!=="string"||!ID.test(value))
    throw new Error("Invalid stock creation acknowledgment.");
  return value.toLowerCase();
}

function metres(value:unknown):number {
  if(typeof value!=="number"&&typeof value!=="string")
    throw new Error("Invalid physical stock snapshot.");
  if(typeof value==="string"&&!DECIMAL.test(value))
    throw new Error("Invalid physical stock snapshot.");
  const num=Number(value);
  if(!Number.isFinite(num)||num<0||num>100_000_000)
    throw new Error("Invalid physical stock snapshot.");
  return num;
}

function count(value:unknown):number{
  if(typeof value!=="number"||!Number.isSafeInteger(value)||value<0)
    throw new Error("Invalid stock provenance count.");
  return value;
}

export type OperatorStockSnapshotRow={
  fabric_id:string;physical_metres:number;reserved_metres:number;
  available_metres:number;manual_event_count:number;provenance_event_count:number;
  legacy_unverified_event_count:number;provenance_ready:boolean;last_event_at:string|null;
};

// A failed/malformed live stock read must not become an apparently verified
// zero-balance record or invent available cloth for cutting.
export function requireStockSnapshotRows(value:unknown):OperatorStockSnapshotRow[]{
  if(!Array.isArray(value)||value.length>500)
    throw new Error("Invalid physical stock snapshot.");
  const seen=new Set<string>();
  return value.map((raw):OperatorStockSnapshotRow=>{
    if(!raw||typeof raw!=="object"||Array.isArray(raw))
      throw new Error("Invalid physical stock snapshot.");
    const r=raw as Record<string,unknown>;
    const fabric_id=r.fabric_id;
    if(typeof fabric_id!=="string"||!KNOWN_FABRICS.has(fabric_id)||seen.has(fabric_id))
      throw new Error("Invalid stock fabric provenance.");
    seen.add(fabric_id);
    const physical_metres=metres(r.physical_metres);
    const reserved_metres=metres(r.reserved_metres);
    const available_metres=metres(r.available_metres);
    if(reserved_metres>physical_metres+0.00001||
      Math.abs(available_metres-(physical_metres-reserved_metres))>0.00001)
      throw new Error("Inconsistent physical stock balances.");
    const manual_event_count=count(r.manual_event_count);
    const provenance_event_count=count(r.provenance_event_count);
    const legacy_unverified_event_count=count(r.legacy_unverified_event_count);
    if(provenance_event_count+legacy_unverified_event_count>manual_event_count||
      typeof r.provenance_ready!=="boolean"||
      (r.last_event_at!==null&&
        (typeof r.last_event_at!=="string"||!Number.isFinite(Date.parse(r.last_event_at)))))
      throw new Error("Invalid stock provenance metadata.");
    return {fabric_id,physical_metres,reserved_metres,available_metres,
      manual_event_count,provenance_event_count,legacy_unverified_event_count,
      provenance_ready:r.provenance_ready,last_event_at:r.last_event_at as string|null};
  });
}
