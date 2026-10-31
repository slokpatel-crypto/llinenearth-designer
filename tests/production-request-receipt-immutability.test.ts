import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const migration="supabase/migrations/20261118_production_request_receipts_immutable.sql";
const assertions="scripts/ci/m128-production-request-receipt-immutability-assertions.sql";
const ledgers=[
  ["production_creation_request_receipts","production_creation_receipt_append_only","production_creation_receipt_no_truncate"],
  ["production_quote_status_request_receipts","production_quote_status_receipt_append_only","production_quote_status_receipt_no_truncate"],
  ["production_order_status_request_receipts","production_order_status_receipt_append_only","production_order_status_receipt_no_truncate"],
] as const;

test("M128 three durable request-replay ledgers are private and append-only",()=>{
  const sql=readFileSync(migration,"utf8");
  assert.match(sql,/create or replace function private\.reject_production_request_receipt_mutation\(\)/);
  assert.match(sql,/set search_path='pg_catalog'/);
  assert.match(sql,/using errcode='55000'/);
  assert.match(sql,/revoke all on function private\.reject_production_request_receipt_mutation\(\)/);
  assert.match(sql,/from public,anon,authenticated/);
  for(const [table,row,truncate] of ledgers){
    assert.ok(sql.includes("before update or delete on private."+table));
    assert.ok(sql.includes("before truncate on private."+table));
    assert.ok(sql.includes(row));
    assert.ok(sql.includes(truncate));
  }
  assert.doesNotMatch(sql,/^\s*(?:insert into|update|delete from|truncate)\s+private\.production_(?:creation|quote_status|order_status)_request_receipts/im);
});

test("M128 live disposable SQL verifies original-key replay, changed intent veto and no duplicates",()=>{
  const sql=readFileSync(assertions,"utf8");
  const runner=readFileSync("scripts/ci/verify-production-create-idempotency.sh","utf8");
  for(const value of [
    "production_quote_create_idempotent(", "production_quote_set_status_idempotent(",
    "production_order_set_status_idempotent(", "v_create_key","v_quote_key","v_order_key",
    "update private.%I", "delete from private.%I", "truncate private.%I",
    "exception when sqlstate '55000'", "M128 replay created duplicate events",
    "quote status request key belongs to different instructions",
    "order status request key belongs to different instructions",
  ])assert.ok(sql.includes(value),"Missing genuine SQL proof "+value);
  const previous=runner.indexOf("run_file supabase/migrations/20261117_production_event_immutable.sql");
  const migrationAt=runner.indexOf("run_file "+migration);
  const assertionsAt=runner.indexOf("run_file "+assertions);
  const audit=runner.indexOf("run_file scripts/ci/m122-qc-schema-readonly-preflight.sql");
  assert.ok(previous>=0&&migrationAt>previous&&assertionsAt>migrationAt&&audit>assertionsAt);
});

test("M128 installed-schema catalog audit verifies all three triggers and client restrictions",()=>{
  const sql=readFileSync("scripts/ci/m122-qc-schema-readonly-preflight.sql","utf8");
  assert.match(sql,/BEGIN READ ONLY;/);
  assert.match(sql,/v_request_receipt_immutability/);
  assert.match(sql,/M128 request replay append-only trigger missing or disabled/);
  assert.match(sql,/M128 request replay table missing or client grants unsafe/);
  for(const [table,row,truncate] of ledgers){
    for(const token of [table,row,truncate])assert.ok(sql.includes(token));
  }
  const plan=readFileSync("docs/TITAN_QC_MIGRATION_STAGING_PLAN.md","utf8");
  assert.match(plan,/20261118_production_request_receipts_immutable\.sql/);
  // Subsequent reviewed tail migrations extend the same numbered plan.
  const entries=[...plan.matchAll(/^\\| \\d+ \\| \\x60(?:20\\d{6}_[^\\x60]+)\\x60 \\|/gm)];
  const claimed=plan.match(/Apply the ([a-z]+) migrations/);
  const numberWords:Record<string,number>={nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15};
  assert.ok(claimed&&numberWords[claimed[1]]===entries.length,
    "Staging procedure must state the actual number of ordered migration rows");
  assert.match(plan,/request receipts remain append-only/);
});
