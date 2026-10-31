import { FINISHED_GARMENT_QC_CHECKS } from "./finished-garment-qc.ts";
import { verifiedOperatorProductionCreateId } from "./operator-production-receipt.ts";
import { parseProductionEvidenceTimestamp } from "./production-delivery-evidence.ts";

/**
 * Delivery is a physical release action: an older approval must never mask a
 * newer rework inspection, even if the upstream list arrives out of order.
 * This is a defensive read contract, not a replacement for human QC evidence.
 */
const QC_TIMESTAMP=/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]{1,6})?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;

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

/** An approved decision is not physical release evidence if any of the six
 * actual garment checks is missing, false, coerced or supplemented by an
 * unrecognized field. The QC write contract persists precisely these IDs. */
function verifiedApprovalChecks(value:unknown):boolean{
  if(!value||typeof value!=="object"||Array.isArray(value)) return false;
  const checks=value as Record<string,unknown>;
  const ids=FINISHED_GARMENT_QC_CHECKS.map(check=>check.id);
  return Object.keys(checks).length===ids.length
    &&ids.every(id=>checks[id]===true);
}

/** A saturated capped ledger cannot prove that the latest inspection was read.
 * This is still not a transactionally consistent database latest-by-order proof. */
export function hasVerifiedLatestDeliveryQc(receipts:unknown,orderId:string,maxRows=Number.POSITIVE_INFINITY):boolean{
  if(!Array.isArray(receipts)
    ||(maxRows!==Number.POSITIVE_INFINITY&&(!Number.isSafeInteger(maxRows)||maxRows<=0))
    ||receipts.length>=maxRows) return false;
  let latest:{time:number;decision:string;inspector:unknown;reference:unknown;checks:unknown}|null=null;
  let ambiguous=false;
  for(const value of receipts){
    if(!value||typeof value!=="object"||Array.isArray(value)) return false;
    const row=value as Record<string,unknown>;
    if(typeof row.order_id!=="string") return false;
    // PostgreSQL UUID equality is case-insensitive; a newer uppercase-hex
    // rework receipt must veto a lowercase-hex approval for the same order.
    if(row.order_id.toLowerCase()!==orderId.toLowerCase()) continue;
    const time=parseLiteralQcTimestamp(row.created_at);
    if(time===null||(row.decision!=="approved"&&row.decision!=="rework")) return false;
    if(!latest||time>latest.time){
      latest={time,decision:row.decision,inspector:row.inspector,reference:row.inspection_reference,checks:row.checks};
      ambiguous=false;
    }else if(time===latest.time){
      // Two inspections in the same JS timestamp resolution cannot be
      // reliably ordered without a stronger database sequence receipt.
      ambiguous=true;
    }
  }
  if(!latest||ambiguous||latest.decision!=="approved"||!verifiedApprovalChecks(latest.checks)) return false;
  const inspector=latest.inspector;
  const reference=latest.reference;
  return typeof inspector==="string"&&inspector===inspector.trim()
    &&inspector.length>=2&&inspector.length<=120
    &&typeof reference==="string"&&reference===reference.trim()
    &&reference.length>=3&&reference.length<=240;
}


/** The physical QC receipt must belong to the exact immutable order recipe.
 * An inspection carrying a reused order UUID but another revision/hash, a
 * missing database inspection UUID, or a date before the order was created
 * cannot authorize delivery. This is a source guard, not an atomic SQL proof.
 */
export function hasVerifiedDeliveryQcOrderLineage(receipts:unknown,order:unknown):boolean{
  if(!Array.isArray(receipts)||!order||typeof order!=="object"||Array.isArray(order)) return false;
  const target=order as Record<string,unknown>;
  const orderId=verifiedOperatorProductionCreateId(target.order_id);
  const created=parseProductionEvidenceTimestamp(target.created_at);
  if(!orderId||target.status!=="ready"
    ||typeof target.revision_id!=="string"||target.revision_id.length<12
    ||target.revision_id.length>220||target.revision_id!==target.revision_id.trim()
    ||typeof target.recipe_hash!=="string"||!/^[a-f0-9]{64}$/i.test(target.recipe_hash)
    ||!Number.isFinite(created)) return false;
  let matched=0;
  for(const value of receipts){
    if(!value||typeof value!=="object"||Array.isArray(value)) return false;
    const row=value as Record<string,unknown>;
    if(typeof row.order_id!=="string") return false;
    if(row.order_id.toLowerCase()!==orderId.toLowerCase()) continue;
    const inspected=parseProductionEvidenceTimestamp(row.created_at);
    if(!verifiedOperatorProductionCreateId(row.order_id)
      ||!verifiedOperatorProductionCreateId(row.inspection_id)
      ||row.revision_id!==target.revision_id
      ||typeof row.recipe_hash!=="string"
      ||row.recipe_hash.toLowerCase()!==target.recipe_hash.toLowerCase()
      ||!Number.isFinite(inspected)||inspected<created) return false;
    matched++;
  }
  return matched>0;
}
