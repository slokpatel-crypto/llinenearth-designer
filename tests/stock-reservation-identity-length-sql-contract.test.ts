import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const migration=readFileSync("supabase/migrations/20261103_stock_reservation_identity_length_gate.sql","utf8");
const fixture=readFileSync("supabase/tests/20261103_stock_reservation_identity_length_gate.sql","utf8");
const workflow=readFileSync(".github/workflows/ci.yml","utf8");

test("all five reservation identity and evidence fields reject lossy truncation",()=>{
  for(const [name,max] of [["fabric",160],["key",180],["revision",220],
    ["requester",120],["source",240]]){
    assert.ok(migration.includes("v_"+name+" text:=trim(coalesce("));
    assert.ok(migration.includes("length(v_"+name+")>"+max));
    assert.ok(!migration.includes("v_"+name+" text:=left("));
  }
  assert.ok(migration.includes("reservation identity or evidence exceeds supported length"));
  assert.ok(migration.includes("using errcode='22023'"));
  assert.ok(migration.includes("coalesce(s.provenance_ready,false)"));
  assert.ok(migration.includes("from public,anon,authenticated"));
  assert.ok(migration.includes("to service_role"));
  assert.doesNotMatch(migration,/drop table|truncate|delete from private\\.fabric_stock_ledger/i);
});
test("rollback-only native SQL covers all overlong aliases and exact retry",()=>{
  assert.ok(fixture.includes("begin;")&&fixture.includes("rollback;"));
  assert.ok(fixture.includes("titan.synthetic_sql_test"));
  for(let i=1;i<=5;i++)assert.ok(fixture.includes("v_case="+i));
  assert.ok(fixture.includes("maximum-length reservation or exact replay failed"));
  assert.ok(fixture.includes("oversize retries changed stock ledger"));
  assert.ok(workflow.includes("supabase/migrations/20261103_stock_reservation_identity_length_gate.sql"));
  assert.ok(workflow.includes("cat supabase/tests/20261103_stock_reservation_identity_length_gate.sql"));
});
