// Deliberate operator/production rollout gate. A readable v2 ledger snapshot
// does NOT establish that the stock v3 write migration is present. Stock
// mutations must stay disabled until a separate isolated Supabase rehearsal,
// rollback plan and operator approval are complete. Server-only setting.
export function stockWritesEnabled(setting:string|undefined=process.env.LINEN_STOCK_WRITES_ENABLED):boolean{
  return setting==="enabled";
}
