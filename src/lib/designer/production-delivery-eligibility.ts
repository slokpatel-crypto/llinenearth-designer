import {verifiedOperatorProductionCreateId} from "./operator-production-receipt.ts";
import {parseProductionEvidenceTimestamp} from "./production-delivery-evidence.ts";

export type ProductionDeliveryEligibility={
  order_id:string;revision_id:string;recipe_hash:string;status:string;
  updated_at:string;eligible:boolean;
};

const statuses=new Set(["created","cloth_reserved","cutting","stitching","fitting","ready","delivered","cancelled"]);
const expectedKeys=["eligible","order_id","recipe_hash","revision_id","status","updated_at"].sort();

function record(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==="object"&&!Array.isArray(value);
}

/** The SQL hint is read-only, capped and advisory. Reject forged success-shaped
 * rows, duplicate IDs, unexpected sensitive columns and coerced booleans.
 * An unavailable or invalid response must never enable delivery. */
export function parseProductionDeliveryEligibility(rows:unknown):ProductionDeliveryEligibility[]|null{
  if(!Array.isArray(rows)||rows.length>100)return null;
  const seen=new Set<string>();
  const parsed:ProductionDeliveryEligibility[]=[];
  for(const row of rows){
    if(!record(row)||Object.keys(row).sort().join("|")!==expectedKeys.join("|"))return null;
    const id=verifiedOperatorProductionCreateId(row.order_id);
    if(!id||seen.has(id)
      ||typeof row.revision_id!=="string"||row.revision_id.length<12||row.revision_id.length>220
      ||row.revision_id!==row.revision_id.trim()
      ||typeof row.recipe_hash!=="string"||!/^[a-f0-9]{64}$/i.test(row.recipe_hash)
      ||typeof row.status!=="string"||!statuses.has(row.status)
      ||typeof row.updated_at!=="string"
      ||!Number.isFinite(parseProductionEvidenceTimestamp(row.updated_at))
      ||typeof row.eligible!=="boolean"
      ||(row.eligible&&row.status!=="ready"))return null;
    seen.add(id);
    parsed.push({
      order_id:id,revision_id:row.revision_id,recipe_hash:row.recipe_hash.toLowerCase(),
      status:row.status,updated_at:row.updated_at,eligible:row.eligible,
    });
  }
  return parsed;
}

/** A separately fetched snapshot may race with the order list. Require exact
 * current immutable identity, status AND last-update receipt to avoid showing
 * eligibility for a different order revision. The SQL write gate always
 * rechecks the row lock and physical QC after any UI hint. */
export function hasVerifiedSqlDeliveryEligibility(
  rows:readonly ProductionDeliveryEligibility[],
  order:unknown,
):boolean{
  if(!record(order))return false;
  const id=verifiedOperatorProductionCreateId(order.order_id);
  if(!id||order.status!=="ready"
    ||typeof order.revision_id!=="string"
    ||typeof order.recipe_hash!=="string"
    ||typeof order.updated_at!=="string")return false;
  // The callback executes outside TypeScript's narrowing scope for unknown
  // record properties. Capture only strictly validated primitive values.
  const recipeHash=order.recipe_hash.toLowerCase();
  const revisionId=order.revision_id;
  const status=order.status;
  const updatedAt=order.updated_at;
  return rows.some(row=>row.order_id===id&&row.eligible===true
    &&row.status===status&&row.revision_id===revisionId
    &&row.recipe_hash===recipeHash
    &&row.updated_at===updatedAt);
}
