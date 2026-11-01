import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseProductionStatusReceipts} from "../src/lib/designer/production-status-receipt-lookup.ts";

const quote="123e4567-e89b-42d3-a456-426614174010";
const order="123e4567-e89b-42d3-a456-426614174011";

test("only strict committed status receipt metadata may be shown",()=>{
  assert.deepEqual(parseProductionStatusReceipts([]),[]);
  assert.deepEqual(parseProductionStatusReceipts([
    {action:"quote_status",record_id:quote.toUpperCase(),target_status:"accepted"},
    {action:"order_status",record_id:order,target_status:"delivered"},
  ]),[
    {action:"quote_status",recordId:quote,status:"accepted"},
    {action:"order_status",recordId:order,status:"delivered"},
  ]);
  for(const invalid of [null,{},[null],[{}],Array(4).fill({action:"order_status",record_id:order,target_status:"ready"}),
    [{action:"quote_status",record_id:quote,target_status:"delivered"}],
    [{action:"order_status",record_id:order,target_status:"unknown"}],
    [{action:"order_status",record_id:"bad",target_status:"ready"}],
    [{action:"order_status",record_id:order,target_status:"ready",note:"private"}],
    [{action:"order_status",record_id:order,target_status:"ready"},
      {action:"order_status",record_id:order,target_status:"ready"}],
  ])assert.equal(parseProductionStatusReceipts(invalid),null);
});

test("status receipt lookup is operator-only, read-only, exact-key and never proves noncommit",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const migration=readFileSync("supabase/migrations/20261120_production_status_receipt_lookup.sql","utf8");
  const sql=readFileSync("scripts/ci/m142-status-receipt-lookup-assertions.sql","utf8");
  const ci=readFileSync("scripts/ci/verify-production-create-idempotency.sh","utf8");
  assert.match(route,/if\(!await authorized\(\)\) return respond\(\{error:"Unauthorized\."\},401\)/);
  assert.match(route,/if\(action==="status_receipt_lookup"\)\{/);
  assert.match(route,/parseOperatorProductionRequestKey\(body\.requestKey\)/);
  assert.match(route,/rpc<unknown>\("production_status_request_receipt_lookup",\{p_request_key:key\}\)/);
  assert.match(route,/parseProductionStatusReceipts\(rows\)/);
  assert.match(route,/return respond\(\{receipts\}\)/);
  assert.match(migration,/returns table\(action text,record_id uuid,target_status text\)/);
  assert.match(migration,/production_quote_status_request_receipts/);
  assert.match(migration,/production_order_status_request_receipts/);
  assert.match(migration,/production_delivery_request_receipts/);
  assert.match(migration,/limit 3/);
  assert.match(migration,/revoke all on function public\.production_status_request_receipt_lookup/);
  assert.match(migration,/grant execute on function public\.production_status_request_receipt_lookup/);
  assert.doesNotMatch(migration,/insert into|update private|delete from|recoveryToken|customerPhone/i);
  assert.match(ci,/20261120_production_status_receipt_lookup\.sql/);
  assert.match(ci,/m142-status-receipt-lookup-assertions\.sql/);
  assert.match(sql,/committed physical delivery receipt was not recovered/);
  assert.match(ci,/Status receipt lookup claimed noncommit while another SQL transaction was open/);
});

test("operator status receipt recovery cannot clear the hold or trust a changed browser marker",()=>{
  const client=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const lookup=client.split("async function lookupPendingStatusReceipt(){")[1]?.split("function confirmReviewedProductionHistory()")[0]??"";
  assert.ok(lookup.length>0);
  assert.match(lookup,/captureProductionWriteReviewSnapshot\(safeProductionHoldStorage\(\)\)/);
  assert.match(lookup,/action:"status_receipt_lookup",requestKey:pendingKey/);
  assert.match(lookup,/parseProductionStatusReceipts\(data\.receipts\)/);
  assert.match(lookup,/productionWriteReviewSnapshotUnchanged\(safeProductionHoldStorage\(\),snapshot\)/);
  assert.match(lookup,/setRecoveredStatusReceipts\(receipts\)/);
  assert.match(lookup,/An in-flight SQL transaction may still commit/);
  assert.doesNotMatch(lookup,/acknowledgeProductionWriteHold|releaseProductionWriteHold|setRequiresWriteReview\(false\)/);
  assert.match(client,/Find original status receipt by request ID/);
  assert.match(client,/COMMITTED STATUS RECEIPTS/);
  assert.match(client,/This is NOT proof that retrying is safe/);
});

test("signed built-Next HTTP exercises exact status receipt recovery failures",()=>{
  const fixture=readFileSync("scripts/ci-verified-stock-fixture.cjs","utf8");
  const http=readFileSync("scripts/verify-production-status-receipt-private-http.cjs","utf8");
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  assert.match(fixture,/STATUS_RECEIPT_LOOKUP_PATH/);
  assert.match(fixture,/CI_STATUS_REQUEST_KEY/);
  assert.match(fixture,/__fixture\\/status-receipt-mode/);
  for(const mode of ["valid","empty","malformed","duplicate","missing","upstream","oversized"]){
    assert.ok(fixture.includes('"'+mode+'"'),"missing CI receipt mode "+mode);
    assert.ok(http.includes('"'+mode+'"'),"missing signed HTTP case "+mode);
  }
  assert.match(http,/Signed built-Next status receipt recovery HTTP PASS/);
  assert.match(http,/assertPrivate\\(failed\\)/);
  assert.match(http,/empty lookup is only an observation/);
  assert.match(http,/DO-NOT-LEAK-CI-/);
  assert.match(http,/expired/);
  assert.match(workflow,/node scripts\\/verify-production-status-receipt-private-http\\.cjs/);
});
