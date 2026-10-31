import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {safeProductionQuoteOrderRows} from "../src/lib/designer/production-quote-order-transport.ts";

const hash="a".repeat(64);
const quote={
  quote_id:"123e4567-e89b-42d3-a456-426614174010",
  revision_id:"LE-LOCK-CI-QUOTE-20261031",recipe_hash:hash,currency:"INR",
  line_items:[{label:"CI-only stitched garment",amount:1000,secret_factory_cost:"DO-NOT-LEAK-CI-LINE-ITEM"}],
  subtotal:1000,adjustment:0,total:1000,note:"CI only",status:"accepted",
  created_at:"2026-10-31T00:00:00Z",updated_at:"2026-10-31T00:00:00Z",
  private_customer_phone:"DO-NOT-LEAK-CI-QUOTE",
};
const order={
  order_id:"123e4567-e89b-42d3-a456-426614174011",
  revision_id:quote.revision_id,recipe_hash:hash,quote_id:quote.quote_id,
  status:"created",note:"CI only",
  created_at:"2026-10-31T01:00:00Z",updated_at:"2026-10-31T01:00:00Z",
  private_supplier_rate:"DO-NOT-LEAK-CI-ORDER",
};

test("valid production quote/order data is still displayed but private extra fields are never forwarded",()=>{
  const result=safeProductionQuoteOrderRows([quote],[order]);
  assert.equal(result.quotes.length,1);
  assert.equal(result.orders.length,1);
  assert.equal(result.quotes[0].total,1000);
  assert.equal(result.quotes[0].status,"accepted");
  assert.equal(result.orders[0].status,"created");
  assert.equal(result.quotes[0].line_items[0].label,"CI-only stitched garment");
  assert.equal(result.quotes[0].line_items[0].amount,1000);
  assert.equal(Object.keys(result.quotes[0]).length,12);
  assert.equal(Object.keys(result.orders[0]).length,8);
  assert.deepEqual(Object.keys(result.quotes[0].line_items[0]).sort(),["amount","label"]);
  assert.doesNotMatch(JSON.stringify(result),/DO-NOT-LEAK-CI-/);
  assert.ok(Object.hasOwn(quote,"private_customer_phone"),"Never mutate source ledger rows");
  assert.ok(Object.hasOwn(order,"private_supplier_rate"),"Never mutate source ledger rows");
});

test("malformed quote totals, missing lineage or future contradictory order must fail before filtering",()=>{
  for(const [quotes,orders] of [
    [[{...quote,total:999}],[order]],
    [[{...quote,recipe_hash:"b".repeat(64)}],[order]],
    [[{...quote,line_items:[{...quote.line_items[0],amount:1300}]}],[order]],
    [[{...quote,created_at:"2026-11-01T01:00:00Z"}],[order]],
    [[quote],[{...order,status:"delivered",quote_id:"invalid"}]],
    [[{...quote,status:"void"}],[order]],
    [[{...quote,total:"1000"}],[order]],
    [[quote,quote],[order]],
    [[quote],[order,order]],
    [Array.from({length:101},()=>quote),[]],
    [null,[]],
    [{},[]],
  ]){
    assert.throws(()=>safeProductionQuoteOrderRows(quotes,orders),/Unverified production quote\/order ledger/);
  }
});

test("production GET and real HTTP CI enforce quote/order nested privacy at release gate",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const fixture=readFileSync("scripts/ci-verified-stock-fixture.cjs","utf8");
  const http=readFileSync("scripts/verify-production-ledger-private-http.cjs","utf8");
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  assert.ok(route.includes("safeProductionQuoteOrderRows(quotes,orders)"));
  assert.ok(route.includes("quotes:safeLedger.quotes,orders:safeLedger.orders"));
  assert.ok(fixture.includes("PRODUCTION_LISTS"));
  assert.ok(fixture.includes("DO-NOT-LEAK-CI-LINE-ITEM"));
  assert.ok(fixture.includes("DO-NOT-LEAK-CI-QUOTE"));
  assert.ok(fixture.includes("DO-NOT-LEAK-CI-ORDER"));
  assert.ok(http.includes("assert.doesNotMatch(JSON.stringify(data),/DO-NOT-LEAK-CI-/)"));
  assert.ok(http.includes("signed operator"));
  assert.ok(workflow.includes("node scripts/verify-production-ledger-private-http.cjs"));
});
