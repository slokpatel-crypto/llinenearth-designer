/** Defensive, privacy-minimized customer outcome transport.
 * Call ONLY after full original production desk envelope validation. This
 * projection must not repair false rating/fit/lineage claims. */
export function safeProductionCustomerOutcomes(rows:unknown){
  if(!Array.isArray(rows)||rows.length>250)
    throw new Error("Unverified customer outcome ledger.");
  return rows.map(value=>{
    if(value===null||typeof value!=="object"||Array.isArray(value))
      throw new Error("Malformed customer outcome evidence.");
    const row=value as Record<string,unknown>;
    // Do not copy arbitrary SQL/RPC columns to a browser or to a document.
    return {
      outcome_id:row.outcome_id,
      order_id:row.order_id,
      revision_id:row.revision_id,
      overall_rating:row.overall_rating,
      fit_result:row.fit_result,
      worn_confirmed:row.worn_confirmed,
      note:row.note,
      created_at:row.created_at,
    };
  });
}
