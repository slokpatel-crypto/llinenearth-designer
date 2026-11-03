import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const migration=readFileSync("supabase/migrations/20261103_stock_reservation_provenance_gate.sql","utf8");
const fixture=readFileSync("supabase/tests/20261103_stock_reservation_provenance_gate.sql","utf8");
const workflow=readFileSync(".github/workflows/ci.yml","utf8");

test("new reservation requires positive physical stock AND complete named provenance",()=>{
  assert.match(migration,/create or replace function public\.fabric_stock_reserve_v2\(/);
  assert.match(migration,/coalesce\(s\.provenance_ready,false\)/);
  assert.match(migration,/coalesce\(s\.physical_metres,0\)/);
  assert.match(migration,/not coalesce\(v_provenance_ready,false\)/);
  assert.match(migration,/reservation requires verified physical stock provenance/);
  const lock=migration.indexOf("pg_advisory_xact_lock(hashtext('stock-fabric:'||v_fabric))");
  const gate=migration.indexOf("if not coalesce(v_provenance_ready,false)");
  const insert=migration.indexOf("insert into private.fabric_stock_ledger(");
  assert.ok(lock>=0&&gate>lock&&insert>gate,"check provenance inside fabric lock before insertion");
  assert.ok(migration.indexOf("return v_existing.reservation_id")<gate,
    "exactly matching retries retain their original idempotent reservation ID");
  assert.match(migration,/revoke all on function public\.fabric_stock_reserve_v2\([\s\S]*?from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public\.fabric_stock_reserve_v2\([\s\S]*?to service_role/);
  assert.doesNotMatch(migration,/drop table|truncate|delete from private\.fabric_stock_ledger/i);
});

test("disposable PostgreSQL CI executes rollback-only legacy, mixed and verified cases",()=>{
  assert.match(fixture,/^begin;/m);
  assert.match(fixture,/current_setting\('titan\.synthetic_sql_test',true\)/);
  assert.match(fixture,/^rollback;/m);
  for(const phrase of ["legacy unverified stock unexpectedly reserved",
    "mixed unverified stock unexpectedly reserved","verified same-evidence idempotent retry failed",
    "unverified stock wrote a reservation","verified retry wrote duplicate reservation"])
    assert.ok(fixture.includes(phrase),phrase);
  assert.match(workflow,/supabase\/migrations\/20261103_stock_reservation_provenance_gate\.sql/);
  assert.match(workflow,/cat supabase\/tests\/20261103_stock_reservation_provenance_gate\.sql/);
});
