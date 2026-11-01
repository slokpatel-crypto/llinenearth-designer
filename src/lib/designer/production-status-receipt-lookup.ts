/** Exact committed SQL status receipts, not a capped quote/order list.
 * Empty results are NOT proof that an in-flight transaction will not commit. */
export type ProductionStatusReceipt={
  action:"quote_status"|"order_status";
  recordId:string;
  status:string;
};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const quoteStatuses=new Set(["sent","accepted","void"]);
const orderStatuses=new Set(["cloth_reserved","cutting","stitching","fitting","ready","cancelled","delivered"]);
export function parseProductionStatusReceipts(input:unknown):ProductionStatusReceipt[]|null{
  if(!Array.isArray(input)||input.length>3)return null;
  const result:ProductionStatusReceipt[]=[];
  const seen=new Set<string>();
  for(const item of input){
    if(!item||typeof item!=="object"||Array.isArray(item))return null;
    const row=item as Record<string,unknown>;
    if(Object.keys(row).some(k=>k!=="action"&&k!=="record_id"&&k!=="target_status"))return null;
    if(row.action!=="quote_status"&&row.action!=="order_status")return null;
    if(typeof row.record_id!=="string"||typeof row.target_status!=="string")return null;
    const recordId=row.record_id.toLowerCase();
    if(!uuid.test(recordId))return null;
    if(!(row.action==="quote_status"?quoteStatuses:orderStatuses).has(row.target_status))return null;
    const key=row.action+":"+recordId+":"+row.target_status;
    if(seen.has(key))return null;
    seen.add(key);
    result.push({action:row.action,recordId,status:row.target_status});
  }
  return result;
}
