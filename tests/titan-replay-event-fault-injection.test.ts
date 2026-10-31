import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const script="scripts/ci/m129-receipt-event-catalog-fault-injection.sh";
const types=[
  "delivery_receipt_update_off","delivery_receipt_truncate_off",
  "quote_event_update_off","order_event_truncate_off",
  "create_receipt_update_off","quote_status_receipt_truncate_off",
  "order_status_receipt_update_off","client_receipt_read_grant",
  "client_event_function_execute_grant",
] as const;

test("M129 nine real installed replay/event faults require exact catalog rejection and automatic SQL rollback",()=>{
  const sh=readFileSync(script,"utf8");
  assert.match(sh,/GITHUB_ACTIONS/);
  assert.match(sh,/CI:-/);
  assert.match(sh,/titan_production_idempotency/);
  assert.match(sh,/ON_ERROR_STOP=1/);
  assert.match(sh,/docker exec -i/);
  assert.match(sh,/sed -n/);
  assert.match(sh,/^run_sql < "\$preflight" > "\$work\/pristine\.out"$/m);
  assert.match(sh,/^    printf 'BEGIN;\\n%s\\n'/m);
  assert.match(sh,/^    printf '\\nROLLBACK;\\n'/m);
  assert.match(sh,/if run_sql < "\$work\/fault\.sql"/);
  assert.match(sh,/if ! grep -Fq "\$diagnostic"/);
  assert.match(sh,/if ! run_sql < "\$preflight" > "\$work\/restored-\$kind\.out"/);
  assert.match(sh,/^trap 'rm -rf "\$work"' EXIT$/m);
  assert.doesNotMatch(sh,/^\s*COMMIT\s*;/im);
  for(const type of types){
    assert.match(sh,new RegExp("\\b"+type+"\\)"),"Must test fault "+type);
  }
  for(const trigger of [
    "production_delivery_receipt_append_only",
    "production_delivery_receipt_no_truncate",
    "production_quote_event_append_only",
    "production_order_event_no_truncate",
    "production_creation_receipt_append_only",
    "production_quote_status_receipt_no_truncate",
    "production_order_status_receipt_append_only",
  ])assert.ok(sh.includes(trigger),"Missing trigger test "+trigger);
  assert.match(sh,/grant select on private\.production_creation_request_receipts to authenticated/);
  assert.match(sh,/grant execute on function private\.reject_production_event_mutation\(\) to authenticated/);
});

test("M129 fault challenges run only after all nine tail migrations and the read-only installed catalog baseline",()=>{
  const runner=readFileSync("scripts/ci/verify-production-create-idempotency.sh","utf8");
  const receipt=runner.indexOf("run_file supabase/migrations/20261118_production_request_receipts_immutable.sql");
  const evidence=runner.indexOf("run_file scripts/ci/m128-production-request-receipt-immutability-assertions.sql");
  const preflight=runner.indexOf("run_file scripts/ci/m122-qc-schema-readonly-preflight.sql");
  const earlier=runner.indexOf('bash scripts/ci/m125-qc-preflight-fault-injection.sh "$container" "$db"');
  const current=runner.indexOf('bash scripts/ci/m129-receipt-event-catalog-fault-injection.sh "$container" "$db"');
  assert.ok(receipt>=0&&evidence>receipt&&preflight>evidence&&earlier>preflight&&current>earlier);
  const preflightSource=readFileSync("scripts/ci/m122-qc-schema-readonly-preflight.sql","utf8");
  assert.match(preflightSource,/BEGIN READ ONLY;/);
  assert.match(preflightSource,/production_delivery_receipt_append_only/);
  assert.match(preflightSource,/production_quote_event_append_only/);
  assert.match(preflightSource,/production_order_event_no_truncate/);
  assert.match(preflightSource,/production_creation_receipt_append_only/);
  assert.match(preflightSource,/production_quote_status_receipt_no_truncate/);
  assert.match(preflightSource,/production_order_status_receipt_append_only/);
});

test("M129 never calls a real Supabase database or mutates original production application code",()=>{
  const sh=readFileSync(script,"utf8");
  assert.doesNotMatch(sh,/\bsupabase\s+(?:db\s+push|migration\s+up|link)\b/i);
  assert.doesNotMatch(sh,/\bpsql\s+-h\b/i);
  assert.match(sh,/M129 refuses non-CI execution/);
  assert.match(sh,/M129 refuses any database except disposable/);
  assert.match(sh,/Every intentional DDL\/ACL fault stays in a PostgreSQL transaction/);
});
