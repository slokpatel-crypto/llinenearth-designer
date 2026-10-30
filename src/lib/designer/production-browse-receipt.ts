import { verifiedOperatorProductionCreateId } from "./operator-production-receipt.ts";
import { parseProductionEvidenceTimestamp, validProductionReentryFields } from "./production-delivery-evidence.ts";

const productionStatuses=new Set(["created","cloth_reserved","cutting","stitching","fitting","ready","delivered","cancelled"]);
const validRecipeHash=(value:unknown):value is string=>typeof value==="string"&&/^[a-f0-9]{64}$/i.test(value);
const validRevision=(value:unknown):value is string=>typeof value==="string"&&value.trim().length>=3&&value.length<=240;

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
  const orderTimes=new Map<string,{createdAt:number;deliveredAt:number|null;revision:string;hash:string}>();
  for(const value of orders){
    if(!row(value)) return false;
    const id=verifiedOperatorProductionCreateId(value.order_id);
    const createdAt=parseProductionEvidenceTimestamp(value.created_at);
    const deliveredAt=value.delivered_at===undefined||value.delivered_at===null
      ?null:parseProductionEvidenceTimestamp(value.delivered_at);
    if(!id||orderIds.has(id)
      ||!productionStatuses.has(value.status as string)
      ||!validRevision(value.revision_id)
      ||!validRecipeHash(value.recipe_hash)
      ||!Number.isFinite(createdAt)
      ||(deliveredAt!==null&&(!Number.isFinite(deliveredAt)||deliveredAt<createdAt))) return false;
    orderIds.add(id);
    orderTimes.set(id,{createdAt,deliveredAt,revision:value.revision_id as string,hash:value.recipe_hash as string});
  }
  const evidenceIds=new Set<string>();
  for(const value of evidence){
    if(!row(value)) return false;
    const id=verifiedOperatorProductionCreateId(value.evidence_id);
    const orderId=verifiedOperatorProductionCreateId(value.order_id);
    const auditAt=parseProductionEvidenceTimestamp(value.created_at);
    const orderCreatedAt=parseProductionEvidenceTimestamp(value.order_created_at);
    const relatedOrder=orderId?orderTimes.get(orderId):undefined;
    if(!id||evidenceIds.has(id)
      ||!orderId
      ||!validRevision(value.revision_id)
      ||!validRecipeHash(value.recipe_hash)
      ||!Number.isFinite(orderCreatedAt)||orderCreatedAt>auditAt
      ||(relatedOrder&&(orderCreatedAt!==relatedOrder.createdAt
        ||value.revision_id!==relatedOrder.revision
        ||value.recipe_hash!==relatedOrder.hash))
      ||typeof value.manual_design_reentry!=="boolean"
      ||(value.manual_design_reentry===false&&Array.isArray(value.reentry_fields)&&value.reentry_fields.length>0)
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
