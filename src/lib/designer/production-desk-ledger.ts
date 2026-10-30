import { verifiedOperatorProductionCreateId } from "./operator-production-receipt.ts";
import { parseProductionEvidenceTimestamp } from "./production-delivery-evidence.ts";

const QUOTE_STATUSES=new Set(["draft","sent","accepted","void"]);
const ORDER_STATUSES=new Set(["created","cloth_reserved","cutting","stitching","fitting","ready","delivered","cancelled"]);

function record(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==="object"&&!Array.isArray(value);
}
function revision(value:unknown):value is string{
  return typeof value==="string"&&value.length>=12&&value.length<=220&&value===value.trim();
}
function hash(value:unknown):value is string{
  return typeof value==="string"&&/^[a-f0-9]{64}$/i.test(value);
}
function validDatePair(value:Record<string,unknown>):boolean{
  const created=parseProductionEvidenceTimestamp(value.created_at);
  const updated=parseProductionEvidenceTimestamp(value.updated_at);
  return Number.isFinite(created)&&Number.isFinite(updated)&&updated>=created;
}
function money(value:unknown):value is number{
  // PostgREST returns PostgreSQL numeric as JSON numbers; never coerce a
  // string, null, object or NaN into a customer-facing quote amount.
  return typeof value==="number"&&Number.isFinite(value)&&Math.abs(value)<=10_000_000_000;
}
function validQuote(value:unknown):value is Record<string,unknown>{
  if(!record(value)||!verifiedOperatorProductionCreateId(value.quote_id)
    ||!revision(value.revision_id)||!hash(value.recipe_hash)
    ||typeof value.currency!=="string"||!/^[A-Z]{3}$/.test(value.currency)
    ||!QUOTE_STATUSES.has(value.status as string)
    ||typeof value.note!=="string"||!validDatePair(value)
    ||!money(value.subtotal)||value.subtotal<0
    ||!money(value.adjustment)||!money(value.total)||value.total<0
    ||!Array.isArray(value.line_items)||value.line_items.length<1||value.line_items.length>30) return false;
  // Existing SQL allowed longer historical labels and separately rounded
  // monetary totals. Preserve them rather than rewriting legacy receipts.
  if(!value.line_items.every((line:unknown)=>record(line)
    &&typeof line.label==="string"&&line.label.trim().length>0
    &&money(line.amount)&&line.amount>=0&&line.amount<=10_000_000)) return false;
  const linesTotal=(value.line_items as Array<{amount:number}>)
    .reduce((sum,line)=>sum+line.amount,0);
  // Older SQL rounded raw numeric line totals, adjustment and final total
  // separately. Allow up to two paise of legacy rounding drift, never a
  // materially different customer-facing total or subtotal.
  return Math.abs(Math.round(linesTotal*100)-Math.round((value.subtotal as number)*100))<=2
    &&Math.abs(Math.round(((value.subtotal as number)+(value.adjustment as number))*100)
      -Math.round((value.total as number)*100))<=2;
}
function validOrder(value:unknown):value is Record<string,unknown>{
  return record(value)&&Boolean(verifiedOperatorProductionCreateId(value.order_id))
    &&revision(value.revision_id)&&hash(value.recipe_hash)
    &&(value.quote_id===null||Boolean(verifiedOperatorProductionCreateId(value.quote_id)))
    &&ORDER_STATUSES.has(value.status as string)
    &&typeof value.note==="string"&&validDatePair(value);
}

/** A 200 JSON array is not necessarily a trustworthy operator ledger.
 * Fail closed on malformed/duplicate rows or contradictory linked receipts.
 * The two newest-100 lists are capped independently; an older quote omitted
 * from the current page is NOT evidence of a mismatched order. */
export function validProductionDeskLedgers(quotes:unknown,orders:unknown):boolean{
  if(!Array.isArray(quotes)||!Array.isArray(orders)
    ||quotes.length>100||orders.length>100) return false;
  const quoteIds=new Set<string>();
  const orderIds=new Set<string>();
  const byQuote=new Map<string,Record<string,unknown>>();
  for(const quote of quotes){
    if(!validQuote(quote)) return false;
    const id=verifiedOperatorProductionCreateId(quote.quote_id)!;
    if(quoteIds.has(id)) return false;
    quoteIds.add(id);
    byQuote.set(id,quote);
  }
  for(const order of orders){
    if(!validOrder(order)) return false;
    const id=verifiedOperatorProductionCreateId(order.order_id)!;
    if(orderIds.has(id)) return false;
    orderIds.add(id);
    if(order.quote_id!==null){
      const quote=byQuote.get(verifiedOperatorProductionCreateId(order.quote_id)!);
      if(quote&&(quote.status!=="accepted"
        ||quote.revision_id!==order.revision_id
        ||String(quote.recipe_hash).toLowerCase()!==String(order.recipe_hash).toLowerCase()
        ||parseProductionEvidenceTimestamp(quote.created_at)>parseProductionEvidenceTimestamp(order.created_at)))
        return false;
    }
  }
  return true;
}
