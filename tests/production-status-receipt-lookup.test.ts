import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseProductionStatusReceipts,parseProductionStatusReceiptResponse} from "../src/lib/designer/production-status-receipt-lookup.ts";

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
  assert.match(lookup,/parseProductionStatusReceiptResponse\(data\.receipts\)/);
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
  assert.ok(fixture.includes('"/__fixture/status-receipt-mode"'));
  for(const mode of ["valid","empty","malformed","duplicate","missing","upstream","oversized"]){
    assert.ok(fixture.includes('"'+mode+'"'),"missing CI receipt mode "+mode);
    assert.ok(http.includes('"'+mode+'"'),"missing signed HTTP case "+mode);
  }
  assert.match(http,/Signed built-Next status receipt recovery HTTP PASS/);
  assert.ok(http.includes("assertPrivate(failed)"));
  assert.match(http,/empty lookup is only an observation/);
  assert.match(http,/DO-NOT-LEAK-CI-/);
  assert.match(http,/expired/);
  assert.ok(workflow.includes("node scripts/verify-production-status-receipt-private-http.cjs"));
});


test("M144 signed browser UI never treats a status receipt as permission to retry",()=>{
  const browser=readFileSync("scripts/verify-production-status-receipt-browser.cjs","utf8");
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  assert.ok(browser.includes("M144 signed status-receipt browser test is GitHub Actions CI-only."));
  assert.ok(browser.includes("for(const width of [390,768,1440])"));
  for(const text of [
    "committed status: accepted",
    "committed status: delivered",
    "This is NOT proof that retrying is safe",
    "A receipt for the superseded marker must never be shown",
    "changedMarkerVeto:true",
    'productionPostActions.every(action=>action==="status_receipt_lookup")',
    "No production write, live SQL, customer data or human signoff.",
  ])assert.ok(browser.includes(text),"Missing signed browser safety case "+text);
  assert.ok(workflow.includes("node scripts/verify-production-status-receipt-browser.cjs"));
});


test("operator browser strictly accepts sanitized camelCase status receipts, not raw SQL",()=>{
  const good=[
    {action:"quote_status",recordId:quote.toUpperCase(),status:"accepted"},
    {action:"order_status",recordId:order,status:"delivered"},
  ];
  assert.deepEqual(parseProductionStatusReceiptResponse(good),[
    {action:"quote_status",recordId:quote,status:"accepted"},
    {action:"order_status",recordId:order,status:"delivered"},
  ]);
  assert.deepEqual(parseProductionStatusReceiptResponse([]),[],
    "An empty read is valid evidence only of what was visible at that instant");
  for(const bad of [
    null,{},[null],[{}],
    [{action:"order_status",record_id:order,target_status:"ready"}],
    [{action:"order_status",recordId:order,status:"ready",privateCustomerPhone:"sensitive"}],
    [{action:"order_status",recordId:order,status:"ready",note:"sensitive"}],
    [{action:"order_status",recordId:order,status:"unknown"}],
    [{action:"order_status",recordId:"invalid",status:"ready"}],
    [{action:"quote_status",recordId:quote,status:"delivered"}],
    [good[0],good[0]],
    Array(4).fill(good[0]),
  ])assert.equal(parseProductionStatusReceiptResponse(bad),null,
    "Malformed, private, duplicate or excessive receipts must be rejected");
  assert.equal(parseProductionStatusReceipts(good),null,
    "Server SQL parser must NOT accept API-shaped objects");
});


test("M149 same-key status epoch browser safety is a required release gate",()=>{
  const testScript=readFileSync("scripts/verify-production-status-receipt-same-key-epoch-browser.cjs","utf8");
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  const client=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const statusLookup=client.split("async function lookupPendingStatusReceipt(){")[1]?.split("function confirmReviewedProductionHistory()")[0]??"";
  assert.ok(statusLookup.includes("productionWriteReviewSnapshotUnchanged(safeProductionHoldStorage(),snapshot)"));
  for(const marker of [
    "M149 same-key status receipt browser gate is GitHub Actions CI only",
    'const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://localhost:3000")',
    "for(const width of [390,768,1440])",
    "const key=\"123e4567-e89b-42d3-a456-426614174070\"",
    "const oldEpoch=",
    "const newEpoch=",
    "A real signed successful Next response must be vetoed as stale by React",
    'assert.deepEqual(actions,["status_receipt_lookup"]',
    "An earlier committed status may not appear after same-key epoch changed",
    "productionMutations:0,syntheticOnly:true",
  ])assert.ok(testScript.includes(marker),"Missing signed real-browser status epoch protection: "+marker);
  assert.ok(workflow.includes("node scripts/verify-production-status-receipt-same-key-epoch-browser.cjs"));
});
