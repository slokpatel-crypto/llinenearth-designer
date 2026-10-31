import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("M126 delivery replay receipts are protected from UPDATE, DELETE and TRUNCATE",()=>{
  const sql=readFileSync("supabase/migrations/20261116_delivery_receipts_immutable.sql","utf8");
  assert.match(sql,/create or replace function private\.reject_production_delivery_receipt_mutation\(\)/i);
  assert.match(sql,/set search_path='pg_catalog'/);
  assert.match(sql,/using errcode='55000'/);
  assert.match(sql,/revoke all on function private\.reject_production_delivery_receipt_mutation\(\)/i);
  assert.match(sql,/from public,anon,authenticated/);
  assert.match(sql,/before update or delete on private\.production_delivery_request_receipts/i);
  assert.match(sql,/before truncate on private\.production_delivery_request_receipts/i);
  assert.match(sql,/for each row execute function private\.reject_production_delivery_receipt_mutation\(\)/i);
  assert.match(sql,/for each statement execute function private\.reject_production_delivery_receipt_mutation\(\)/i);
  assert.doesNotMatch(sql,/^\s*(?:update|delete|truncate)\s+private\.production_delivery_request_receipts/im,
    "Migration must install triggers, not edit historic durable replay evidence");
});

test("M126 atomic delivery replay survives direct privileged receipt mutations",()=>{
  const assertions=readFileSync("scripts/ci/m126-delivery-receipt-immutability-assertions.sql","utf8");
  const runner=readFileSync("scripts/ci/verify-production-create-idempotency.sh","utf8");
  for(const line of [
    "update private.production_delivery_request_receipts",
    "delete from private.production_delivery_request_receipts",
    "truncate private.production_delivery_request_receipts",
    "exception when sqlstate '55000'",
    "production_order_deliver_idempotent",
    "delivery key belongs to different instructions",
    "private.production_order_events",
  ]) assert.ok(assertions.includes(line),"Missing replay integrity negative test: "+line);
  const a=runner.indexOf("run_file supabase/migrations/20261115_finished_garment_qc_immutable.sql");
  const b=runner.indexOf("run_file supabase/migrations/20261116_delivery_receipts_immutable.sql");
  const c=runner.indexOf("run_file scripts/ci/m126-delivery-receipt-immutability-assertions.sql");
  const d=runner.indexOf("run_file scripts/ci/m122-qc-schema-readonly-preflight.sql");
  assert.ok(a>=0&&b>a&&c>b&&d>c,
    "Append-only replay receipts must be installed and tested before installed-schema audit");
  const catalog=readFileSync("scripts/ci/m122-qc-schema-readonly-preflight.sql","utf8");
  assert.match(catalog,/v_receipt_immutability/);
  assert.match(catalog,/production_delivery_receipt_append_only/);
  assert.match(catalog,/production_delivery_receipt_no_truncate/);
  assert.match(catalog,/delivery replay receipt append-only trigger missing or disabled/);
  assert.match(catalog,/delivery receipt append-only function insecure/);
  assert.match(catalog,/BEGIN READ ONLY;/);
});

test("M126 private replay cannot be altered from operator client, even after lost acknowledgement",()=>{
  const m112=readFileSync("supabase/migrations/20261111_delivery_idempotency.sql","utf8");
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  assert.match(m112,/production_delivery_request_receipts enable row level security/i);
  assert.match(m112,/revoke all on private\.production_delivery_request_receipts from public,anon,authenticated/i);
  assert.match(m112,/v_saved<>v_hash/);
  assert.match(m112,/return true;/);
  assert.match(route,/production_order_deliver_idempotent/);
  assert.match(route,/if\(!await authorized\(\)\)/);
});
