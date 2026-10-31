import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {safeProductionCustomerOutcomes} from "../src/lib/designer/production-outcome-transport.ts";
import {validProductionDeskResponse} from "../src/lib/designer/production-desk-ledger.ts";

const outcome={
  outcome_id:"123e4567-e89b-42d3-a456-426614174013",
  order_id:"123e4567-e89b-42d3-a456-426614174011",
  revision_id:"LE-LOCK-CI-QUOTE-20261031",
  overall_rating:"needs_work",fit_result:"major_alteration",worn_confirmed:true,
  note:"Synthetic poor fit, not customer acceptance",created_at:"2026-10-31T03:00:00Z",
  private_customer_contact:"DO-NOT-LEAK-CI-OUTCOME",
  private_shop_account:"DO-NOT-LEAK-CI-ACCOUNT",
};
const quote={
  quote_id:"123e4567-e89b-42d3-a456-426614174010",
  revision_id:outcome.revision_id,recipe_hash:"a".repeat(64),
  currency:"INR",line_items:[{label:"CI garment",amount:1000}],
  subtotal:1000,adjustment:0,total:1000,note:"CI-only",status:"accepted",
  created_at:"2026-10-31T00:00:00Z",updated_at:"2026-10-31T00:00:00Z",
};
const order={
  order_id:outcome.order_id,revision_id:outcome.revision_id,
  recipe_hash:quote.recipe_hash,quote_id:quote.quote_id,
  status:"created",note:"CI only",
  created_at:"2026-10-31T01:00:00Z",updated_at:"2026-10-31T01:00:00Z",
};
function envelope(customerOutcomes:unknown[]){
  return {
    configured:true,quotes:[quote],orders:[order],
    qcInspections:[],customerOutcomes,learningContexts:[],
    optionalEvidenceSources:{
      qcInstalled:false,customerOutcomesInstalled:true,
      learningContextInstalled:false,
    },
  };
}

test("valid poor-fit outcomes retain evidence while raw private columns are never copied",()=>{
  assert.equal(validProductionDeskResponse(envelope([outcome])),true);
  const original=[outcome];
  const result=safeProductionCustomerOutcomes(original);
  assert.equal(result.length,1);
  assert.deepEqual(Object.keys(result[0]).sort(),[
    "outcome_id","order_id","revision_id","overall_rating",
    "fit_result","worn_confirmed","note","created_at",
  ].sort());
  assert.equal(result[0].overall_rating,"needs_work");
  assert.equal(result[0].fit_result,"major_alteration");
  assert.equal(result[0].worn_confirmed,true);
  assert.equal(validProductionDeskResponse(envelope(result)),true);
  assert.doesNotMatch(JSON.stringify(result),/DO-NOT-LEAK-CI-/);
  assert.ok(Object.hasOwn(outcome,"private_customer_contact"),
    "Projection must not modify original SQL receipt");
});

test("outcome projection bounds arrays and rejects invalid row shapes",()=>{
  for(const source of [null,{},[null],[[outcome]],[12],
    Array.from({length:251},()=>outcome)]){
    assert.throws(()=>safeProductionCustomerOutcomes(source));
  }
  for(const invalid of [
    {...outcome,overall_rating:"perfect"},
    {...outcome,fit_result:"perfect"},
    {...outcome,worn_confirmed:"true"},
    {...outcome,order_id:"not-a-uuid"},
    {...outcome,created_at:"2026-10-30T23:00:00Z"},
  ]){
    assert.equal(validProductionDeskResponse(envelope([invalid])),false,
      "Original invalid evidence must be rejected before projection");
  }
});

test("production route checks full raw outcome validity before privacy projection",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const original=route.indexOf("if(!validProductionDeskResponse(originalReceipt))");
  const projected=route.indexOf("safeProductionCustomerOutcomes(outcomes.rows)");
  const final=route.indexOf("if(!validProductionDeskResponse(receipt))");
  assert.ok(original>0&&projected>original&&final>projected,
    "Original lineage validation must precede outcome filtering and revalidation");
  assert.ok(route.includes("customerOutcomes:safeProductionCustomerOutcomes(outcomes.rows)"));
  const mock=readFileSync("scripts/ci-verified-stock-fixture.cjs","utf8");
  assert.ok(mock.includes("CUSTOMER_OUTCOME_LIST_PATH"));
  assert.ok(mock.includes("DO-NOT-LEAK-CI-OUTCOME"));
  const http=readFileSync("scripts/verify-production-ledger-private-http.cjs","utf8");
  assert.ok(http.includes('assert.equal(outcome.overall_rating,"needs_work")'));
  assert.ok(http.includes('assert.equal(outcome.fit_result,"major_alteration")'));
  assert.ok(http.includes('assert.equal(Object.hasOwn(outcome,"private_customer_contact"),false)'));
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  assert.ok(workflow.includes("node scripts/verify-production-ledger-private-http.cjs"));
});
