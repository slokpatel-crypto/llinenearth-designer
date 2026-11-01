/** A configured operator ledger must not turn malformed upstream SQL JSON into
 * an apparently empty, safe-to-act-on production history. These are the actual
 * per-RPC p_limit values requested by the production GET route. */
const LIMITS={quotes:100,orders:100,qcInspections:250,customerOutcomes:250,learningContexts:500} as const;
type LedgerName=keyof typeof LIMITS;

export function assertProductionLedgerLists(lists:Record<LedgerName,unknown>):void {
  for(const name of Object.keys(LIMITS) as LedgerName[]){
    const rows=lists[name];
    if(!Array.isArray(rows)||rows.length>LIMITS[name]||
       rows.some(row=>row===null||typeof row!=="object"||Array.isArray(row))){
      throw new Error("Production ledger response failed shape verification.");
    }
  }
}
