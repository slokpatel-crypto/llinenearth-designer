// An ambiguous stock POST may have committed in PostgreSQL even when its
// HTTP acknowledgment was lost. Never invite a blind duplicate physical write.
// Explicit 4xx rejects are definitive; a malformed HTTP 200, 5xx, or network
// failure must be reconciled against the real ledger and source evidence.
export function stockMutationNeedsReconciliation(
  requestSent:boolean,
  acknowledged:boolean,
  httpStatus:number|null,
):boolean{
  if(!requestSent||acknowledged)return false;
  return !(httpStatus!==null&&httpStatus>=400&&httpStatus<500);
}
