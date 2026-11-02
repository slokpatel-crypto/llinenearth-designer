import {PRODUCTION_REENTRY_FIELDS} from "./production-delivery-evidence.ts";

// A successful HTTP 200 is not permission to display a ten-delivery gate.
// The UI verifies its incoming snapshot independently of the service's
// stronger ledger validator, so stale/malformed data never looks approved.
export type DeliverySnapshotOrder={
  order_id:string;revision_id:string;recipe_hash:string;
  status:string;note:string;created_at:string;
};
export type DeliverySnapshotAudit={
  evidence_id:string;order_id:string;revision_id:string;recipe_hash:string;
  manual_design_reentry:boolean;reentry_fields:string[];
  note:string;operator:string;evidence_reference?:string;
  created_at:string;order_created_at:string;
};
export type DeliverySnapshot={
  orders:DeliverySnapshotOrder[];
  evidence:DeliverySnapshotAudit[];
};

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const STATUSES=new Set(["created","cloth_reserved","cutting","stitching",
  "fitting","ready","delivered","cancelled"]);
const REENTRY=new Set<string>(PRODUCTION_REENTRY_FIELDS.map(field=>field.id));
const object=(v:unknown):v is Record<string,unknown> =>
  v!==null&&typeof v==="object"&&!Array.isArray(v);
const validDate=(v:unknown):v is string=>
  typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&
  /(Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
const fail=():never=>{throw new Error("Unverified production delivery snapshot.");};

export function requireDeliveryEvidenceSnapshot(input:unknown):DeliverySnapshot{
  if(!object(input)||input.configured!==true||
    !Array.isArray(input.orders)||!Array.isArray(input.evidence)||
    input.orders.length>500||input.evidence.length>500)return fail();
  const orderIds=new Set<string>();
  const orders:DeliverySnapshotOrder[]=input.orders.map((v:unknown)=>{
    if(!object(v)||typeof v.order_id!=="string"||!UUID.test(v.order_id)||
      orderIds.has(v.order_id.toLowerCase())||
      typeof v.revision_id!=="string"||!v.revision_id.trim()||
      typeof v.recipe_hash!=="string"||!SHA.test(v.recipe_hash)||
      !STATUSES.has(String(v.status))||typeof v.note!=="string"||
      !validDate(v.created_at))return fail();
    orderIds.add(v.order_id.toLowerCase());
    return {order_id:v.order_id,revision_id:v.revision_id,
      recipe_hash:v.recipe_hash,status:v.status as string,
      note:v.note,created_at:v.created_at};
  });
  const auditIds=new Set<string>(), auditedOrders=new Set<string>();
  const evidence:DeliverySnapshotAudit[]=input.evidence.map((v:unknown)=>{
    if(!object(v)||typeof v.evidence_id!=="string"||!UUID.test(v.evidence_id)||
      typeof v.order_id!=="string"||!UUID.test(v.order_id)||
      auditIds.has(v.evidence_id.toLowerCase())||
      auditedOrders.has(v.order_id.toLowerCase())||
      typeof v.revision_id!=="string"||!v.revision_id.trim()||
      typeof v.recipe_hash!=="string"||!SHA.test(v.recipe_hash)||
      typeof v.manual_design_reentry!=="boolean"||
      !Array.isArray(v.reentry_fields)||v.reentry_fields.length>12||
      !v.reentry_fields.every((x:unknown)=>typeof x==="string"&&REENTRY.has(x))||
      typeof v.note!=="string"||
      (v.operator!==null&&v.operator!==undefined&&typeof v.operator!=="string")||
      (v.evidence_reference!==null&&v.evidence_reference!==undefined&&typeof v.evidence_reference!=="string")||
      !validDate(v.created_at)||!validDate(v.order_created_at)||
      Date.parse(v.created_at)<Date.parse(v.order_created_at))return fail();
    auditIds.add(v.evidence_id.toLowerCase());
    auditedOrders.add(v.order_id.toLowerCase());
    const auditedOrderId=v.order_id.toLowerCase();
    const match=orders.find(o=>o.order_id.toLowerCase()===auditedOrderId);
    if(match&&(match.revision_id!==v.revision_id||
      match.recipe_hash!==v.recipe_hash||
      Date.parse(match.created_at)!==Date.parse(v.order_created_at)))return fail();
    return {evidence_id:v.evidence_id,order_id:v.order_id,
      revision_id:v.revision_id,recipe_hash:v.recipe_hash,
      manual_design_reentry:v.manual_design_reentry,
      reentry_fields:v.reentry_fields as string[],note:v.note,
      operator:typeof v.operator==="string"?v.operator:"",
      evidence_reference:typeof v.evidence_reference==="string"?v.evidence_reference:"",
      created_at:v.created_at,order_created_at:v.order_created_at};
  });
  return {orders,evidence};
}
