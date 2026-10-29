import { parseCustomerProductionRecordId } from "./customer-production-outcomes";

/** A successful privileged creation RPC must return its exact UUID scalar.
 * Do not report a created quote/order from a truthy object, array, boolean,
 * padded string or malformed upstream response. */
export function verifiedOperatorProductionCreateId(value:unknown):string|null{
  if(typeof value!=="string") return null;
  const id=parseCustomerProductionRecordId(value);
  return id&&value.toLowerCase()===id?id:null;
}
