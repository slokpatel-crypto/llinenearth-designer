import { parseCustomerProductionRecordId } from "./customer-production-outcomes.ts";

/** A successful privileged creation RPC must return its exact UUID scalar.
 * Do not report a created quote/order from a truthy object, array, boolean,
 * padded string or malformed upstream response. */
export function verifiedOperatorProductionCreateId(value:unknown):string|null{
  if(typeof value!=="string") return null;
  const id=parseCustomerProductionRecordId(value);
  return id&&value.toLowerCase()===id?id:null;
}

/** A successful audit write is not yet visible production history. Confirm
 * the exact immutable evidence receipt belongs to the same delivered order.
 * Never infer success from an unrelated order or another old evidence row. */
export function verifiedOperatorDeliveryAuditReadback(
  rows:unknown,
  receiptId:unknown,
  orderId:unknown,
):boolean{
  const receipt=verifiedOperatorProductionCreateId(receiptId);
  const order=verifiedOperatorProductionCreateId(orderId);
  if(!receipt||!order||!Array.isArray(rows))return false;
  return rows.some(row=>{
    if(!row||typeof row!=="object"||Array.isArray(row))return false;
    const record=row as Record<string,unknown>;
    return verifiedOperatorProductionCreateId(record.evidence_id)===receipt
      &&verifiedOperatorProductionCreateId(record.order_id)===order;
  });
}
