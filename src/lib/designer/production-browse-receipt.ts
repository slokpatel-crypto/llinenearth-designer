import { verifiedOperatorProductionCreateId } from "./operator-production-receipt.ts";
import { parseProductionEvidenceTimestamp, validProductionReentryFields } from "./production-delivery-evidence.ts";

function row(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==="object"&&!Array.isArray(value);
}

/**
 * Browse lists are capped at 500 and are NEVER first-ten release authority.
 * Still, an HTTP 200 with malformed rows must not be presented as an empty
 * or safe operator queue: the UI dereferences IDs, timestamps and field arrays.
 * Enforce chronology when a matching order is in the bounded page; older
 * evidence may legitimately refer to orders omitted by the newest-500 list.
 * Validate only fields needed to render/record safely; nullable legacy notes
 * and optional delivery timestamps remain supported.
 */
export function validProductionDeliveryBrowseReceipt(orders:unknown,evidence:unknown):boolean{
  if(!Array.isArray(orders)||!Array.isArray(evidence)
    ||orders.length>500||evidence.length>500) return false;
  const orderIds=new Set<string>();
  const orderTimes=new Map<string,{createdAt:number;deliveredAt:number|null}>();
  for(const value of orders){
    if(!row(value)) return false;
    const id=verifiedOperatorProductionCreateId(value.order_id);
    const createdAt=parseProductionEvidenceTimestamp(value.created_at);
    const deliveredAt=value.delivered_at===undefined||value.delivered_at===null
      ?null:parseProductionEvidenceTimestamp(value.delivered_at);
    if(!id||orderIds.has(id)
      ||typeof value.status!=="string"||value.status.length===0
      ||typeof value.revision_id!=="string"
      ||typeof value.recipe_hash!=="string"
      ||!Number.isFinite(createdAt)
      ||(deliveredAt!==null&&(!Number.isFinite(deliveredAt)||deliveredAt<createdAt))) return false;
    orderIds.add(id);
    orderTimes.set(id,{createdAt,deliveredAt});
  }
  const evidenceIds=new Set<string>();
  for(const value of evidence){
    if(!row(value)) return false;
    const id=verifiedOperatorProductionCreateId(value.evidence_id);
    const orderId=verifiedOperatorProductionCreateId(value.order_id);
    const auditAt=parseProductionEvidenceTimestamp(value.created_at);
    const relatedOrder=orderId?orderTimes.get(orderId):undefined;
    if(!id||evidenceIds.has(id)
      ||!orderId
      ||typeof value.manual_design_reentry!=="boolean"
      ||(value.reentry_fields!==undefined&&value.reentry_fields!==null
        &&!validProductionReentryFields(value.reentry_fields))
      ||(value.note!==undefined&&value.note!==null&&typeof value.note!=="string")
      ||(value.operator!==undefined&&value.operator!==null&&typeof value.operator!=="string")
      ||(value.evidence_reference!==undefined&&value.evidence_reference!==null
        &&typeof value.evidence_reference!=="string")
      ||!Number.isFinite(auditAt)
      ||(relatedOrder&&(auditAt<relatedOrder.createdAt
        ||(relatedOrder.deliveredAt!==null&&auditAt<relatedOrder.deliveredAt)))) return false;
    evidenceIds.add(id);
  }
  return true;
}
