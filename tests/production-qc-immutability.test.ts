import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(path,"utf8");

test("M122 physical QC evidence is append-only for all privileged UPDATE/DELETE paths",()=>{
  const sql=read("supabase/migrations/20261115_finished_garment_qc_immutable.sql");
  assert.match(sql,/create or replace function private\.reject_finished_garment_qc_mutation\(\)/);
  assert.match(sql,/before update or delete on private\.finished_garment_qc_inspections/);
  assert.match(sql,/for each row execute function private\.reject_finished_garment_qc_mutation\(\)/);
  assert.match(sql,/errcode='55000'/);
  assert.match(sql,/set search_path='pg_catalog'/);
  assert.match(sql,/revoke all on function private\.reject_finished_garment_qc_mutation\(\)/);
  assert.doesNotMatch(sql,/\bupdate\s+private\.finished_garment_qc_inspections\s+set\b/i,
    "Never rewrite historic physical QC evidence as part of this migration");
  assert.doesNotMatch(sql,/\bdelete\s+from\s+private\.finished_garment_qc_inspections\b/i);
});

test("M122 disposable SQL tests run after legacy QC mutation probes and before concurrency races",()=>{
  const runner=read("scripts/ci/verify-production-create-idempotency.sh");
  const legacy=runner.indexOf("run_file scripts/ci/m114-delivery-eligibility-assertions.sql");
  const immutable=runner.indexOf("run_file supabase/migrations/20261115_finished_garment_qc_immutable.sql");
  const regression=runner.indexOf("run_file scripts/ci/m122-qc-immutability-assertions.sql");
  const race=runner.indexOf("tmpdir=$(mktemp -d)");
  assert.ok(legacy>=0&&immutable>legacy&&regression>immutable&&race>regression);
  const proof=read("scripts/ci/m122-qc-immutability-assertions.sql");
  assert.match(proof,/QC approval UPDATE incorrectly succeeded/);
  assert.match(proof,/QC approval DELETE incorrectly succeeded/);
  assert.match(proof,/QC rework UPDATE incorrectly succeeded/);
  assert.match(proof,/historical approval overrode immutable newer rework/);
  assert.match(proof,/blocked delivery wrote a false event or idempotency receipt/);
  assert.match(proof,/sqlstate '55000'/);
});

test("M122 staging requires explicit owner approval, and QC immutability follows all five dependencies",()=>{
  const plan=read("docs/TITAN_QC_MIGRATION_STAGING_PLAN.md");
  const files=[
    "20261110_delivery_qc_sql_gate.sql",
    "20261111_delivery_idempotency.sql",
    "20261112_finished_garment_qc_sequence.sql",
    "20261113_delivery_qc_sequence_gate.sql",
    "20261114_delivery_eligibility_read.sql",
    "20261115_finished_garment_qc_immutable.sql",
  ];
  let previous=-1;
  for(const file of files){
    const at=plan.indexOf(file);
    assert.ok(at>previous,"Migration dependency order changed: "+file);
    previous=at;
  }
  assert.match(plan,/written approval for staging schema testing/);
  assert.match(plan,/privileged UPDATE\/DELETE/);
  assert.match(plan,/separate.*production.*approval/i);
  assert.match(plan,/Do not run these migrations in production/);
});
