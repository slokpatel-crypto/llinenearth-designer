import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifiedCustomerReviewReadback,verifiedCustomerPolicyReadback}
  from "../src/lib/designer/customer-review-receipt.ts";

const outcomeId="123e4567-e89b-42d3-a456-426614174011";
const otherOutcome="123e4567-e89b-42d3-a456-426614174012";
const reviewId="123e4567-e89b-42d3-a456-426614174013";
const policyId="123e4567-e89b-42d3-a456-426614174016";
const review={review_id:reviewId,outcome_id:outcomeId,decision:"approved"};
const policy={policy_id:policyId,minimum_approved_cases:2,approved_by:"Owner",
  note:"Two inspected customer outcomes"};

test("a real review receipt is confirmed only by the same review ID, outcome and decision",()=>{
  assert.equal(verifiedCustomerReviewReadback(reviewId,outcomeId,"approved",[review]),true);
  assert.equal(verifiedCustomerReviewReadback(reviewId.toUpperCase(),outcomeId.toUpperCase(),"approved",[review]),true);
  assert.equal(verifiedCustomerReviewReadback(reviewId,otherOutcome,"approved",[review]),false);
  assert.equal(verifiedCustomerReviewReadback(reviewId,outcomeId,"rejected",[review]),false);
  assert.equal(verifiedCustomerReviewReadback(reviewId,outcomeId,"approved",[
    {...review,review_id:"123e4567-e89b-42d3-a456-426614174014"},
  ]),false);
  for(const invalid of [null,false,{},[],[reviewId]," "+reviewId,reviewId+" ","bogus"]){
    assert.equal(verifiedCustomerReviewReadback(invalid,outcomeId,"approved",[review]),false);
  }
  for(const invalid of [null,{},[],[{review_id:reviewId}],
    [{...review,outcome_id:" "+outcomeId}], [{...review,review_id:" "+reviewId}]]){
    assert.equal(verifiedCustomerReviewReadback(reviewId,outcomeId,"approved",invalid),false);
  }
});

test("human policy success requires matching immutable policy ID, threshold, signer, and rationale",()=>{
  assert.equal(verifiedCustomerPolicyReadback(policyId,2,"Owner",policy.note,[policy]),true);
  assert.equal(verifiedCustomerPolicyReadback(policyId.toUpperCase(),2,"Owner",policy.note,[policy]),true);
  assert.equal(verifiedCustomerPolicyReadback(policyId,1,"Owner",policy.note,[policy]),false);
  assert.equal(verifiedCustomerPolicyReadback(policyId,2,"Another signer",policy.note,[policy]),false);
  assert.equal(verifiedCustomerPolicyReadback(policyId,2,"Owner","different justification",[policy]),false);
  assert.equal(verifiedCustomerPolicyReadback(policyId,2,"Owner",policy.note,[]),false);
  assert.equal(verifiedCustomerPolicyReadback(policyId,2,"Owner",policy.note,[{
    ...policy,policy_id:"123e4567-e89b-42d3-a456-426614174019",
  }]),false);
  for(const invalid of [null,false,{},[policyId]," "+policyId,policyId+" ","bogus"]){
    assert.equal(verifiedCustomerPolicyReadback(invalid,2,"Owner",policy.note,[policy]),false);
  }
});

test("operator review and policy confirmations require readback after POST before saved UI text",()=>{
  const ui=readFileSync("src/app/operator/customer-outcomes/CustomerOutcomesClient.tsx","utf8");
  const post=ui.split("async function post(")[1].split("async function review(")[0];
  const load=ui.split("async function load(")[1].split("useEffect(()=>")[0];
  assert.match(ui,/verifiedCustomerReviewReadback\(/);
  assert.match(ui,/verifiedCustomerPolicyReadback\(/);
  assert.match(load,/const confirmed=record\.configured/);
  assert.match(load,/if\(!confirmed\)throw new Error/);
  assert.match(post,/verifiedOperatorProductionCreateId\(record\.reviewId\)/);
  assert.match(post,/verifiedOperatorProductionCreateId\(record\.policyId\)/);
  const start=post.indexOf("const refreshed=await load(expected);");
  const stop=post.indexOf("if(!refreshed)return false;");
  const success=post.indexOf("setMessage(success);return true;");
  assert.ok(start>0&&stop>start&&success>stop);
  assert.match(ui,/Inspect existing records before retrying to avoid duplicate human decisions/);
  assert.doesNotMatch(post,/const refreshed=await load\(\);/);
});
