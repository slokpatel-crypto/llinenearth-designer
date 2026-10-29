import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasCompleteCustomerProductionHistory } from "../src/lib/designer/customer-production-history.ts";

test("J5: four legitimate empty owner-scoped lists remain a valid empty customer history",()=>{
  assert.equal(hasCompleteCustomerProductionHistory([],[],[],[]),true);
  assert.equal(hasCompleteCustomerProductionHistory([{id:"quote"}],[],[{id:"event"}],[]),true);
});

test("J5: malformed owned RPC list cannot be promoted to an empty customer history",()=>{
  const valid=[[],[],[],[]];
  for(let index=0;index<4;index++){
    for(const malformed of [null,undefined,false,true,0,{}, {rows:[]}, "[]", "", ["valid"].join(",")]){
      const values=[...valid];
      values[index]=malformed;
      assert.equal(hasCompleteCustomerProductionHistory(...values),false,`ledger ${index}: ${String(malformed)}`);
    }
  }
});

test("customer production GET refuses success-shaped snapshots if any owned RPC list is malformed",()=>{
  const route=readFileSync("src/app/api/customer-account/production/route.ts","utf8");
  const get=route.split("export async function GET(request:Request)")[1]?.split("export async function POST")[0]||"";
  assert.match(get,/getCustomerIdentity\(request\)/);
  assert.match(get,/production_quote_list_owned_v2/);
  assert.match(get,/production_order_list_owned/);
  assert.match(get,/production_order_event_list_owned/);
  assert.match(get,/production_customer_outcome_list_owned/);
  assert.match(get,/hasCompleteCustomerProductionHistory\(quotes,orders,orderEvents,outcomes\)/);
  assert.match(get,/throw new Error\("Malformed customer production history list receipts\."\)/);
  assert.ok(get.indexOf("hasCompleteCustomerProductionHistory")<get.indexOf("{quotes,orders,orderEvents,outcomes}"));
  assert.match(get,/error:"Production status is temporarily unavailable\."\},\{status:503\}/);
  assert.match(get,/private, no-store/);
});
