import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const migration=readFileSync(
  "supabase/migrations/20261102_stock_reservation_key_payload_binding.sql","utf8");
const fixture=readFileSync(
  "supabase/tests/20261102_stock_reservation_key_payload_binding.sql","utf8");

test("reserve RPC binds idempotency key to all original physical stock evidence",()=>{
  assert.match(migration,/create or replace function public\.fabric_stock_reserve_v2\(/);
  assert.match(migration,/returns uuid[\s\S]*?language plpgsql[\s\S]*?security definer/);
  const lock=migration.indexOf("pg_advisory_xact_lock(hashtext('stock-request:'||v_key))");
  const lookup=migration.indexOf("select * into v_existing");
  const replay=migration.indexOf("if found then");
  const insert=migration.indexOf("insert into private.fabric_stock_ledger(");
  assert.ok(lock>=0&&lookup>lock&&replay>lookup&&insert>replay);
  for(const field of ["event_type","reservation_id","fabric_id","quantity_metres",
    "revision_id","recorded_by","source_reference"])
    assert.match(migration,new RegExp("v_existing\\."+field.replace("_","_")));
  assert.match(migration,/using errcode='22023'/);
  assert.match(migration,/return v_existing\.reservation_id/);
  assert.ok(migration.indexOf("raise exception 'reservation request key already belongs")<
    migration.indexOf("return v_existing.reservation_id"));
  assert.match(migration,/p_quantity_metres<>round\(p_quantity_metres,3\)/);
});

test("stock SQL patch retains provenance, locks and privileged execution gates",()=>{
  assert.match(migration,/pg_advisory_xact_lock\(hashtext\('stock-fabric:'\|\|v_fabric\)\)/);
  assert.match(migration,/public\.fabric_stock_snapshot_v2\(array\[v_fabric\]\)/);
  assert.match(migration,/recorded_by,source_reference/);
  assert.match(migration,/revoke all on function public\.fabric_stock_reserve_v2\([\s\S]*?from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public\.fabric_stock_reserve_v2\([\s\S]*?to service_role/);
  assert.doesNotMatch(migration,/drop table|truncate|delete from private\.fabric_stock_ledger/i);
});

test("native test fixture is opt-in, disposable, rollbacks and exercises mismatches",()=>{
  assert.match(fixture,/^begin;/m);
  assert.match(fixture,/current_setting\('titan\.synthetic_sql_test',true\)/);
  assert.match(fixture,/^rollback;/m);
  const calls=fixture.match(/public\.fabric_stock_reserve_v2\(/g)||[];
  assert.ok(calls.length>=8);
  assert.match(fixture,/same-evidence retry must return same nonnull UUID/);
  for(const field of ["different fabric","different quantity","different locked revision",
    "different checker","different evidence"])
    assert.ok(fixture.includes(field),field);
  assert.match(fixture,/sqlstate '22023'/);
  assert.match(fixture,/reserved stock after valid intents/);
});
