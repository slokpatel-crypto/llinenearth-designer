import { FABRIC_STOCK } from "../fabric-stock.ts";
import {parseVaultTimestamptz} from "../vault-read-integrity.ts";
import {normalizeVaultId} from "../vault-id.ts";

const KNOWN_CATALOGUE_FABRICS=new Set(FABRIC_STOCK.map(fabric=>fabric.id));

/** Physical stock records are meaningful only for published supplier SKUs. */
export function assertCurrentFabricId(id:string):void {
  if(!KNOWN_CATALOGUE_FABRICS.has(id))
    throw new Error("Selected fabric is not in the published Linen Earth supplier catalogue.");
}

/** Operator writes use service-role credentials: protect them before any RPC. */
export function stockMutationRequestError(request:Pick<Request,"url"|"headers">):
  {status:number;error:string}|null {
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)
    return {status:403,error:"Cross-site stock changes are not allowed."};
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))
    return {status:415,error:"Stock mutations require JSON."};
  const length=request.headers.get("content-length");
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>24_000))
    return {status:413,error:"Stock mutation payload is too large."};
  return null;
}

/**
 * Content-Length can be omitted (e.g. chunked requests), so a header-only
 * check does not bound service-role mutation input. Count actual UTF-8 bytes
 * before ever parsing JSON; reject rather than truncating a physical record.
 */
export class StockMutationPayloadTooLarge extends Error {}

export async function readBoundedStockMutationJson(request:Request):Promise<Record<string,unknown>>{
  if(!request.body) throw new Error("Stock mutation body is required.");
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let total=0;
  try{
    while(true){
      const next=await reader.read();
      if(next.done) break;
      total+=next.value.byteLength;
      if(total>24_000){
        await reader.cancel();
        throw new StockMutationPayloadTooLarge("Stock mutation payload is too large.");
      }
      chunks.push(next.value);
    }
  }finally{
    reader.releaseLock();
  }
  const data=new Uint8Array(total);
  let offset=0;
  for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  let parsed:unknown;
  try{
    parsed=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(data));
  }catch{
    throw new Error("Stock mutation body must be valid UTF-8 JSON.");
  }
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))
    throw new Error("Stock mutation JSON must be an object.");
  return parsed as Record<string,unknown>;
}

/** Never count an altered upstream stock RPC receipt as a recorded real event.
 * Reject padded, non-scalar or coerced UUIDs; upper-case hex is legitimate. */
export function verifiedOperatorStockReceiptId(value:unknown):string|null{
  if(typeof value!=="string") return null;
  const normalized=normalizeVaultId(value);
  return normalized&&value.toLowerCase()===normalized?normalized:null;
}

/** A 200 HTTP status is not a stock mutation receipt. Verify the exact action
 * and typed acknowledgement independently in the operator browser before
 * showing success or marking a reservation as confirmed. */
export function verifiedOperatorStockMutationReceipt(action:unknown,value:unknown):boolean{
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const receipt=value as Record<string,unknown>;
  if(action==="record")return verifiedOperatorStockReceiptId(receipt.eventId)!==null;
  if(action==="reserve")return verifiedOperatorStockReceiptId(receipt.reservationId)!==null;
  if(action==="release")return receipt.released===true;
  if(action==="consume")return receipt.consumed===true;
  return false;
}

/** Fail closed on inconsistent privileged stock snapshots before a dashboard can
 * display or reserve against invented availability. This is NOT roll certification.
 */
export type OperatorStockSnapshotRow={
  fabric_id:string;physical_metres:number;reserved_metres:number;available_metres:number;
  manual_event_count:number;provenance_event_count:number;legacy_unverified_event_count:number;
  provenance_ready:boolean;last_event_at:string|null;
};
export function validateOperatorStockSnapshot(value:unknown):OperatorStockSnapshotRow[]|null{
  if(!Array.isArray(value)||value.length>KNOWN_CATALOGUE_FABRICS.size)return null;
  const ids=new Set<string>();
  for(const row of value){
    if(!row||typeof row!=="object"||Array.isArray(row))return null;
    const item=row as Record<string,unknown>;
    if(typeof item.fabric_id!=="string"||!KNOWN_CATALOGUE_FABRICS.has(item.fabric_id)||
       ids.has(item.fabric_id))return null;
    ids.add(item.fabric_id);
    const numbers=["physical_metres","reserved_metres","available_metres"] as const;
    if(numbers.some((field)=>{const n=item[field];return typeof n!=="number"||
       !Number.isFinite(n)||n<0;}))return null;
    const counts=["manual_event_count","provenance_event_count","legacy_unverified_event_count"] as const;
    if(counts.some((field)=>{const n=item[field];return typeof n!=="number"||
       !Number.isSafeInteger(n)||n<0;}))return null;
    if(typeof item.provenance_ready!=="boolean")return null;
    const manual=item.manual_event_count as number;
    const proven=item.provenance_event_count as number;
    const legacy=item.legacy_unverified_event_count as number;
    if(proven+legacy!==manual ||
       item.provenance_ready!==(manual>0&&legacy===0))return null;
    if(Math.abs((item.physical_metres as number)-(item.reserved_metres as number)-
       (item.available_metres as number))>0.003)return null;
    if(item.last_event_at!==null &&
       (typeof item.last_event_at!=="string"||
        parseVaultTimestamptz(item.last_event_at)===null))return null;
  }
  return value as OperatorStockSnapshotRow[];
}

/** Only bounded aggregate counters can cross the privileged stock-audit
 * boundary. Raw supplier documents, user IDs and ledger UUIDs never belong
 * in the operator browser's preflight summary. This is not a roll audit. */
export const STOCK_SOURCE_AUDIT_KEYS=[
  "reservationRows","duplicateLineGroups","duplicateLineRows",
  "missingLockedRevision","missingSource","missingChecker",
  "missingRequestKey","missingReservationUuid","paddedSource",
  "placeholderSource",
] as const;
export type OperatorStockSourceAudit=Record<(typeof STOCK_SOURCE_AUDIT_KEYS)[number],number>;
export function verifyOperatorStockSourceAudit(value:unknown):OperatorStockSourceAudit|null{
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const source=value as Record<string,unknown>;
  const keys=Object.keys(source);
  if(keys.length!==STOCK_SOURCE_AUDIT_KEYS.length||
     keys.some(key=>!STOCK_SOURCE_AUDIT_KEYS.some(expected=>expected===key)))
    return null;
  for(const key of STOCK_SOURCE_AUDIT_KEYS){
    if(typeof source[key]!=="number"||!Number.isSafeInteger(source[key])||
       (source[key] as number)<0)return null;
  }
  const result=source as OperatorStockSourceAudit;
  const n=result.reservationRows;
  const duplicates=result.duplicateLineRows;
  if(result.duplicateLineGroups>Math.floor(duplicates/2)||
     duplicates>n)return null;
  for(const key of STOCK_SOURCE_AUDIT_KEYS){
    if(key!=="reservationRows"&&key!=="duplicateLineGroups"&&
       key!=="duplicateLineRows"&&result[key]>n)return null;
  }
  return result;
}
