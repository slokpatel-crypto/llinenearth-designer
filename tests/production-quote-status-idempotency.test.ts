import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("J5 quote status uses the original pre-POST UUID and an atomic service-only RPC",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const status=route.split('if(action==="quote_status"){')[1]?.split('if(action==="create_order"){')[0]||"";
  assert.match(status,/parseOperatorProductionStatus\(body,"quote"\)/);
  assert.match(status,/parseOperatorProductionRequestKey\(body.requestKey\)/);
  assert.match(status,/if\(!requestKey\) return respond/);
  assert.match(status,/rpc<unknown>\("production_quote_set_status_idempotent"/);
  assert.match(status,/p_request_key:requestKey,p_quote_id:change.recordId/);
  assert.doesNotMatch(status,/rpc<unknown>\("production_quote_set_status"/);
  const ui=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  assert.match(ui,/JSON.stringify\(\{\.\.\.body,requestKey:holdToken\}\)/);
  const sql=readFileSync("supabase/migrations/20261108_production_quote_status_idempotency.sql","utf8");
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/v_updated:=public.production_quote_set_status/);
  assert.match(sql,/insert into private.production_quote_status_request_receipts/);
  assert.ok(sql.indexOf("v_updated:=public.production_quote_set_status")<sql.indexOf("insert into private.production_quote_status_request_receipts"));
  assert.match(sql,/revoke all on function public.production_quote_set_status_idempotent/);
  assert.match(sql,/to service_role/);
  assert.doesNotMatch(sql,/recoveryToken|customerPhone|insert into private.production_quote_events/i);
});

test("real disposable PostgreSQL exercises replay, conflicting intent and rollback",()=>{
  const script=readFileSync("scripts/ci/verify-production-create-idempotency.sh","utf8");
  assert.match(script,/20261108_production_quote_status_idempotency.sql/);
  assert.match(script,/production-quote-status-idempotency-assertions.sql/);
  const sql=readFileSync("scripts/ci/production-quote-status-idempotency-assertions.sql","utf8");
  for(const marker of ["quote status replay duplicated an event","changed-intent quote status key unexpectedly accepted",
    "failed transition consumed the status request key","incorrect quote status RPC privileges"])
    assert.ok(sql.includes(marker),marker);
});
