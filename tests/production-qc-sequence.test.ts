import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("M113 assigns QC evidence sequence under the canonical locked order",()=>{
  const migration=readFileSync("supabase/migrations/20261112_finished_garment_qc_sequence.sql","utf8");
  assert.match(migration,/alter table private\.production_orders/);
  assert.match(migration,/qc_latest_sequence bigint not null default 0/);
  assert.match(migration,/inspection_sequence bigint/);
  assert.match(migration,/finished_garment_qc_order_sequence_unique/);
  assert.match(migration,/before insert on private\.finished_garment_qc_inspections/);
  assert.match(migration,/set qc_latest_sequence=qc_latest_sequence\+1/);
  assert.match(migration,/where order_id=new\.order_id and status='ready'/);
  assert.match(migration,/returning qc_latest_sequence into new\.inspection_sequence/);
  assert.match(migration,/new\.created_at:=clock_timestamp\(\)/);
  assert.match(migration,/from public,anon,authenticated/);
  assert.doesNotMatch(migration,/update private\.finished_garment_qc_inspections\s+set inspection_sequence/,
    "Historical physical QC must never be silently backfilled as proven chronology");
});

test("M113 latest physical QC gate follows sequence, rejecting timestamp-only approvals",()=>{
  const migration=readFileSync("supabase/migrations/20261113_delivery_qc_sequence_gate.sql","utf8");
  assert.match(migration,/from private\.production_orders where order_id=p_order_id for update/);
  assert.match(migration,/qc_latest_sequence/);
  assert.match(migration,/inspection_sequence desc nulls last,created_at desc/);
  assert.match(migration,/v_latest_sequence is null or v_latest_sequence is distinct from v_order_sequence/);
  assert.match(migration,/fresh sequenced QC inspection required for delivery/);
  assert.match(migration,/v_latest_recipe is distinct from v_order_recipe/);
  assert.match(migration,/six exact passing physical QC checks required before delivery/);
  assert.match(migration,/ambiguous latest QC inspection/);
  assert.match(migration,/to service_role/);
});

test("M113 isolated PostgreSQL checks require historical reapproval and preserve rework veto",()=>{
  const runner=readFileSync("scripts/ci/verify-production-create-idempotency.sh","utf8");
  const assertions=readFileSync("scripts/ci/m113-qc-sequence-assertions.sql","utf8");
  for(const path of ["m113-legacy-qc-fixture.sql","20261112_finished_garment_qc_sequence.sql",
    "20261113_delivery_qc_sequence_gate.sql","m113-qc-sequence-assertions.sql"]){
    assert.ok(runner.includes(path),"Missing real disposable PostgreSQL step: "+path);
  }
  assert.match(assertions,/unsequenced historical approval became delivery proof/);
  assert.match(assertions,/fresh sequenced QC was wrongly denied delivery/);
  assert.match(assertions,/old approved QC overrode newer physical rework/);
  assert.match(assertions,/rework-blocked delivery emitted a false event/);
});
