import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
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

const reviewUuid="123e4567-e89b-42d3-a456-426614174000";

test("review evidence requires literal UUID, decision, reviewer and note",()=>{
  assert.deepEqual(normalizeCustomerOutcomeReview({outcomeId:reviewUuid.toUpperCase(),decision:"approved",reviewer:" Owner ",note:null}),{outcomeId:reviewUuid,decision:"approved",reviewer:"Owner",note:""});
  const base={outcomeId:reviewUuid,decision:"approved",reviewer:"Owner",note:"ok"};
  for(const [field,invalid] of [["outcomeId",[reviewUuid]],["outcomeId","-".repeat(36)],["decision",["approved"]],["reviewer",["Owner"]],["reviewer","x".repeat(121)],["note",["ok"]],["note","x".repeat(1201)]] as const)
    assert.throws(()=>normalizeCustomerOutcomeReview({...base,[field]:invalid}));
  assert.throws(()=>normalizeCustomerOutcomeReview({...base,decision:"rejected",note:""}),/rejection reason/);
});

test("policy cannot infer human approval from coerced thresholds or text",()=>{
  assert.deepEqual(normalizeCustomerOutcomePolicy({minimumApprovedCases:25,approvedBy:" Owner ",note:"source"}),{minimumApprovedCases:25,approvedBy:"Owner",note:"source"});
  const base={minimumApprovedCases:25,approvedBy:"Owner",note:"source"};
  for(const invalid of ["25",[25],true,null,0,1.5,10001,NaN,Infinity])
    assert.throws(()=>normalizeCustomerOutcomePolicy({...base,minimumApprovedCases:invalid}),/whole-number/);
  for(const [field,invalid] of [["approvedBy",["Owner"]],["approvedBy","x".repeat(121)],["note",["source"]],["note","x".repeat(1201)]] as const)
    assert.throws(()=>normalizeCustomerOutcomePolicy({...base,[field]:invalid}));
});

test("operator outcome route bounds transport and confirms actual review/policy IDs",()=>{
  const source=readFileSync("src/app/api/operator/customer-outcomes/route.ts","utf8");
  const post=source.split("export async function POST")[1];
  assert.match(post,/secureJsonRequestError\(request,16384\)/);
  assert.match(post,/readSecureJsonObject\(request,16384\)/);
  assert.match(post,/parseCustomerProductionRecordId\(reviewId\)/);
  assert.match(post,/parseCustomerProductionRecordId\(policyId\)/);
  assert.match(post,/SecureJsonBodyTooLarge/);
  assert.match(post,/SecureJsonBodyInvalid/);
  assert.doesNotMatch(post,/await request\.json\(\)/);
  assert.doesNotMatch(post,/String\(body\.action/);
});
