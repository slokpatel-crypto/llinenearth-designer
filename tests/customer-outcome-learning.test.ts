import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCustomerOutcomePolicy,
  normalizeCustomerOutcomeReview,
  summarizeCustomerOutcomeLearning,
} from "../src/lib/designer/customer-outcome-learning.ts";

const outcomes=[
  {outcome_id:"o1",order_id:"p1",revision_id:"r1",overall_rating:"love",fit_result:"clean_first_fit",worn_confirmed:true,note:"",created_at:"2026-10-01T10:00:00Z"},
  {outcome_id:"o2",order_id:"p2",revision_id:"r2",overall_rating:"good",fit_result:"not_checked",worn_confirmed:false,note:"",created_at:"2026-10-01T11:00:00Z"},
];

test("learning gate stays open without a human-entered threshold",()=>{
  const summary=summarizeCustomerOutcomeLearning(outcomes,[
    {review_id:"r1",outcome_id:"o1",decision:"approved",reviewer:"Owner",note:"",created_at:"2026-10-01T12:00:00Z"},
  ],[]);
  assert.equal(summary.approved,1);
  assert.equal(summary.threshold,null);
  assert.equal(summary.gateComplete,false);
});

test("latest human review controls whether an outcome is eligible",()=>{
  const summary=summarizeCustomerOutcomeLearning(outcomes,[
    {review_id:"r1",outcome_id:"o1",decision:"approved",reviewer:"Owner",note:"",created_at:"2026-10-01T12:00:00Z"},
    {review_id:"r2",outcome_id:"o1",decision:"rejected",reviewer:"Owner",note:"Production issue",created_at:"2026-10-01T13:00:00Z"},
  ],[
    {policy_id:"p",minimum_approved_cases:1,approved_by:"Owner",note:"Documented threshold",created_at:"2026-10-01T09:00:00Z"},
  ]);
  assert.equal(summary.approved,0);
  assert.equal(summary.rejected,1);
  assert.equal(summary.gateComplete,false);
});

test("human policy threshold is never invented by normalization",()=>{
  assert.throws(()=>normalizeCustomerOutcomePolicy({minimumApprovedCases:"",approvedBy:"Owner",note:"Policy"}),/whole-number/);
  assert.deepEqual(
    normalizeCustomerOutcomePolicy({minimumApprovedCases:25,approvedBy:"Owner",note:"Approved launch-learning policy"}),
    {minimumApprovedCases:25,approvedBy:"Owner",note:"Approved launch-learning policy"},
  );
});

test("rejected customer evidence requires reviewer context",()=>{
  assert.throws(()=>normalizeCustomerOutcomeReview({
    outcomeId:"00000000-0000-4000-8000-000000000001",
    decision:"rejected",
    reviewer:"Owner",
    note:"",
  }),/rejection reason/);
});


test("approved evidence needs durable design context before the human threshold gate can pass",()=>{
  const reviews=[
    {review_id:"r1",outcome_id:"o1",decision:"approved" as const,reviewer:"Owner",note:"",created_at:"2026-10-01T12:00:00Z"},
  ];
  const policies=[
    {policy_id:"p",minimum_approved_cases:1,approved_by:"Owner",note:"Documented threshold",created_at:"2026-10-01T09:00:00Z"},
  ];
  const withoutContext=summarizeCustomerOutcomeLearning(outcomes,reviews,policies);
  assert.equal(withoutContext.approved,1);
  assert.equal(withoutContext.learningEligible,0);
  assert.equal(withoutContext.gateComplete,false);

  const withContext=summarizeCustomerOutcomeLearning(
    [{...outcomes[0],learning_context:{
      version:"linen-earth-production-learning-context-v1",
      revisionId:"r1",
      recipeHash:"a".repeat(64),
      fabrics:{shirtId:"shirt-1",trouserId:"trouser-1"},
    }}],
    reviews,
    policies,
  );
  assert.equal(withContext.learningEligible,1);
  assert.equal(withContext.gateComplete,true);
});


test("malformed or mismatched durable context cannot satisfy the learning threshold",()=>{
  const reviews=[
    {review_id:"r1",outcome_id:"o1",decision:"approved" as const,reviewer:"Owner",note:"",created_at:"2026-10-01T12:00:00Z"},
  ];
  const policies=[
    {policy_id:"p",minimum_approved_cases:1,approved_by:"Owner",note:"Documented threshold",created_at:"2026-10-01T09:00:00Z"},
  ];
  const wrongRevision=summarizeCustomerOutcomeLearning(
    [{...outcomes[0],learning_context:{
      version:"linen-earth-production-learning-context-v1",
      revisionId:"different-revision",
      recipeHash:"b".repeat(64),
      fabrics:{shirtId:"shirt-1",trouserId:"trouser-1"},
    }}],
    reviews,
    policies,
  );
  assert.equal(wrongRevision.learningEligible,0);
  assert.equal(wrongRevision.gateComplete,false);

  const missingPair=summarizeCustomerOutcomeLearning(
    [{...outcomes[0],learning_context:{
      version:"linen-earth-production-learning-context-v1",
      revisionId:"r1",
      recipeHash:"b".repeat(64),
      fabrics:{shirtId:"shirt-1"},
    }}],
    reviews,
    policies,
  );
  assert.equal(missingPair.learningEligible,0);
  assert.equal(missingPair.gateComplete,false);
});
