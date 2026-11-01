/** Private, read-only committed creation receipts; no customer fields.
 * Empty array only says no COMMITTED matching key was visible at read time.
 * It MUST NOT be interpreted as proof that an in-flight write will not commit. */
export type ProductionCreationReceipt={
  action:"create_quote"|"create_order";
  receiptId:string;
};
export function parseProductionCreationReceipts(input:unknown):ProductionCreationReceipt[]|null{
  if(!Array.isArray(input)||input.length>2)return null;
  const result:ProductionCreationReceipt[]=[];
  const seen=new Set<string>();
  for(const item of input){
    if(!item||typeof item!=="object"||Array.isArray(item))return null;
    const row=item as Record<string,unknown>;
    if(Object.keys(row).some(key=>key!=="action"&&key!=="receipt_id"))return null;
    if(row.action!=="create_quote"&&row.action!=="create_order")return null;
    if(seen.has(row.action))return null;
    if(typeof row.receipt_id!=="string")return null;
    // SQL uses UUID for the receipt: accept the canonical 8-4-4-4-12 format,
    // including v1/v7 Postgres IDs, without relying on a v4-only request parser.
    const receiptId=row.receipt_id.toLowerCase();
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(receiptId))return null;
    seen.add(row.action);
    result.push({action:row.action,receiptId});
  }
  return result;
}

/** The private operator API sends normalized safe receipt IDs, not raw SQL
 * columns. Revalidate exactly this browser wire shape before showing proof;
 * never widen the upstream SQL parser to tolerate unexpected private fields. */
export function parseProductionCreationReceiptResponse(input:unknown):ProductionCreationReceipt[]|null{
  if(!Array.isArray(input)||input.length>2)return null;
  const sqlRows:Array<Record<string,unknown>>=[];
  for(const item of input){
    if(!item||typeof item!=="object"||Array.isArray(item))return null;
    const row=item as Record<string,unknown>;
    const keys=Object.keys(row);
    if(keys.length!==2||!["action","receiptId"].every(key=>Object.prototype.hasOwnProperty.call(row,key)))return null;
    sqlRows.push({action:row.action,receipt_id:row.receiptId});
  }
  return parseProductionCreationReceipts(sqlRows);
}
