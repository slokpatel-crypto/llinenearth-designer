import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("operator order statuses use atomic non-delivery and QC-gated delivery RPCs",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const migration=readFileSync("supabase/migrations/20261109_production_order_status_idempotency.sql","utf8");
  const sqlCi=readFileSync("scripts/ci/verify-production-create-idempotency.sh","utf8");
  const section=route.split('if(action==="order_status"){')[1]?.split('return respond({error:"Unsupported production action."}')[0]??"";
  assert.match(section,/parseOperatorProductionRequestKey\(body\.requestKey\)/);
  assert.match(section,/if\(status==="delivered"\)\{/);
  assert.match(section,/production_order_deliver_idempotent/);
  assert.match(section,/production_order_set_status_idempotent/);
  assert.match(section,/p_request_key:requestKey/);
  assert.doesNotMatch(section,/finished_garment_qc_list|production_order_list|hasVerifiedLatestDeliveryQc|hasVerifiedDeliveryQcOrderLineage/);
  assert.doesNotMatch(section,/rpc<unknown>\("production_order_set_status",\{/);
  assert.match(migration,/pg_advisory_xact_lock/);
  assert.match(migration,/production_order_status_request_receipts/);
  assert.match(migration,/v_updated:=public\.production_order_set_status/);
  assert.match(migration,/delivery requires separate transactional QC verification/);
  assert.match(migration,/revoke all on function public\.production_order_set_status_idempotent/);
  assert.match(migration,/grant execute on function public\.production_order_set_status_idempotent/);
  assert.match(sqlCi,/production-order-status-idempotency-assertions\.sql/);
  assert.match(sqlCi,/Concurrent same-key order status replay duplicated a transition/);
});
