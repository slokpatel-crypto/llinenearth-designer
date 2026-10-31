import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("M125 tries six real SQL/ACL faults and verifies rollback after every rejection",()=>{
  const shell=readFileSync("scripts/ci/m125-qc-preflight-fault-injection.sh","utf8");
  const runner=readFileSync("scripts/ci/verify-production-create-idempotency.sh","utf8");
  assert.match(shell,/GITHUB_ACTIONS/);
  assert.match(shell,/CI:-/);
  assert.match(shell,/titan_production_idempotency/);
  assert.match(shell,/docker exec -i/);
  assert.match(shell,/ON_ERROR_STOP=1/);
  assert.match(shell,/mktemp -d/);
  assert.match(shell,/trap 'rm -rf "\$work"' EXIT/);
  assert.match(shell,/for kind in insert_trigger_off update_delete_off truncate_off/);
  for(const kind of ["insert_trigger_off","update_delete_off","truncate_off",
      "missing_unique_index","leaked_client_rpc","missing_service_rpc"]){
    assert.match(shell,new RegExp("\\b"+kind+"\\)"));
  }
  for(const token of [
    "disable trigger finished_garment_qc_assign_sequence",
    "disable trigger finished_garment_qc_append_only",
    "disable trigger finished_garment_qc_no_truncate",
    "drop index private.finished_garment_qc_order_sequence_unique",
    "grant execute on function public.production_delivery_eligibility_list(integer) to authenticated",
    "revoke execute on function public.production_delivery_eligibility_list(integer) from service_role",
    "BEGIN;","ROLLBACK;","grep -Fq",
    "run_sql < \"$preflight\"","not rolled back",
  ])assert.ok(shell.includes(token),"Missing real negative SQL check "+token);
  const migration=runner.indexOf("run_file supabase/migrations/20261115_finished_garment_qc_immutable.sql");
  const audit=runner.indexOf("run_file scripts/ci/m122-qc-schema-readonly-preflight.sql");
  const challenge=runner.indexOf("bash scripts/ci/m125-qc-preflight-fault-injection.sh");
  assert.ok(migration>=0&&audit>migration&&challenge>audit,
    "Real negative catalog audit must run after immutable triggers and successful baseline");
  assert.doesNotMatch(shell,/\b(?:supabase db push|supabase migration up|psql -h)\b/);
});

test("M125 negative test never uses a real customer, modifies main, or skips readonly baseline",()=>{
  const shell=readFileSync("scripts/ci/m125-qc-preflight-fault-injection.sh","utf8");
  assert.match(shell,/^run_sql < "\$preflight" > "\$work\/baseline\.out"$/m);
  assert.match(shell,/if run_sql < "\$work\/fault\.sql"/);
  assert.match(shell,/if ! run_sql < "\$preflight" > "\$work\/recovered-\$kind\.out"/);
  assert.match(shell,/if ! grep -Fq "\$diagnostic"/);
  assert.doesNotMatch(shell,/COMMIT;/i);
  assert.doesNotMatch(shell,/delivery.*POST|physical inspection is approved/i);
});
