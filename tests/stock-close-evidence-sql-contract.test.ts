import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const migration=readFileSync("supabase/migrations/20261103_stock_close_evidence_integrity.sql","utf8");
const fixture=readFileSync("supabase/tests/20261103_stock_close_evidence_integrity.sql","utf8");
const workflow=readFileSync(".github/workflows/ci.yml","utf8");

test("stock close preserves exact checker and source evidence for release and consumption",()=>{
  assert.match(migration,/create or replace function public\.fabric_stock_release_v2\(/);
  assert.match(migration,/create or replace function public\.fabric_stock_consume_reservation_v2\(/);
  assert.equal((migration.match(/length\(trim\(coalesce\(p_source_reference,''\)\)\)>240/g)||[]).length,2);
  assert.match(migration,/length\(trim\(coalesce\(p_released_by,''\)\)\)>120/);
  assert.match(migration,/length\(trim\(coalesce\(p_checked_by,''\)\)\)>120/);
  assert.doesNotMatch(migration,/left\(trim\(p_(?:released_by|checked_by|source_reference)\)/);
  assert.match(migration,/p_actual_metres<>round\(p_actual_metres,3\)/);
  assert.match(migration,/pg_advisory_xact_lock\(hashtext\('stock-reservation:'\|\|p_reservation_id::text\)\)/);
  assert.match(migration,/from public,anon,authenticated/);
  assert.match(migration,/to service_role/);
  assert.doesNotMatch(migration,/\b(?:drop table|truncate table|delete from private\.fabric_stock_ledger)\b/i);
});

test("disposable rollback fixture rejects aliases and nonrepresentable usage",()=>{
  assert.match(fixture,/^begin;/m);
  assert.match(fixture,/^rollback;/m);
  assert.match(fixture,/titan\.synthetic_sql_test/);
  for(let i=1;i<=4;i++)assert.ok(fixture.includes("v_case="+i));
  assert.match(fixture,/1\.0004/);
  assert.match(fixture,/valid release\/consume evidence was altered/);
  assert.match(fixture,/stock close created duplicate or unexpected events/);
  assert.ok(workflow.includes("supabase/migrations/20261103_stock_close_evidence_integrity.sql"));
  assert.ok(workflow.includes("cat supabase/tests/20261103_stock_close_evidence_integrity.sql"));
});
