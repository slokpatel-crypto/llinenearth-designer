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


test("duplicate durable evidence IDs cannot inflate the human learning threshold",()=>{
  const approved={...review,decision:"approved"};
  const single=safeOutcomeReviewEvidence([outcome],[approved],[policy]);
  assert.equal(summarizeCustomerOutcomeLearning(single.outcomes,single.reviews,single.policies).gateComplete,false);
  // An upstream duplicate of an already-approved, context-bearing outcome
  // must not turn the owner's two-case threshold into a false success.
  assert.throws(()=>safeOutcomeReviewEvidence(
    [outcome,{...outcome,note:"Repeated SQL join row"}],[approved],[policy],
  ),/Duplicate or missing customer outcome evidence ID/);
  // UUIDs are case-insensitive even when a backend returns mixed case.
  assert.throws(()=>safeOutcomeReviewEvidence(
    [outcome,{...outcome,outcome_id:outcome.outcome_id.toUpperCase()}],[approved],[policy],
  ),/Duplicate or missing customer outcome evidence ID/);
  // Conflicting repeated review rows must not let their ordering choose an
  // approval over a rejection.
  assert.throws(()=>safeOutcomeReviewEvidence(
    [outcome],[approved,{...review}],[policy],
  ),/Duplicate or missing customer review evidence ID/);
  assert.throws(()=>safeOutcomeReviewEvidence(
    [outcome],[approved],[policy,{...policy,minimum_approved_cases:1}],
  ),/Duplicate or missing customer policy evidence ID/);
  assert.throws(()=>safeOutcomeReviewEvidence(
    [{...outcome,outcome_id:"  "}],[approved],[policy],
  ),/Duplicate or missing customer outcome evidence ID/);
});


test("human-learning transport rejects impossible calendar timestamps instead of Date.parse rollover",()=>{
  for(const invalid of [
    "2026-02-31T03:00:00Z","2025-02-29T03:00:00Z",
    "2026-04-31T03:00:00Z","2026-13-01T03:00:00Z",
    "2026-10-31T25:00:00Z","2026-10-31T03:61:00Z",
    "2026-10-31T03:00:00","2026-10-31 03:00:00Z",
  ]){
    assert.throws(()=>safeOutcomeReviewEvidence(
      [{...outcome,created_at:invalid}],[review],[policy],
    ),/Invalid customer learning timestamp/);
    assert.throws(()=>safeOutcomeReviewEvidence(
      [outcome],[{...review,created_at:invalid}],[policy],
    ),/Invalid customer learning timestamp/);
    assert.throws(()=>safeOutcomeReviewEvidence(
      [outcome],[review],[{...policy,created_at:invalid}],
    ),/Invalid customer learning timestamp/);
  }
  const leap="2024-02-29T03:00:00+00:00";
  const good=safeOutcomeReviewEvidence(
    [{...outcome,created_at:leap}],
    [{...review,created_at:"2024-02-29T03:00:01Z"}],
    [{...policy,created_at:leap}],
  );
  assert.equal(good.outcomes[0].created_at,leap);
});

test("human review cannot claim customer feedback recorded later than the review",()=>{
  assert.throws(()=>safeOutcomeReviewEvidence(
    [outcome],[{...review,created_at:"2026-10-31T02:59:59.999Z"}],[policy],
  ),/Customer review predates the recorded outcome/);
  assert.throws(()=>safeOutcomeReviewEvidence(
    [{...outcome,created_at:"2026-10-31T08:30:00+05:30"}],
    [{...review,created_at:"2026-10-31T02:59:59Z"}],[policy],
  ),/Customer review predates the recorded outcome/);
  assert.doesNotThrow(()=>safeOutcomeReviewEvidence(
    [outcome],[{...review,created_at:"2026-10-31T08:30:00+05:30"}],[policy],
  ),"Equal instants with different offsets are a valid transaction boundary");
  assert.doesNotThrow(()=>safeOutcomeReviewEvidence(
    [outcome],[{...review,outcome_id:"123e4567-e89b-42d3-a456-426614174099",
      created_at:"2026-10-01T01:00:00Z"}],[policy],
  ),"Older reviews may refer to outcomes outside the bounded latest-1000 page");
});


test("future-dated human feedback, reviews and policies cannot approve present-day learning",()=>{
  const asOf=Date.parse("2026-10-31T12:00:00Z");
  const valid="2026-10-31T12:04:59Z"; // bounded five-minute clock skew
  const future="2026-10-31T12:05:01Z";
  const older="2026-10-31T11:00:00Z";
  const caseRow={...outcome,created_at:older};
  const reviewRow={...review,created_at:older};
  const policyRow={...policy,created_at:older};
  const clean=safeOutcomeReviewEvidence([caseRow],[reviewRow],[policyRow],asOf);
  assert.equal(clean.reviews.length,1);
  assert.doesNotThrow(()=>safeOutcomeReviewEvidence(
    [caseRow],[{...reviewRow,created_at:valid}],[policyRow],asOf,
  ));
  for(const value of [future,"2026-11-01T00:00:00Z","2032-01-01T00:00:00Z"]){
    assert.throws(()=>safeOutcomeReviewEvidence(
      [{...caseRow,created_at:value}],[reviewRow],[policyRow],asOf,
    ),/Future-dated customer learning timestamp/);
    assert.throws(()=>safeOutcomeReviewEvidence(
      [caseRow],[{...reviewRow,created_at:value}],[policyRow],asOf,
    ),/Future-dated customer learning timestamp/);
    assert.throws(()=>safeOutcomeReviewEvidence(
      [caseRow],[reviewRow],[{...policyRow,created_at:value}],asOf,
    ),/Future-dated customer learning timestamp/);
  }
  for(const clock of [-1,Number.NaN,Number.POSITIVE_INFINITY,asOf+0.5]){
    assert.throws(()=>safeOutcomeReviewEvidence([caseRow],[reviewRow],[policyRow],clock),
      /Invalid customer evidence observation clock/);
  }
  assert.doesNotThrow(()=>safeOutcomeReviewEvidence(
    [caseRow],[reviewRow],[policyRow],asOf),
  "One consistent observation clock prevents a race between three evidence lists");
});


test("mixed-case PostgreSQL outcome UUIDs cannot hide a rejected human review or same-time conflict",()=>{
  const approved={...review,review_id:"123e4567-e89b-42d3-a456-426614174019",
    outcome_id:outcome.outcome_id.toUpperCase(),decision:"approved" as const};
  const rejected={...review,review_id:"123e4567-e89b-42d3-a456-426614174020",
    outcome_id:outcome.outcome_id,decision:"rejected" as const};
  const humanPolicy={...policy,minimum_approved_cases:1};
  const valid=safeOutcomeReviewEvidence([outcome],[approved],[humanPolicy]);
  const accepted=summarizeCustomerOutcomeLearning(valid.outcomes,valid.reviews,valid.policies);
  assert.equal(accepted.approved,1,"Uppercase review UUID must match lowercase outcome UUID");
  assert.equal(accepted.learningEligible,1);
  assert.equal(accepted.gateComplete,true);
  for(const pair of [[approved,rejected],[rejected,approved]]){
    const evidence=safeOutcomeReviewEvidence([outcome],pair,[humanPolicy]);
    const result=summarizeCustomerOutcomeLearning(evidence.outcomes,evidence.reviews,evidence.policies);
    assert.equal(result.reviewConflictCount,1,"Case variants cannot split the same human decision history");
    assert.equal(result.approved,0);
    assert.equal(result.learningEligible,0);
    assert.equal(result.gateComplete,false);
  }
  const later={...rejected,review_id:"123e4567-e89b-42d3-a456-426614174021",
    created_at:"2026-10-31T04:00:01Z"};
  const resolved=safeOutcomeReviewEvidence([outcome],[approved,later],[humanPolicy]);
  assert.equal(summarizeCustomerOutcomeLearning(resolved.outcomes,resolved.reviews,resolved.policies).rejected,1);
  assert.equal(summarizeCustomerOutcomeLearning(resolved.outcomes,resolved.reviews,resolved.policies).gateComplete,false);
});
