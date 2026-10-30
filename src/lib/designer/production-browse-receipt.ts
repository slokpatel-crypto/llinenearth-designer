import { verifiedOperatorProductionCreateId } from "./operator-production-receipt.ts";
import { parseProductionEvidenceTimestamp, validProductionReentryFields } from "./production-delivery-evidence.ts";

function row(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==="object"&&!Array.isArray(value);
}

/**
 * Browse lists are capped at 500 and are NEVER first-ten release authority.
 * Still, an HTTP 200 with malformed rows must not be presented as an empty
 * or safe operator queue: the UI dereferences IDs, timestamps and field arrays.
 * Validate only fields needed to render/record safely; nullable legacy notes
 * and optional delivery timestamps remain supported.
 */
export function validProductionDeliveryBrowseReceipt(orders:unknown,evidence:unknown):boolean{
  if(!Array.isArray(orders)||!Array.isArray(evidence)
    ||orders.length>500||evidence.length>500) return false;
  const orderIds=new Set<string>();
  for(const value of orders){
    if(!row(value)) return false;
    const id=verifiedOperatorProductionCreateId(value.order_id);
    if(!id||orderIds.has(id)
      ||typeof value.status!=="string"||value.status.length===0
      ||typeof value.revision_id!=="string"
      ||typeof value.recipe_hash!=="string"
      ||!Number.isFinite(parseProductionEvidenceTimestamp(value.created_at))
      ||(value.delivered_at!==undefined&&value.delivered_at!==null
        &&!Number.isFinite(parseProductionEvidenceTimestamp(value.delivered_at)))) return false;
    orderIds.add(id);
  }
  const evidenceIds=new Set<string>();
  for(const value of evidence){
    if(!row(value)) return false;
    const id=verifiedOperatorProductionCreateId(value.evidence_id);
    if(!id||evidenceIds.has(id)
      ||!verifiedOperatorProductionCreateId(value.order_id)
      ||typeof value.manual_design_reentry!=="boolean"
      ||(value.reentry_fields!==undefined&&value.reentry_fields!==null
        &&!validProductionReentryFields(value.reentry_fields))
      ||(value.note!==undefined&&value.note!==null&&typeof value.note!=="string")
      ||(value.operator!==undefined&&value.operator!==null&&typeof value.operator!=="string")
      ||(value.evidence_reference!==undefined&&value.evidence_reference!==null
        &&typeof value.evidence_reference!=="string")
      ||!Number.isFinite(parseProductionEvidenceTimestamp(value.created_at))) return false;
    evidenceIds.add(id);
  }
  return true;
}
