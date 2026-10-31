import {verifiedOperatorProductionCreateId} from "./operator-production-receipt.ts";
import {sameProductionRecipeHash} from "./production-desk-ledger.ts";

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
      &&row.currency===body.currency);
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
