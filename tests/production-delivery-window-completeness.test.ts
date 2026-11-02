import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  PRODUCTION_DELIVERY_LEDGER_RPC_LIMIT,
  deliveryLedgerSnapshotIsExhaustive,
} from "../src/lib/designer/production-delivery-snapshot-completeness.ts";

test("opposite-ordered production RPCs cannot certify the first ten from a capped 500-row window",()=>{
  const below=Array.from({length:499},(_,i)=>i);
  const cap=Array.from({length:500},(_,i)=>i);
  assert.equal(PRODUCTION_DELIVERY_LEDGER_RPC_LIMIT,500);
  assert.equal(deliveryLedgerSnapshotIsExhaustive([],[]),true);
  assert.equal(deliveryLedgerSnapshotIsExhaustive(below,below),true);
  assert.equal(deliveryLedgerSnapshotIsExhaustive(cap,below),false);
  assert.equal(deliveryLedgerSnapshotIsExhaustive(below,cap),false);
  assert.equal(deliveryLedgerSnapshotIsExhaustive(cap,cap),false);
  // Exactly 500 rows might be complete, but without total count/cursor
  // evidence it must be treated conservatively as unverified.
  assert.equal(deliveryLedgerSnapshotIsExhaustive(Array.from({length:10},()=>0),[]),true);
});

test("malformed or unbounded ledger cannot declare exhaustive source coverage",()=>{
  for(const value of [null,undefined,false,{},42,"[]"]){
    assert.equal(deliveryLedgerSnapshotIsExhaustive(value,[]),false);
    assert.equal(deliveryLedgerSnapshotIsExhaustive([],value),false);
  }
  for(const limit of [-1,0,0.5,Number.NaN,Infinity]){
    assert.equal(deliveryLedgerSnapshotIsExhaustive([],[],limit),false);
  }
});

test("private production evidence GET fails closed before reporting configured true on truncated ledgers",()=>{
  const route=readFileSync("src/app/api/operator/production-evidence/route.ts","utf8");
  const orders=route.indexOf('"production_order_list"');
  const evidence=route.indexOf('"production_delivery_evidence_list"');
  const check=route.indexOf("if(!deliveryLedgerSnapshotIsExhaustive(orders,evidence))");
  const configured=route.indexOf("configured:true",check);
  assert.ok(orders>=0&&evidence>orders&&check>evidence&&configured>check);
  assert.match(route,/status:409/);
  assert.match(route,/Delivery ledger is incomplete; full historical pagination is required before acceptance/);
  assert.match(route,/PRODUCTION_DELIVERY_LEDGER_RPC_LIMIT/);
  assert.match(route,/function privateEvidenceJson\(/);
  assert.match(route,/cache-control","private, no-store"/);
});
