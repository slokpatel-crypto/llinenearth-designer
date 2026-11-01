import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseOperatorProductionRequestKey} from "../src/lib/designer/production-request-key.ts";

const id="123e4567-e89b-42d3-a456-426614174000";
test("operator production create requires literal v4 UUID request keys",()=>{
  assert.equal(parseOperatorProductionRequestKey(id),id);
  assert.equal(parseOperatorProductionRequestKey(" "+id.toUpperCase()+" "),id);
  for(const invalid of [null,undefined,true,1,["id"],{toString:()=>id},"",
    "123e4567-e89b-12d3-a456-426614174000",
    "123e4567-e89b-42d3-1456-426614174000",
    "123e4567e89b42d3a456426614174000",
    "x".repeat(400)]){
    assert.equal(parseOperatorProductionRequestKey(invalid),null,String(invalid));
  }
});

test("every privileged quote/order creation uses exact atomic request-key RPC",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const client=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const migration=readFileSync("supabase/migrations/20261106_production_create_request_idempotency.sql","utf8");
  assert.match(client,/const holdToken=crypto\.randomUUID\(\)/);
  assert.match(client,/const claimed=await beginProductionWriteHoldAtomically\(\s*storage,holdToken,safeProductionWriteLock\(\),beforeLock/);
  assert.match(client,/if\(!claimed\|\|!hasCurrentVerifiedLedger\(\)/);
  assert.match(client,/if\(claimed\)releaseProductionWriteHold\(storage,holdToken\)/);
  assert.match(client,/body:JSON\.stringify\(\{\.\.\.body,requestKey:holdToken\}\)/);
  assert.match(route,/import \{parseOperatorProductionRequestKey\}/);
  assert.equal((route.match(/parseOperatorProductionRequestKey\(body\.requestKey\)/g)||[]).length,6,
    "Both creates, both statuses and both read-only committed receipt lookups validate the same literal UUID");
  assert.match(route,/rpc<string>\("production_quote_create_idempotent",\{/);
  assert.match(route,/rpc<string>\("production_order_create_with_context_idempotent",\{/);
  assert.equal((route.match(/p_request_key:requestKey/g)||[]).length,5,
    "Both atomic creates, quote status, non-delivery status and delivery use the original key in SQL");
  assert.doesNotMatch(route,/rpc<string>\("production_quote_create",\{/);
  assert.doesNotMatch(route,/rpc<string>\("production_order_create_with_context",\{/);
  assert.match(migration,/primary key\(action,request_key\)/);
  assert.equal((migration.match(/pg_advisory_xact_lock/g)||[]).length,2);
  assert.match(migration,/sha256\(convert_to\(jsonb_build_object\(/);
  assert.match(migration,/production creation request key belongs to different quote instructions/);
  assert.match(migration,/production creation request key belongs to different order instructions/);
  assert.match(migration,/revoke all on private\.production_creation_request_receipts from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public\.production_order_create_with_context_idempotent/);
  assert.doesNotMatch(migration,/recoveryToken|p_recovery_token|customerPhone|auth\.users/);
});
