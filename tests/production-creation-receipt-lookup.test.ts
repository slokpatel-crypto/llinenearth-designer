import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseProductionCreationReceipts,parseProductionCreationReceiptResponse} from "../src/lib/designer/production-creation-receipt-lookup.ts";
import {PRODUCTION_WRITE_HOLD_KEY,PRODUCTION_WRITE_EPOCH_KEY,readProductionWriteHoldKey,captureProductionWriteReviewSnapshot,productionWriteReviewSnapshotUnchanged} from "../src/lib/designer/production-write-hold.ts";

const key="123e4567-e89b-42d3-a456-426614174100";
const quote="123e4567-e89b-42d3-a456-426614174010";
const order="123e4567-e89b-42d3-a456-426614174011";

test("anonymous request marker survives a reload but never exposes a request payload",()=>{
  const rows=new Map([[PRODUCTION_WRITE_HOLD_KEY,key]]);
  const store={getItem:(k:string)=>rows.get(k)??null,setItem:()=>{},removeItem:()=>{}};
  assert.equal(readProductionWriteHoldKey(store),key);
  assert.equal(readProductionWriteHoldKey(null),null);
  assert.equal(readProductionWriteHoldKey({getItem(){throw Error("denied");},setItem(){},removeItem(){}}),null);
  rows.set(PRODUCTION_WRITE_HOLD_KEY,"not-a-request-uuid");
  assert.equal(readProductionWriteHoldKey(store),null);
  rows.set(PRODUCTION_WRITE_HOLD_KEY,key.toUpperCase());
  assert.equal(readProductionWriteHoldKey(store),key);
});


test("creation receipt lookup rejects a stale generation even with the SAME original UUID",()=>{
  const firstEpoch="123e4567-e89b-42d3-a456-426614174120";
  const secondEpoch="9b4216ea-8df6-45a4-8a5c-2f1f91ad283e";
  const rows=new Map([[PRODUCTION_WRITE_HOLD_KEY,key],[PRODUCTION_WRITE_EPOCH_KEY,firstEpoch]]);
  const store={
    getItem:(name:string)=>rows.get(name)??null,
    setItem:(name:string,value:string)=>{rows.set(name,value);},
    removeItem:(name:string)=>{rows.delete(name);},
  };
  const old=captureProductionWriteReviewSnapshot(store);
  assert.ok(old);
  assert.equal(old.holdToken,key);
  assert.equal(productionWriteReviewSnapshotUnchanged(store,old),true);
  // Another tab can start/complete a write and alter the epoch while an
  // earlier original-key lookup is still in flight. The ID may remain equal.
  rows.set(PRODUCTION_WRITE_EPOCH_KEY,secondEpoch);
  assert.equal(readProductionWriteHoldKey(store),key);
  assert.equal(productionWriteReviewSnapshotUnchanged(store,old),false);
  const current=captureProductionWriteReviewSnapshot(store);
  assert.ok(current);
  assert.equal(productionWriteReviewSnapshotUnchanged(store,current),true);
  rows.set(PRODUCTION_WRITE_EPOCH_KEY,"corrupt");
  assert.equal(productionWriteReviewSnapshotUnchanged(store,current),false,
    "Inaccessible or corrupt epoch must never authorize stale evidence");
});

test("strict receipt parser accepts only committed UUIDs and two declared actions",()=>{
  assert.deepEqual(parseProductionCreationReceipts([]),[]);
  assert.deepEqual(parseProductionCreationReceipts([
    {action:"create_quote",receipt_id:quote.toUpperCase()},
    {action:"create_order",receipt_id:order},
  ]),[
    {action:"create_quote",receiptId:quote},{action:"create_order",receiptId:order},
  ]);
  for(const invalid of [null,undefined,{},true,[null],[{}],
    [{action:"create_order",receipt_id:"garbage"}],
    [{action:"order_status",receipt_id:order}],
    [{action:"create_quote",receipt_id:quote,customerPhone:"secret"}],
    [{action:"create_quote",receipt_id:quote},{action:"create_quote",receipt_id:quote}],
    Array(3).fill({action:"create_quote",receipt_id:quote}),
    [{action:"create_order",receipt_id:order,anotherId:quote}],
  ])assert.equal(parseProductionCreationReceipts(invalid),null);
});

test("receipt lookup is read-only, authenticated and cannot unlock the review hold",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const ui=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const migration=readFileSync("supabase/migrations/20261107_production_creation_receipt_lookup.sql","utf8");
  assert.match(route,/if\(!await authorized\(\)\) return respond\(\{error:"Unauthorized\."\},401\)/);
  assert.match(route,/if\(action==="creation_receipt_lookup"\)\{/);
  assert.match(route,/rpc<unknown>\("production_creation_request_receipt_lookup",\{p_request_key:key\}\)/);
  assert.match(route,/parseProductionCreationReceipts\(rows\)/);
  assert.match(route,/return respond\(\{receipts\}\)/);
  assert.match(migration,/returns table\(action text,receipt_id uuid\)/);
  assert.match(migration,/where r\.request_key=p_request_key/);
  assert.match(migration,/limit 2/);
  assert.match(migration,/revoke all on function public\.production_creation_request_receipt_lookup/);
  assert.match(migration,/grant execute on function public\.production_creation_request_receipt_lookup/);
  assert.doesNotMatch(migration,/insert into|update private|delete from|recoveryToken|customerPhone/i);
  const lookup=ui.split("async function lookupPendingCreationReceipt(){")[1]?.split("function confirmReviewedProductionHistory()")[0]||"";
  assert.match(lookup,/const snapshot=captureProductionWriteReviewSnapshot\(safeProductionHoldStorage\(\)\)/);
  assert.match(lookup,/const pendingKey=snapshot\?\.holdToken/);
  assert.match(lookup,/action:"creation_receipt_lookup",requestKey:pendingKey/);
  assert.match(lookup,/if\(!response\.ok\)throw new Error/);
  assert.match(lookup,/parseProductionCreationReceiptResponse\(data\.receipts\)/);
  assert.match(lookup,/productionWriteReviewSnapshotUnchanged\(safeProductionHoldStorage\(\),snapshot\)/);
  assert.doesNotMatch(lookup,/readProductionWriteHoldKey\(safeProductionHoldStorage\(\)\)!==pendingKey/,
    "Original key equality is insufficient after an epoch change");
  assert.match(lookup,/setRecoveredCreationReceipts\(receipts\)/);
  assert.match(lookup,/No committed creation receipt was visible at lookup time/);
  assert.doesNotMatch(lookup,/acknowledgeProductionWriteHold|setRequiresWriteReview\(false\)|releaseProductionWriteHold|setPendingWriteReview\(null\)/,
    "A read-only lookup, including empty results, never clears a review hold");
  assert.match(ui,/Find original quote\/order receipt by request ID/);
  assert.match(ui,/COMMITTED CREATION RECEIPTS/);
  assert.match(ui,/A delayed commit or status update is still possible/);
});


test("operator creation receipt API response accepts only normalized private-safe wire fields",()=>{
  const safe=[
    {action:"create_quote",receiptId:quote.toUpperCase()},
    {action:"create_order",receiptId:order},
  ];
  assert.deepEqual(parseProductionCreationReceiptResponse(safe),[
    {action:"create_quote",receiptId:quote},
    {action:"create_order",receiptId:order},
  ]);
  assert.deepEqual(parseProductionCreationReceiptResponse([]),[]);
  assert.equal(parseProductionCreationReceipts(safe),null,
    "The SQL parser must remain strict about raw receipt_id fields");
  for(const bad of [
    null,{receipts:safe},[null],[{}],
    [{action:"create_order",receipt_id:order}],
    [{action:"create_order",receiptId:order,privatePhone:"sensitive"}],
    [{action:"create_order",receiptId:order,note:"sensitive"}],
    [{action:"create_order",receiptId:"not-a-uuid"}],
    [{action:"order_status",receiptId:order}],
    [safe[0],safe[0]],Array(3).fill(safe[0]),
  ])assert.equal(parseProductionCreationReceiptResponse(bad),null,
    "Never display malformed, duplicated or unauthorized creation receipt fields");
});

test("M145 signed Chromium rejects stale creation evidence after same-key epoch change",()=>{
  const browser=readFileSync("scripts/verify-production-creation-receipt-epoch-browser.cjs","utf8");
  const ci=readFileSync(".github/workflows/ci.yml","utf8");
  for(const token of [
    "M145 signed creation-receipt epoch browser QA is CI-only.",
    "for(const width of [390,768,1440])",
    "COMMITTED CREATION RECEIPTS",
    "window.__m145Race.release()",
    "originalHoldRetained:true",
    "An older receipt must not be displayed for a superseded write generation",
    "No live SQL, real production write, private customer data or owner signoff.",
  ])assert.ok(browser.includes(token),"Missing M145 browser assertion: "+token);
  assert.match(browser,/actualWrites,\[\]/);
  assert.ok(ci.includes("node scripts/verify-production-creation-receipt-epoch-browser.cjs"));
});
