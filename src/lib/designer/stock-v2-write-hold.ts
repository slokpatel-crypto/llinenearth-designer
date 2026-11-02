// Isolated legacy-v2 stock write hold until reviewed v3 migrations are live.
// Never treat a readable v2 snapshot as permission for stock mutations.
export function legacyStockWritesEnabled(
  setting:string|undefined=process.env.LINEN_STOCK_WRITES_ENABLED,
  synthetic:string|undefined=process.env.TITAN_SYNTHETIC_STOCK_TEST,
  upstream:string|undefined=process.env.SUPABASE_URL,
  vercel:string|undefined=process.env.VERCEL,
):boolean{
  // Only the existing, disposable built-Next fake localhost PostgREST fixture
  // can exercise legacy v2 RPC response validation; real environments stay
  // read-only, even if somebody enables the future v3 rollout setting.
  return setting==="test-v2-only" &&
    synthetic==="enabled" &&
    !vercel &&
    /^http:\/\/127\.0\.0\.1:\d{1,5}\/?$/.test(upstream||"");
}
