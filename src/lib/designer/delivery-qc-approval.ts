/**
 * Delivery is a physical release action: an older approval must never mask a
 * newer rework inspection, even if the upstream list arrives out of order.
 * This is a defensive read contract, not a replacement for human QC evidence.
 */
const QC_TIMESTAMP=/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\\.[0-9]{1,6})?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;

/** Date.parse normalizes impossible dates (e.g. February 31 → March 3).
 * A normalized phantom inspection must never outrank a real rework receipt. */
function parseLiteralQcTimestamp(value:unknown):number|null{
  if(typeof value!=="string") return null;
  const match=QC_TIMESTAMP.exec(value);
  if(!match) return null;
  const [year,month,day,hour,minute,second]=match.slice(1,7).map(Number);
  const calendar=new Date(0);
  calendar.setUTCFullYear(year,month-1,day);
  if(calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1
    ||calendar.getUTCDate()!==day||hour>23||minute>59||second>59) return null;
  const time=Date.parse(value);
  return Number.isFinite(time)?time:null;
}

export function hasVerifiedLatestDeliveryQc(receipts:unknown,orderId:string):boolean{
  if(!Array.isArray(receipts)) return false;
  let latest:{time:number;decision:string;inspector:unknown;reference:unknown}|null=null;
  let ambiguous=false;
  for(const value of receipts){
    if(!value||typeof value!=="object"||Array.isArray(value)) return false;
    const row=value as Record<string,unknown>;
    if(typeof row.order_id!=="string") return false;
    if(row.order_id!==orderId) continue;
    const time=parseLiteralQcTimestamp(row.created_at);
    if(time===null||(row.decision!=="approved"&&row.decision!=="rework")) return false;
    if(!latest||time>latest.time){
      latest={time,decision:row.decision,inspector:row.inspector,reference:row.inspection_reference};
      ambiguous=false;
    }else if(time===latest.time){
      // Two inspections in the same JS timestamp resolution cannot be
      // reliably ordered without a stronger database sequence receipt.
      ambiguous=true;
    }
  }
  if(!latest||ambiguous||latest.decision!=="approved") return false;
  const inspector=latest.inspector;
  const reference=latest.reference;
  return typeof inspector==="string"&&inspector===inspector.trim()
    &&inspector.length>=2&&inspector.length<=120
    &&typeof reference==="string"&&reference===reference.trim()
    &&reference.length>=3&&reference.length<=240;
}
