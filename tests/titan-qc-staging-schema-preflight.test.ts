import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("M123 preflight audits installed QC chronology and immutable evidence",()=>{
  const path="scripts/ci/m122-qc-schema-readonly-preflight.sql";
  const sql=readFileSync(path,"utf8");
  assert.match(sql,/BEGIN READ ONLY;/);
  assert.match(sql,/COMMIT;/);
  assert.match(sql,/pg_attribute/);
  assert.match(sql,/pg_constraint/);
  assert.match(sql,/pg_index/);
  assert.match(sql,/pg_trigger/);
  assert.match(sql,/t\.tgenabled='O'/);
  assert.match(sql,/t\.tgfoid=v_trigger/);
  assert.match(sql,/t\.tgfoid=v_immutability/);
  assert.match(sql,/finished_garment_qc_append_only/);
  assert.match(sql,/finished_garment_qc_no_truncate/);
  assert.match(sql,/tgtype::int & 32/);
  assert.match(sql,/errcode=\x27\x2755000\x27\x27/);
  assert.match(sql,/pg_proc/);
  assert.match(sql,/p\.prosecdef/);
  assert.match(sql,/p\.proconfig/);
  assert.match(sql,/pg_get_functiondef/);
  assert.match(sql,/v_latest_sequence is distinct from v_order_sequence/);
  assert.match(sql,/q\.inspection_sequence=o\.qc_latest_sequence/);
  assert.match(sql,/relrowsecurity/);
  for(const role of ["anon","authenticated"]){
    assert.ok(sql.includes("has_function_privilege('"+role+"'"));
    assert.ok(sql.includes("has_table_privilege('"+role+"'"));
  }
  assert.match(sql,/has_function_privilege\('service_role'/);
  for(const obj of [
    "private.production_orders","private.finished_garment_qc_inspections",
    "private.production_delivery_request_receipts",
    "private.assign_finished_garment_qc_sequence",
    "private.reject_finished_garment_qc_mutation",
    "public.production_order_set_status",
    "public.production_order_deliver_idempotent",
    "public.production_delivery_eligibility_list",
  ])assert.ok(sql.includes(obj),"Missing catalog check for "+obj);
  // Only catalogue reads and exceptions are permitted, never DML/DDL.
  // Ignore SQL line comments: the rollout audit legitimately describes a
  // "TRUNCATE trigger", which is not an executable TRUNCATE statement.
  // BEGIN READ ONLY is enforced by PostgreSQL; actual DDL/DML remains banned.
  const executable=sql.split("\n").map(line=>line.replace(/--.*$/,"")).join("\n");
  assert.doesNotMatch(executable,/\b(?:ALTER|CREATE|DROP|TRUNCATE|INSERT|UPDATE|DELETE)\s+(?:TABLE|FUNCTION|TRIGGER|INDEX|INTO|private\.|public\.)/i);
  assert.doesNotMatch(sql,/\b(?:supabase\s+db\s+push|psql\s+-h|curl)\b/i);
});

test("M123 read-only installed-schema preflight runs after all six QC migrations",()=>{
  const runner=readFileSync("scripts/ci/verify-production-create-idempotency.sh","utf8");
  const order=[
    "20261110_delivery_qc_sql_gate.sql",
    "20261111_delivery_idempotency.sql",
    "20261112_finished_garment_qc_sequence.sql",
    "20261113_delivery_qc_sequence_gate.sql",
    "20261114_delivery_eligibility_read.sql",
    "20261115_finished_garment_qc_immutable.sql",
    "m122-qc-immutability-assertions.sql",
    "m122-qc-schema-readonly-preflight.sql",
  ];
  let previous=-1;
  for(const target of order){
    const at=runner.indexOf("run_file "+(target.startsWith("20")?
      "supabase/migrations/":"scripts/ci/")+target);
    assert.ok(at>previous,"Missing or out-of-order installed QC preflight "+target);
    previous=at;
  }
  const docs=readFileSync("docs/TITAN_QC_MIGRATION_STAGING_PLAN.md","utf8");
  assert.match(docs,/written approval for staging schema testing/);
  assert.match(docs,/protected backup/);
  assert.match(docs,/Do not run these migrations in production/);
  for(const path of [".github/workflows/ci.yml",".github/workflows/deep-engine-non3d.yml"]){
    const workflow=readFileSync(path,"utf8");
    assert.doesNotMatch(workflow,/\bsupabase\s+(?:db\s+push|migration\s+up)\b/);
  }
});
