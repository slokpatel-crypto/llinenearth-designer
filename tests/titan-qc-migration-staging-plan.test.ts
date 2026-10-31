import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const prefix="supabase/migrations/";
const filenames=[
  "20261110_delivery_qc_sql_gate.sql",
  "20261111_delivery_idempotency.sql",
  "20261112_finished_garment_qc_sequence.sql",
  "20261113_delivery_qc_sequence_gate.sql",
  "20261114_delivery_eligibility_read.sql",
];

test("M121 required QC migrations are present and source dependencies stay ordered",()=>{
  const numeric=filenames.map(name=>Number(name.slice(0,8)));
  assert.deepEqual(numeric,[20261110,20261111,20261112,20261113,20261114]);
  const sql=filenames.map(name=>readFileSync(prefix+name,"utf8"));
  assert.match(sql[0],/create or replace function public\.production_order_set_status/);
  assert.match(sql[0],/six exact passing physical QC checks required before delivery/);
  assert.match(sql[1],/production_delivery_request_receipts/);
  assert.match(sql[1],/pg_advisory_xact_lock/);
  assert.match(sql[1],/production_order_set_status\(p_order_id,'delivered',p_note\)/);
  assert.match(sql[2],/qc_latest_sequence bigint not null default 0/);
  assert.match(sql[2],/inspection_sequence bigint/);
  assert.match(sql[2],/before insert on private\.finished_garment_qc_inspections/);
  assert.match(sql[2],/set qc_latest_sequence=qc_latest_sequence\+1/);
  assert.doesNotMatch(sql[2],/update private\.finished_garment_qc_inspections\s+set inspection_sequence/,
    "Never backfill historical physical inspection chronology");
  assert.match(sql[3],/inspection_sequence desc nulls last/);
  assert.match(sql[3],/fresh sequenced QC inspection required for delivery/);
  assert.match(sql[3],/v_latest_sequence is distinct from v_order_sequence/);
  assert.match(sql[4],/q\.inspection_sequence=o\.qc_latest_sequence/);
  assert.match(sql[4],/limit greatest\(1,least\(coalesce\(p_limit,100\),100\)\)/);
  assert.match(sql[4],/from public,anon,authenticated/);
  assert.match(sql[4],/to service_role/);
});

test("M121 rollout review documents irreversible evidence and owner stop conditions",()=>{
  const doc=readFileSync("docs/TITAN_QC_MIGRATION_STAGING_PLAN.md","utf8");
  let prev=-1;
  for(const name of filenames){
    const index=doc.indexOf(name);
    assert.ok(index>prev,"Staging operator plan must list "+name+" in order");
    prev=index;
  }
  for(const term of [
    "DRAFT","Do not run these migrations in production",
    "separate **written approval for staging schema testing**",
    "tested restore procedure","NULL","Never backfill old approvals",
    "new physical inspection","two-session QC-vs-delivery race",
    "not delivery authorization","RLS","service_role",
    "private, no-store","stop operator delivery writes",
    "five real novice cases","first-ten genuine deliveries",
    "production migration, main merge, and deployment approvals",
  ]){
    assert.ok(doc.includes(term),"Missing staging stop/go term: "+term);
  }
  assert.doesNotMatch(doc,/^\s*(?:npm|supabase|psql)\s+(?:db push|migration up|link)\b/m,
    "This review plan must not embed an executable production migration");
});

test("M121 no CI job automatically applies physical QC migrations to live Supabase",()=>{
  for(const path of [".github/workflows/ci.yml",".github/workflows/deep-engine-non3d.yml"]){
    const source=readFileSync(path,"utf8");
    assert.doesNotMatch(source,/\bsupabase\s+db\s+push\b|\bsupabase\s+migration\s+up\b/,
      "CI workflow "+path+" must remain schema read/isolated PG only");
  }
  const realSqlRunner=readFileSync("scripts/ci/verify-production-create-idempotency.sh","utf8");
  for(const name of filenames){
    assert.ok(realSqlRunner.includes(name),"Isolated PG regression missing "+name);
  }
  assert.match(realSqlRunner,/docker/);
});
