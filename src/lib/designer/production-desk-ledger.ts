import { verifiedOperatorProductionCreateId } from "./operator-production-receipt.ts";
import { parseProductionEvidenceTimestamp } from "./production-delivery-evidence.ts";
import { CUSTOMER_OUTCOME_RATINGS, CUSTOMER_FIT_RESULTS } from "./customer-production-outcomes.ts";
import { PRODUCTION_LEARNING_CONTEXT_VERSION } from "./production-learning-context.ts";

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

/** The QC desk fetches 150 orders independently of the production desk's
 * newest-100 quote/order pages. Validate that complete, capped order page
 * without pretending an older missing quote is a contradiction. */
export function validProductionQcOrderRows(orders:unknown):orders is Record<string,unknown>[]{
  if(!Array.isArray(orders)||orders.length>150) return false;
  const seen=new Set<string>();
  for(const order of orders){
    if(!validOrder(order)) return false;
    const id=verifiedOperatorProductionCreateId(order.order_id)!.toLowerCase();
    if(seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

/** Optional RPCs can return a literal array containing forged or malformed rows.
 * The operator renders outcome fields directly and uses QC/context presence as
 * production evidence. A successful HTTP status is not a typed row receipt.
 * Preserve historical nullable QC provenance (which cannot approve delivery). */
function validOptionalEvidenceRows(rows:unknown,kind:"qc"|"outcome"|"context"):rows is unknown[]{
  if(!Array.isArray(rows)) return false;
  const seen=new Set<string>();
  for(const value of rows){
    if(!record(value)||!verifiedOperatorProductionCreateId(value.order_id)
      ||!Number.isFinite(parseProductionEvidenceTimestamp(value.created_at))) return false;
    if(kind==="qc"){
      const id=verifiedOperatorProductionCreateId(value.inspection_id);
      if(!id||(value.decision!=="approved"&&value.decision!=="rework")) return false;
      if(value.inspector!==null&&value.inspector!==undefined&&typeof value.inspector!=="string") return false;
      if(value.inspection_reference!==null&&value.inspection_reference!==undefined
        &&typeof value.inspection_reference!=="string") return false;
      if(seen.has(id)) return false;
      seen.add(id);
    }else if(kind==="outcome"){
      const id=verifiedOperatorProductionCreateId(value.outcome_id);
      if(!id||!revision(value.revision_id)
        ||typeof value.overall_rating!=="string"||!CUSTOMER_OUTCOME_RATINGS.some(rating=>rating===value.overall_rating)
        ||typeof value.fit_result!=="string"||!CUSTOMER_FIT_RESULTS.some(fit=>fit===value.fit_result)
        ||typeof value.worn_confirmed!=="boolean"
        ||(value.note!==null&&typeof value.note!=="string")) return false;
      if(seen.has(id)) return false;
      seen.add(id);
    }else{
      if(!revision(value.revision_id)||!hash(value.recipe_hash)
        ||!record(value.context)
        ||value.context.version!==PRODUCTION_LEARNING_CONTEXT_VERSION
        ||value.context.revisionId!==value.revision_id
        ||typeof value.context.recipeHash!=="string"
        ||value.context.recipeHash.toLowerCase()!==String(value.recipe_hash).toLowerCase()) return false;
    }
  }
  return true;
}

/** Optional evidence can be older than the newest-100 order page, but when
 * the linked order IS present, its immutable recipe lineage must agree.
 * Otherwise a forged outcome/context can be displayed on the wrong order. */
function validOptionalOrderLineage(orders:unknown[],qc:unknown[],outcomes:unknown[],contexts:unknown[]):boolean{
  const byId=new Map<string,Record<string,unknown>>();
  for(const order of orders){
    if(!record(order)) return false;
    const id=verifiedOperatorProductionCreateId(order.order_id);
    if(!id) return false;
    byId.set(id,order);
  }
  // An installed optional QC ledger is not authoritative if its visible
  // inspection predates the order or claims another immutable recipe.
  // Historical blank/null provenance remains readable but unverified.
  for(const row of qc){
    if(!record(row)) return false;
    const id=verifiedOperatorProductionCreateId(row.order_id);
    const order=id?byId.get(id):undefined;
    if(!order) continue; // independently capped order page
    if(parseProductionEvidenceTimestamp(row.created_at)<parseProductionEvidenceTimestamp(order.created_at)
      ||(row.revision_id!==null&&row.revision_id!==undefined&&row.revision_id!==""
        &&row.revision_id!==order.revision_id)
      ||(row.recipe_hash!==null&&row.recipe_hash!==undefined&&row.recipe_hash!==""
        &&(typeof row.recipe_hash!=="string"
          ||row.recipe_hash.toLowerCase()!==String(order.recipe_hash).toLowerCase()))) return false;
  }
  for(const row of outcomes){
    if(!record(row)) return false;
    const id=verifiedOperatorProductionCreateId(row.order_id);
    const order=id?byId.get(id):undefined;
    if(order&&(row.revision_id!==order.revision_id
      ||parseProductionEvidenceTimestamp(row.created_at)<parseProductionEvidenceTimestamp(order.created_at))) return false;
  }
  for(const row of contexts){
    if(!record(row)) return false;
    const id=verifiedOperatorProductionCreateId(row.order_id);
    const order=id?byId.get(id):undefined;
    if(!order) continue; // an older order may be outside this capped page
    if(parseProductionEvidenceTimestamp(row.created_at)<parseProductionEvidenceTimestamp(order.created_at)
      ||row.revision_id!==order.revision_id
      ||typeof row.recipe_hash!=="string"||typeof order.recipe_hash!=="string"
      ||row.recipe_hash.toLowerCase()!==order.recipe_hash.toLowerCase()) return false;
  }
  return true;
}

/** The browser must independently reject success-shaped, untrusted HTTP JSON.
 * A configured production desk needs explicit evidence source availability;
 * a backend-not-configured response cannot carry apparently real records. */
export type VerifiedProductionDeskResponse =
  | {configured:false;quotes:unknown[];orders:unknown[]}
  | {configured:true;quotes:unknown[];orders:unknown[];
      qcInspections:unknown[];customerOutcomes:unknown[];learningContexts:unknown[];
      optionalEvidenceSources:{qcInstalled:boolean;customerOutcomesInstalled:boolean;learningContextInstalled:boolean}};

export function validProductionDeskResponse(value:unknown):value is VerifiedProductionDeskResponse{
  if(!record(value)||typeof value.configured!=="boolean"
    ||!Array.isArray(value.quotes)||!Array.isArray(value.orders)
    ||!validProductionDeskLedgers(value.quotes,value.orders)) return false;
  if(value.configured===false){
    return value.quotes.length===0&&value.orders.length===0
      &&value.qcInspections===undefined&&value.customerOutcomes===undefined
      &&value.learningContexts===undefined&&value.optionalEvidenceSources===undefined;
  }
  const sources=value.optionalEvidenceSources;
  return validOptionalEvidenceRows(value.qcInspections,"qc")&&value.qcInspections.length<=250
    &&validOptionalEvidenceRows(value.customerOutcomes,"outcome")&&value.customerOutcomes.length<=250
    &&validOptionalEvidenceRows(value.learningContexts,"context")&&value.learningContexts.length<=500
    &&record(sources)&&typeof sources.qcInstalled==="boolean"
    &&typeof sources.customerOutcomesInstalled==="boolean"
    &&typeof sources.learningContextInstalled==="boolean"
    &&(sources.qcInstalled||value.qcInspections.length===0)
    &&(sources.customerOutcomesInstalled||value.customerOutcomes.length===0)
    &&(sources.learningContextInstalled||value.learningContexts.length===0)
    &&validOptionalOrderLineage(value.orders,value.qcInspections,value.customerOutcomes,value.learningContexts);
}

/** A 200 HTTP response is not a confirmed operator mutation. The browser
 * independently requires the exact server-side receipt for each action. */
export function validProductionDeskMutationReceipt(action:unknown,value:unknown):boolean{
  if(!record(value)) return false;
  if(action==="create_quote") return Boolean(verifiedOperatorProductionCreateId(value.quoteId))
    &&value.lockedRevisionVerified===true;
  if(action==="create_order") return Boolean(verifiedOperatorProductionCreateId(value.orderId))
    &&value.learningContextAttached===true&&value.lockedRevisionVerified===true;
  if(action==="quote_status"||action==="order_status") return value.updated===true;
  return false;
}

/** PostgreSQL UUID and SHA-256 hex casing is not part of immutable identity.
 * Keep operator history, accepted quote selection and packet links canonical. */
export function sameProductionRecordId(left:unknown,right:unknown):boolean{
  const canonical=verifiedOperatorProductionCreateId(left);
  return canonical!==null&&canonical===verifiedOperatorProductionCreateId(right);
}
export function sameProductionRecipeHash(left:unknown,right:unknown):boolean{
  return hash(left)&&hash(right)&&left.toLowerCase()===right.toLowerCase();
}

/** A production packet must never combine a quote and an order merely
 * because both use the same reusable locked recipe. An order's immutable
 * quote_id is the only authority for linking those two records. If more than
 * one order matches, the current desk has no order picker: refuse to guess.
 * A missing quote in the independently capped page remains unattached. */
export function selectProductionPacketRecords<
  Q extends {quote_id:string;revision_id:string;recipe_hash:string;status:string},
  O extends {order_id:string;revision_id:string;recipe_hash:string;quote_id:string|null},
>(
  quotes:readonly Q[],orders:readonly O[],revisionId:string,recipeHash:string,
):{quote:Q|null;order:O|null}{
  if(typeof revisionId!=="string"||!revision(revisionId)||!hash(recipeHash))
    throw new Error("A verified locked recipe is required for a production packet.");
  const sameRecipe=(row:{revision_id:string;recipe_hash:string})=>
    row.revision_id===revisionId&&sameProductionRecipeHash(row.recipe_hash,recipeHash);
  const matchingOrders=orders.filter(sameRecipe);
  if(matchingOrders.length>1)
    throw new Error("Multiple production orders share this locked recipe; select a specific order before exporting a linked packet.");
  const order=matchingOrders[0]??null;
  if(order){
    const quote=order.quote_id===null?null:
      quotes.find((row)=>sameRecipe(row)&&sameProductionRecordId(row.quote_id,order.quote_id))??null;
    return {quote,order};
  }
  const matchingQuotes=quotes.filter(sameRecipe);
  const accepted=matchingQuotes.filter((row)=>row.status==="accepted");
  if(accepted.length>1||(accepted.length===0&&matchingQuotes.length>1))
    throw new Error("Multiple quotes share this locked recipe; select a specific quote before exporting a linked packet.");
  return {quote:accepted[0]??matchingQuotes[0]??null,order:null};
}
