import {validProductionDeskLedgers} from "./production-desk-ledger.ts";

/** The operator can see validated quote/order fields, not arbitrary service-role
 * database columns accidentally exposed by a newer RPC or SQL view. This
 * filtering occurs AFTER full lineage and monetary verification: never omit
 * a contradictory upstream field just to make an invalid ledger pass. */
export function safeProductionQuoteOrderRows(quotes:unknown,orders:unknown){
  if(!validProductionDeskLedgers(quotes,orders))
    throw new Error("Unverified production quote/order ledger.");
  // Validity checked before copying. These are exhaustive client-used public
  // operator fields; never spread raw PostgREST rows or line-item objects.
  const safeQuotes=(quotes as Record<string,unknown>[]).map(q=>({
    quote_id:q.quote_id,
    revision_id:q.revision_id,
    recipe_hash:q.recipe_hash,
    currency:q.currency,
    line_items:(q.line_items as Array<Record<string,unknown>>).map(line=>({
      label:line.label,
      amount:line.amount,
    })),
    subtotal:q.subtotal,
    adjustment:q.adjustment,
    total:q.total,
    note:q.note,
    status:q.status,
    created_at:q.created_at,
    updated_at:q.updated_at,
  }));
  const safeOrders=(orders as Record<string,unknown>[]).map(o=>({
    order_id:o.order_id,
    revision_id:o.revision_id,
    recipe_hash:o.recipe_hash,
    quote_id:o.quote_id,
    status:o.status,
    note:o.note,
    created_at:o.created_at,
    updated_at:o.updated_at,
  }));
  if(!validProductionDeskLedgers(safeQuotes,safeOrders))
    throw new Error("Production quote/order ledger changed during safe serialization.");
  return {quotes:safeQuotes,orders:safeOrders};
}
