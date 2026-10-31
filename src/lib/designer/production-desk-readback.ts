import {verifiedOperatorProductionCreateId} from "./operator-production-receipt.ts";
import {sameProductionRecipeHash} from "./production-desk-ledger.ts";
import {normalizeProductionQuoteDraft} from "./production-quote.ts";

type Row=Record<string,unknown>;
function rows(value:unknown):Row[]{
  return Array.isArray(value)?value.filter((row):row is Row=>
    row!==null&&typeof row==="object"&&!Array.isArray(row)):[];
}
function asRow(value:unknown):Row|null{
  return value!==null&&typeof value==="object"&&!Array.isArray(value)
    ?value as Row:null;
}
function sameId(a:unknown,b:unknown):boolean{
  const id=verifiedOperatorProductionCreateId(a);
  return id!==null&&id===verifiedOperatorProductionCreateId(b);
}

/** A newly created quote is a financial instruction, not merely a UUID.
 * Re-read the exact normalized operator-entered lines, paise totals and note;
 * a wrong-price quote with the correct recipe/currency must never say saved. */
function sameCreatedQuoteFinancials(row:Row,body:Row):boolean{
  let draft:ReturnType<typeof normalizeProductionQuoteDraft>;
  try{
    draft=normalizeProductionQuoteDraft({
      currency:body.currency,lineItems:body.lineItems,adjustment:body.adjustment,
    });
  }catch{return false;}
  const note=body.note===undefined||body.note===null?"":body.note;
  if(typeof note!=="string"||row.note!==note.trim()
    ||row.currency!==draft.currency||row.status!=="draft"
    ||!Array.isArray(row.line_items)||row.line_items.length!==draft.lineItems.length) return false;
  const paise=(value:unknown):number|null=>
    typeof value==="number"&&Number.isFinite(value)?Math.round(value*100):null;
  if(paise(row.subtotal)!==paise(draft.subtotal)
    ||paise(row.adjustment)!==paise(draft.adjustment)
    ||paise(row.total)!==paise(draft.total)) return false;
  return draft.lineItems.every((line,index)=>{
    const saved=asRow((row.line_items as unknown[])[index]);
    return saved!==null&&saved.label===line.label
      &&paise(saved.amount)===paise(line.amount);
  });
}

/** Mutation RPC success is not production history. This pure readback gate
 * runs after a full, independently validated and fresh production GET. It
 * matches a literal durable record ID, expected lock and requested status.
 * Never infer quote/order completion from an unrelated newly visible row. */
export function verifiedProductionMutationReadback(
  action:unknown,request:unknown,receipt:unknown,
  quoteRows:unknown,orderRows:unknown,contextRows:unknown,
):boolean{
  const body=asRow(request),created=asRow(receipt);
  if(!body||!created)return false;
  const quotes=rows(quoteRows),orders=rows(orderRows),contexts=rows(contextRows);
  if(action==="create_quote"){
    const id=verifiedOperatorProductionCreateId(created.quoteId);
    if(!id||created.lockedRevisionVerified!==true)return false;
    return quotes.some(row=>sameId(row.quote_id,id)
      &&row.revision_id===body.revisionId
      &&sameProductionRecipeHash(row.recipe_hash,body.recipeHash)
      &&sameCreatedQuoteFinancials(row,body));
  }
  if(action==="create_order"){
    const id=verifiedOperatorProductionCreateId(created.orderId);
    if(!id||created.lockedRevisionVerified!==true
      ||created.learningContextAttached!==true)return false;
    const expectedQuote=body.quoteId===""||body.quoteId===null||body.quoteId===undefined
      ?null:verifiedOperatorProductionCreateId(body.quoteId);
    if(expectedQuote===null&&body.quoteId!==""&&body.quoteId!==null
      &&body.quoteId!==undefined)return false;
    return orders.some(row=>sameId(row.order_id,id)
      &&row.revision_id===body.revisionId
      &&sameProductionRecipeHash(row.recipe_hash,body.recipeHash)
      &&(expectedQuote===null?row.quote_id===null:sameId(row.quote_id,expectedQuote)))
      &&contexts.some(context=>sameId(context.order_id,id)
        &&context.revision_id===body.revisionId
        &&sameProductionRecipeHash(context.recipe_hash,body.recipeHash));
  }
  if(action==="quote_status"){
    if(created.updated!==true||!verifiedOperatorProductionCreateId(body.quoteId)
      ||typeof body.status!=="string")return false;
    return quotes.some(row=>sameId(row.quote_id,body.quoteId)
      &&row.status===body.status);
  }
  if(action==="order_status"){
    if(created.updated!==true||!verifiedOperatorProductionCreateId(body.orderId)
      ||typeof body.status!=="string")return false;
    return orders.some(row=>sameId(row.order_id,body.orderId)
      &&row.status===body.status);
  }
  return false;
}
