import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("M130 only immutable locked quote financial/design and linked order identity changes reject",()=>{
 const s=readFileSync("supabase/migrations/20261119_locked_production_identity_immutable.sql","utf8");
 assert.match(s,/create or replace function private\.reject_locked_production_identity_mutation\(\)/);
 assert.match(s,/set search_path='pg_catalog'/);
 assert.match(s,/using errcode='55000'/);
 for(const key of ["quote_id","revision_id","recipe_hash","currency","line_items","subtotal","adjustment","total","created_at"]){
  assert.ok(s.includes("new."+key+" is distinct from old."+key),"Cannot alter original quote "+key);
 }
 for(const table of ["production_quotes","production_orders"]){
  assert.ok(s.includes("before update on private."+table));
  assert.ok(s.includes("for each row execute function private.reject_locked_production_identity_mutation()"));
 }
 assert.match(s,/revoke all on function private\.reject_locked_production_identity_mutation/);
 assert.match(s,/from public,anon,authenticated/);
 assert.doesNotMatch(s,/^\s*(?:update|delete from|truncate)\s+private\.production_(?:orders|quotes)/im);
});

test("M130 disposable SQL rejects original quote/order rewrites and allows canonical status and QC",()=>{
 const sql=readFileSync("scripts/ci/m130-locked-production-identity-assertions.sql","utf8");
 for(const token of [
  "production_quote_create(", "production_quote_set_status(",
  "production_order_create(", "production_order_set_status(",
  "finished_garment_qc_record_v2(",
  "set recipe_hash=repeat('a',64)", "set revision_id=",
  "set currency='USD'", "set line_items=", "set total=1",
  "set quote_id=null", "set created_at=",
  "exception when sqlstate '55000'", "qc_latest_sequence",
  "M130 canonical order identity or normal QC sequencing incorrect",
  "M130 allowed quote/order state events were not appended",
 ])assert.ok(sql.includes(token),"Missing test for "+token);
 const runner=readFileSync("scripts/ci/verify-production-create-idempotency.sh","utf8");
 const i=runner.indexOf("run_file supabase/migrations/20261118_production_request_receipts_immutable.sql");
 const j=runner.indexOf("run_file supabase/migrations/20261119_locked_production_identity_immutable.sql");
 const k=runner.indexOf("run_file scripts/ci/m130-locked-production-identity-assertions.sql");
 const l=runner.indexOf("run_file scripts/ci/m122-qc-schema-readonly-preflight.sql");
 assert.ok(i>=0&&j>i&&k>j&&l>k,"Install and challenge lock before installed schema audit");
});

test("M130 installed-schema audit checks both enabled lock triggers and original model remains untouched",()=>{
 const audit=readFileSync("scripts/ci/m122-qc-schema-readonly-preflight.sql","utf8");
 for(const value of ["BEGIN READ ONLY;","v_locked_identity",
   "production_quote_locked_identity","production_order_locked_identity",
   "new.recipe_hash is distinct from old.recipe_hash",
   "new.line_items is distinct from old.line_items",
   "M130 locked production quote/order identity trigger missing or disabled"]){
   assert.ok(audit.includes(value),"Missing schema inspection "+value);
 }
 const staging=readFileSync("docs/TITAN_QC_MIGRATION_STAGING_PLAN.md","utf8");
 assert.match(staging,/20261119_locked_production_identity_immutable\.sql/);
 assert.match(staging,/Apply the eleven migrations/);
 assert.match(staging,/physical QC counter updates continue to succeed/);
});
