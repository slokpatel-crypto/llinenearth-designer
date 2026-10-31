import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("operator records do not await optional delivery eligibility RPC before rendering ledger",()=>{
  const ui=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const load=ui.split("  async function load(")[1]?.split("  useEffect(()=>{")[0]??"";
  assert.ok(load.length>1000);
  assert.match(load,/const response=await fetch\("\/api\/operator\/production",\{cache:"no-store"\}\)/);
  assert.doesNotMatch(load,/await Promise\.all\(\[/,
    "A slow optional QC hint must never delay ordinary verified production history");
  const ledgerCommit=load.indexOf("setOrders(data.orders as Order[])");
  const hintFetch=load.indexOf('fetch("/api/operator/production/delivery-eligibility"');
  assert.ok(ledgerCommit>=0&&hintFetch>ledgerCommit,
    "Render verified ledger before launching its optional QC hint");
  assert.match(load,/if\(data\.configured\)\{\s*void \(async\(\)=>\{/);
  assert.match(load,/let rows:ProductionDeliveryEligibility\[\]=\[\]/);
  assert.match(load,/if\(hint\.ok\)\{/);
  assert.match(load,/parseProductionDeliveryEligibility\(payload\.eligibility\)\?\?\[\]/);
  assert.match(load,/if\(readVersion===ledgerReadVersion\.current\)setDeliveryEligibility\(rows\)/);
  assert.match(load,/setDeliveryEligibility\(\[\]\)/);
  assert.match(load,/catch\{\s*\/\/ Advisory evidence is unavailable: fail closed without hiding orders\./);
  assert.match(load,/return data\.configured/);
});

test("the independently delayed QC hint is advisory and cannot authorize actual delivery",()=>{
  const ui=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const api=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const sql=readFileSync("supabase/migrations/20261113_delivery_qc_sequence_gate.sql","utf8");
  assert.match(ui,/hasVerifiedSqlDeliveryEligibility\(deliveryEligibility,item\)/);
  assert.match(ui,/status!=="delivered"\|\|deliveryQcVerified/);
  assert.match(api,/production_order_deliver_idempotent/);
  assert.match(sql,/fresh sequenced QC inspection required for delivery/);
  assert.match(sql,/six exact passing physical QC checks required before delivery/);
});
