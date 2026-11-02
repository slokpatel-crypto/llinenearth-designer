// TITAN isolated main safety hold for the legacy v2 operator stock route.
// The linked v3 SQL migration and idempotent manual recording are not live.
// A working v2 snapshot must never imply approval to mutate real cloth.
export function legacyStockWritesEnabled(setting:string|undefined=process.env.LINEN_STOCK_WRITES_ENABLED):boolean{
  // This is an explicit legacy-only opt-in for isolated synthetic regression
  // rehearsals. Leave unset on all production and real-staging deployments.
  return setting==="test-v2-only";
}
