import {validateOperatorLedgerRows} from "./operator-optional-rpc.ts";

// Production evidence is sensitive: a JSON object from a privileged RPC is
// NOT necessarily a valid delivery, audit, or release-ready completion.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const statuses=new Set([
  "created","cloth_reserved","cutting","stitching","fitting",
  "ready","delivered","cancelled",
]);
const fail=():never=>{throw new Error("Invalid private production delivery ledger.");};
function field(value:unknown,min:number,max:number):string{
  if(typeof value!=="string"||value.trim()!==value||
    value.length<min||value.length>max)return fail();
  return value;
}
function uuid(value:unknown):string{
  const result=field(value,36,36);
  if(!UUID.test(result))return fail();
  return result.toLowerCase();
}
function stamp(value:unknown):string{
  const result=field(value,20,64);
  if(!/^\d{4}-\d{2}-\d{2}T/.test(result)||
    !/(Z|[+-]\d{2}:\d{2})$/.test(result)||
    !Number.isFinite(Date.parse(result)))return fail();
  return result;
}
function hash(value:unknown):string{
  const result=field(value,64,64);
  if(!SHA.test(result))return fail();
  return result;
}
export type VerifiedProductionOrder={
  order_id:string;revision_id:string;recipe_hash:string;quote_id:string|null;
  status:string;note:string;created_at:string;updated_at:string;
};
export type VerifiedProductionDeliveryAudit={
  evidence_id:string;order_id:string;revision_id:string;recipe_hash:string;
  manual_design_reentry:boolean;reentry_fields:string[];note:string;
  operator:string;evidence_reference:string;created_at:string;
  order_created_at:string;
};
const reentry=new Set([
  "fabric_identity","construction","fit_measurements",
  "style_recipe","quote_order_identity","other",
]);

export function verifyProductionDeliveryOrders(value:unknown):VerifiedProductionOrder[]{
  const rows=validateOperatorLedgerRows(value,500);
  const ids=new Set<string>();
  return rows.map(row=>{
    const order_id=uuid(row.order_id);
    const revision_id=field(row.revision_id,1,160);
    const recipe_hash=hash(row.recipe_hash);
    const quote_id=row.quote_id===null?null:uuid(row.quote_id);
    const status=field(row.status,3,32);
    const note=field(row.note,0,1000);
    const created_at=stamp(row.created_at);
    const updated_at=stamp(row.updated_at);
    if(ids.has(order_id)||!statuses.has(status)||
      Date.parse(updated_at)<Date.parse(created_at))return fail();
    ids.add(order_id);
    return {order_id,revision_id,recipe_hash,quote_id,status,note,created_at,updated_at};
  });
}

export function verifyProductionDeliveryAudits(value:unknown):VerifiedProductionDeliveryAudit[]{
  const rows=validateOperatorLedgerRows(value,500);
  const ids=new Set<string>();
  const orderIds=new Set<string>();
  return rows.map(row=>{
    const evidence_id=uuid(row.evidence_id);
    const order_id=uuid(row.order_id);
    const revision_id=field(row.revision_id,1,160);
    const recipe_hash=hash(row.recipe_hash);
    if(typeof row.manual_design_reentry!=="boolean")return fail();
    const manual_design_reentry=row.manual_design_reentry;
    if(!Array.isArray(row.reentry_fields)||row.reentry_fields.length>12||
      !row.reentry_fields.every(item=>typeof item==="string"&&reentry.has(item)))
      return fail();
    const reentry_fields=row.reentry_fields as string[];
    const note=field(row.note,0,1200);
    // Empty provenance on a historical audit is still readable, but the
    // ten-delivery approval gate must refuse it. Never forge missing evidence.
    const operator=row.operator===null? "":field(row.operator,0,120);
    const evidence_reference=row.evidence_reference===null||
      row.evidence_reference===undefined?"":field(row.evidence_reference,0,240);
    const created_at=stamp(row.created_at);
    const order_created_at=stamp(row.order_created_at);
    if(ids.has(evidence_id)||orderIds.has(order_id)||
      Date.parse(created_at)<Date.parse(order_created_at))return fail();
    ids.add(evidence_id);
    orderIds.add(order_id);
    return {evidence_id,order_id,revision_id,recipe_hash,
      manual_design_reentry,reentry_fields,note,operator,evidence_reference,
      created_at,order_created_at};
  });
}
