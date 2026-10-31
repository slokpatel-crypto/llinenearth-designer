import { validProductionDeliveryBrowseReceipt,validProductionBrowseFirstTenAgreement } from "./production-browse-receipt.ts";
import { validProductionFirstTenAuditBasis } from "./production-delivery-evidence.ts";

/** Service-role SQL rows may contain future customer, supplier, or financial
 * fields. Validate the full original evidence and cross-snapshot lineage
 * before copying only fields documented for the operator's delivery UI.
 * Never spread raw PostgREST rows or their nested arrays into the browser. */
function orderRow(order:Record<string,unknown>){
  return {
    order_id:order.order_id,
    revision_id:order.revision_id,
    recipe_hash:order.recipe_hash,
    status:order.status,
    note:order.note,
    created_at:order.created_at,
    delivered_at:order.delivered_at,
  };
}
function evidenceRow(evidence:Record<string,unknown>){
  return {
    evidence_id:evidence.evidence_id,
    order_id:evidence.order_id,
    revision_id:evidence.revision_id,
    recipe_hash:evidence.recipe_hash,
    manual_design_reentry:evidence.manual_design_reentry,
    reentry_fields:Array.isArray(evidence.reentry_fields)
      ?[...evidence.reentry_fields]:evidence.reentry_fields,
    note:evidence.note,
    operator:evidence.operator,
    evidence_reference:evidence.evidence_reference,
    created_at:evidence.created_at,
    order_created_at:evidence.order_created_at,
  };
}
export function safeProductionDeliveryTransport(orders:unknown,evidence:unknown,basis:unknown){
  if(!validProductionDeliveryBrowseReceipt(orders,evidence)
    ||!validProductionBrowseFirstTenAgreement(orders,evidence,basis))
    throw new Error("Invalid or contradictory production delivery evidence.");
  const safeOrders=(orders as Record<string,unknown>[]).map(orderRow);
  const safeEvidence=(evidence as Record<string,unknown>[]).map(evidenceRow);

  let safeBasis:unknown=null;
  if(basis!==null&&basis!==undefined){
    if(typeof basis!=="object"||Array.isArray(basis))
      throw new Error("Invalid delivery history basis.");
    const raw=basis as Record<string,unknown>;
    // Explicitly invalid historical evidence must stay invalid, but its
    // arbitrary SQL fields and nested row objects must never be disclosed.
    if(raw.historyValid===false){
      safeBasis={version:"linen-earth-production-first-ten-audit-v2",
        historyValid:false,orders:[],evidence:[]};
    }else{
      if(raw.historyValid!==true||!validProductionFirstTenAuditBasis(raw))
        throw new Error("Invalid authoritative delivery history.");
      safeBasis={
        version:"linen-earth-production-first-ten-audit-v2",
        historyValid:true,
        orders:(raw.orders as Record<string,unknown>[]).map(orderRow),
        evidence:(raw.evidence as Record<string,unknown>[]).map(evidenceRow),
      };
      if(!validProductionFirstTenAuditBasis(safeBasis))
        throw new Error("Delivery history changed during serialization.");
    }
  }
  if(!validProductionDeliveryBrowseReceipt(safeOrders,safeEvidence)
    ||!validProductionBrowseFirstTenAgreement(safeOrders,safeEvidence,safeBasis))
    throw new Error("Delivery evidence changed during safe serialization.");
  return {orders:safeOrders,evidence:safeEvidence,firstTenBasis:safeBasis};
}
