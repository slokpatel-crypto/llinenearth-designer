import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {safeOutcomeReviewEvidence} from "../src/lib/designer/customer-outcome-review-transport.ts";
import {summarizeCustomerOutcomeLearning} from "../src/lib/designer/customer-outcome-learning.ts";

const outcome={
  outcome_id:"123e4567-e89b-42d3-a456-426614174013",
  order_id:"123e4567-e89b-42d3-a456-426614174011",
  revision_id:"LE-LOCK-CI-QUOTE-20261031",overall_rating:"needs_work",
  fit_result:"major_alteration",worn_confirmed:true,note:"CI bad fit",
  created_at:"2026-10-31T03:00:00Z",
  secret_supplier_phone:"DO-NOT-LEAK-CI-OUTCOME",
  learning_context:{
    version:"linen-earth-production-learning-context-v1",
    revisionId:"LE-LOCK-CI-QUOTE-20261031",recipeHash:"a".repeat(64),
    context:{occasion:"Semi-Formal",private_customer:"DO-NOT-LEAK-CI-CONTEXT"},
    fabrics:{shirtId:"ci-shirt",trouserId:"ci-trouser",secret_supplier:"DO-NOT-LEAK-CI-FABRIC"},
    shirt:{fit:"Regular",collar:"Point",cuff:"Barrel",wear:"Tucked",private_cost:"DO-NOT-LEAK-CI-SHIRT"},
    trouser:{shape:"Pleated",rise:"Mid Rise",break:"Slight Break"},
    secret_cost:"DO-NOT-LEAK-CI-NESTED",
  },
};
const review={
  review_id:"123e4567-e89b-42d3-a456-426614174015",
  outcome_id:outcome.outcome_id,decision:"rejected",
  reviewer:"Synthetic Reviewer",note:"Await physical inspection",
  created_at:"2026-10-31T04:00:00Z",
  private_contact:"DO-NOT-LEAK-CI-REVIEW",
};
const policy={
  policy_id:"123e4567-e89b-42d3-a456-426614174016",
  minimum_approved_cases:2,approved_by:"Synthetic Owner",
  note:"Owner approval still pending",created_at:"2026-10-31T04:30:00Z",
  private_token:"DO-NOT-LEAK-CI-POLICY",
};
test("private human review rows exclude extra SQL columns and preserve rejected poor-fit evidence",()=>{
  const safe=safeOutcomeReviewEvidence([outcome],[review],[policy]);
  assert.equal(safe.outcomes[0].fit_result,"major_alteration");
  assert.equal(safe.outcomes[0].overall_rating,"needs_work");
  assert.equal(safe.reviews[0].decision,"rejected");
  assert.equal(safe.outcomes[0].learning_context?.fabrics?.shirtId,"ci-shirt");
  assert.deepEqual(Object.keys(safe.outcomes[0].learning_context??{}).sort(),[
    "version","revisionId","recipeHash","context","fabrics","shirt","trouser",
  ].sort());
  assert.doesNotMatch(JSON.stringify(safe),/DO-NOT-LEAK-CI-/);
  assert.equal(Object.hasOwn(outcome,"secret_supplier_phone"),true);
  const summary=summarizeCustomerOutcomeLearning(safe.outcomes,safe.reviews,safe.policies);
  assert.equal(summary.rejected,1);
  assert.equal(summary.approved,0);
  assert.equal(summary.learningEligible,0);
  assert.equal(summary.gateComplete,false);
  assert.equal(summary.threshold,2);
});
test("corrupted latest review, policy, or nested context fails closed rather than hiding evidence",()=>{
  for(const triple of [
    [null,[review],[policy]],[[],{a:1},[policy]],[[],[],Array(101).fill(policy)],
    [Array(1001).fill(outcome),[],[]],[[],Array(5001).fill(review),[]],
    [[{...outcome,learning_context:{...outcome.learning_context,fabrics:["secret"]}}],[review],[policy]],
    [[{...outcome,worn_confirmed:"true"}],[review],[policy]],
    [[{...outcome,note:"x".repeat(1201)}],[review],[policy]],
    [[{...outcome,created_at:"never"}],[review],[policy]],
    [[outcome],[{...review,decision:"ignored"}],[policy]],
    [[outcome],[{...review,reviewer:{foo:"private"}}],[policy]],
    [[outcome],[review],[{...policy,minimum_approved_cases:"2"}]],
    [[outcome],[review],[{...policy,minimum_approved_cases:0}]],
  ] as Array<[unknown,unknown,unknown]>){
    assert.throws(()=>safeOutcomeReviewEvidence(...triple));
  }
});
test("customer outcome review GET must bound upstream JSON and always return private allowlisted evidence",()=>{
  const route=readFileSync("src/app/api/operator/customer-outcomes/route.ts","utf8");
  const fixture=readFileSync("scripts/ci-verified-stock-fixture.cjs","utf8");
  const script=readFileSync("scripts/verify-customer-outcome-review-private-http.cjs","utf8");
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  assert.ok(route.includes("readBoundedJsonResponse(response,maxBytes)"));
  assert.ok(route.includes("safeOutcomeReviewEvidence(rawOutcomes,rawReviews,rawPolicies)"));
  assert.ok(route.includes('return respond({error:"Unauthorized."},401)'));
  assert.ok(route.includes('return respond({error:"Customer outcome evidence could not be loaded."},503)'));
  assert.ok(!route.includes("await response.json()"));
  assert.ok(!route.includes("await response.text()"));
  assert.ok(fixture.includes("OUTCOME_REVIEW_FIXTURE"));
  assert.ok(fixture.includes("DO-NOT-LEAK-CI-OUTCOME-NESTED"));
  assert.ok(script.includes('assert.equal(data.summary.gateComplete,false'));
  assert.ok(script.includes('assert.equal(data.reviews[0].decision,"rejected")'));
  assert.ok(script.includes('assert.doesNotMatch(JSON.stringify(data),/DO-NOT-LEAK-CI-/)'));
  assert.ok(workflow.includes("node scripts/verify-customer-outcome-review-private-http.cjs"));
});
