import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("M127 immutable production event migration seals both quote and order journals",()=>{
  const sql=readFileSync("supabase/migrations/20261117_production_event_immutable.sql","utf8");
  assert.match(sql,/create or replace function private\.reject_production_event_mutation\(\)/);
  assert.match(sql,/set search_path='pg_catalog'/);
  assert.match(sql,/using errcode='55000'/);
  assert.match(sql,/revoke all on function private\.reject_production_event_mutation\(\)/);
  for(const table of ["production_quote_events","production_order_events"]){
    assert.ok(sql.includes("before update or delete on private."+table));
    assert.ok(sql.includes("before truncate on private."+table));
  }
  assert.match(sql,/for each row execute function private\.reject_production_event_mutation/);
  assert.match(sql,/for each statement execute function private\.reject_production_event_mutation/);
  assert.doesNotMatch(sql,/^\s*(?:update|delete from|truncate)\s+private\.production_(?:quote|order)_events/im);
});

test("M127 real PostgreSQL assertions preserve accepted quote and delivered order history",()=>{
  const sql=readFileSync("scripts/ci/m127-production-event-immutability-assertions.sql","utf8");
  for(const value of [
    "production_quote_create(", "production_quote_set_status(",
    "production_order_create(", "finished_garment_qc_record_v2(",
    "production_order_deliver_idempotent(", "private.production_delivery_request_receipts",
    "update private.production_order_events", "delete from private.production_order_events",
    "truncate private.production_order_events",
    "update private.production_quote_events", "delete from private.production_quote_events",
    "truncate private.production_quote_events",
    "exception when sqlstate '55000'", "historical replay created duplicate",
  ])assert.ok(sql.includes(value),"Missing M127 live SQL check "+value);
  const runner=readFileSync("scripts/ci/verify-production-create-idempotency.sh","utf8");
  const receipt=runner.indexOf("run_file supabase/migrations/20261116_delivery_receipts_immutable.sql");
  const migration=runner.indexOf("run_file supabase/migrations/20261117_production_event_immutable.sql");
  const assertion=runner.indexOf("run_file scripts/ci/m127-production-event-immutability-assertions.sql");
  const audit=runner.indexOf("run_file scripts/ci/m122-qc-schema-readonly-preflight.sql");
  assert.ok(receipt>=0&&migration>receipt&&assertion>migration&&audit>assertion);
});

test("M127 read-only installed-schema preflight verifies both event journals",()=>{
  const audit=readFileSync("scripts/ci/m122-qc-schema-readonly-preflight.sql","utf8");
  for(const value of [
    "v_event_immutability", "v_quote_events", "v_order_events",
    "production_quote_event_append_only", "production_quote_event_no_truncate",
    "production_order_event_append_only", "production_order_event_no_truncate",
    "M127 production event append-only or TRUNCATE trigger missing or disabled",
    "M127 private event journal RLS or grants insecure",
    "BEGIN READ ONLY;",
  ])assert.ok(audit.includes(value),"M127 installed audit missing "+value);
});
