/**
 * The current production_order_list RPC returns the NEWEST 500 orders,
 * while production_delivery_evidence_list returns the OLDEST 500 receipts.
 * Both are capped at 500. If either returns exactly the cap, the caller
 * cannot know whether rows were omitted and therefore cannot certify the
 * first ten actual deliveries from these two partial, differently sorted
 * windows. Fail closed until a cursor/total-aware ledger RPC is deployed.
 */
export const PRODUCTION_DELIVERY_LEDGER_RPC_LIMIT=500 as const;

export function deliveryLedgerSnapshotIsExhaustive(
  orders:unknown,
  evidence:unknown,
  limit:number=PRODUCTION_DELIVERY_LEDGER_RPC_LIMIT,
):boolean{
  return Number.isSafeInteger(limit)&&limit>0&&
    Array.isArray(orders)&&Array.isArray(evidence)&&
    orders.length<limit&&evidence.length<limit;
}
