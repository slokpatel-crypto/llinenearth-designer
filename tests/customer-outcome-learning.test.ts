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


test("both customer-outcome API error paths redact backend Error objects",()=>{
  const source=readFileSync(new URL("../src/app/api/operator/customer-outcomes/route.ts",import.meta.url),"utf8");
  const safe='console.error("[operator/customer-outcomes]",error instanceof Error?error.name:"UnknownError");';
  assert.equal(source.split(safe).length-1,2,"GET and POST catches must both use safe error names");
  assert.equal(source.split(safe).length-1,2);
});


test("clean first-fit metric excludes alterations even when reviewers approve adverse evidence for learning",()=>{
  const version="linen-earth-production-learning-context-v1";
  const cases=[
    {id:"clean",fit:"clean_first_fit",worn:true},
    {id:"minor",fit:"minor_alteration",worn:true},
    {id:"major",fit:"major_alteration",worn:true},
    {id:"unchecked",fit:"not_checked",worn:false},
    {id:"unworn",fit:"clean_first_fit",worn:false},
  ];
  const evidences=cases.map(c=>({
    outcome_id:c.id,order_id:"order-"+c.id,revision_id:"revision-"+c.id,
    overall_rating:c.fit==="major_alteration"?"needs_work":"good",
    fit_result:c.fit,worn_confirmed:c.worn,note:"human-reviewed example",
    created_at:"2026-10-31T09:00:00Z",
    learning_context:{
      version,revisionId:"revision-"+c.id,recipeHash:"c".repeat(64),
      fabrics:{shirtId:"shirt-1",trouserId:"trouser-1"},
    },
  }));
  const humanReviews=cases.map((c,i)=>({
    review_id:"review-"+c.id,outcome_id:c.id,decision:"approved" as const,
    reviewer:"Owner",note:"Valid evidence of fit or alteration",
    created_at:"2026-10-31T10:00:00Z",
  }));
  const policy=[{policy_id:"policy-1",minimum_approved_cases:5,approved_by:"Owner",
    note:"Five valid learning records",created_at:"2026-10-31T11:00:00Z"}];
  const summary=summarizeCustomerOutcomeLearning(evidences,humanReviews,policy);
  assert.equal(summary.approved,5);
  assert.equal(summary.learningEligible,5,"Alterations remain available as human-approved learning evidence");
  assert.equal(summary.approvedFitCases,1,"Only worn clean-first-fit evidence is a clean fit success");
  assert.equal(summary.gateComplete,true,"Learning gate and clean fit metric are intentionally separate");
  const ui=readFileSync("src/app/operator/customer-outcomes/CustomerOutcomesClient.tsx","utf8");
  assert.match(ui,/CLEAN FIRST-FIT CASES/);
  assert.doesNotMatch(ui,/APPROVED FIT CASES/);
});


test("operator customer learning gate invalidates stale or malformed reads",()=>{
  const source=readFileSync("src/app/operator/customer-outcomes/CustomerOutcomesClient.tsx","utf8");
  const reload=source.slice(source.indexOf("async function load("),source.indexOf("useEffect(()=>"));
  const invalidate=reload.indexOf("setVerified(false)");
  const fetchStart=reload.indexOf('fetch("/api/operator/customer-outcomes"');
  assert.ok(invalidate>=0&&invalidate<fetchStart,"Clear previous trust before requesting new evidence");
  for(const reset of ["setOutcomes([]);","setReviews([]);","setPolicies([]);"])
    assert.ok(reload.includes(reset),"Missing fail-closed reset: "+reset);
  assert.match(reload,/refreshSequence\.current/);
  assert.match(reload,/if\(generation!==refreshSequence\.current\)return false/);
  assert.match(reload,/safeOutcomeReviewEvidence\(record\.outcomes,record\.reviews,record\.policies\)/);
  assert.match(reload,/if\(typeof record\.configured!=="boolean"\)/);
  assert.match(reload,/setVerified\(record\.configured\)/);
  assert.match(reload,/catch\{/);
  assert.match(source,/!ready\?"UNVERIFIED":summary\.gateComplete\?"MET":"OPEN"/);
  assert.match(source,/ready&&outcomes\.map/);
  assert.match(source,/disabled=\{busy\|\|!ready/);
  assert.match(source,/if\(!refreshed\)return false/);
  assert.doesNotMatch(source,/Array\.isArray\(data\.reviews\)\?data\.reviews:\[\]/);
});


test("same-timestamp conflicting latest human reviews never become an approval by row order",()=>{
  const eligible={...outcomes[0],learning_context:{
    version:"linen-earth-production-learning-context-v1",revisionId:"r1",
    recipeHash:"f".repeat(64),fabrics:{shirtId:"shirt-1",trouserId:"trouser-1"},
  }};
  const approved={review_id:"approved-1",outcome_id:"o1",decision:"approved" as const,
    reviewer:"Owner A",note:"Passed",created_at:"2026-10-31T10:00:00.123Z"};
  const rejected={...approved,review_id:"rejected-1",decision:"rejected" as const,
    reviewer:"Owner B",note:"Real fit issue"};
  const policy={policy_id:"policy-a",minimum_approved_cases:1,approved_by:"Owner",
    note:"One verified customer case",created_at:"2026-10-31T10:01:00.000Z"};
  const clean=summarizeCustomerOutcomeLearning([eligible],[approved],[policy]);
  assert.equal(clean.gateComplete,true,"Valid non-contradictory human evidence remains usable");
  for(const latest of [[approved,rejected],[rejected,approved]]){
    const result=summarizeCustomerOutcomeLearning([eligible],latest,[policy]);
    assert.equal(result.approved,0);
    assert.equal(result.rejected,0,"Do not invent a rejection either");
    assert.equal(result.unreviewed,1);
    assert.equal(result.learningEligible,0);
    assert.equal(result.reviewConflictCount,1);
    assert.equal(result.gateComplete,false);
  }
  const older={...rejected,review_id:"older",created_at:"2026-10-31T09:59:59.999Z"};
  const resolved=summarizeCustomerOutcomeLearning([eligible],[older,approved],[policy]);
  assert.equal(resolved.reviewConflictCount,0);
  assert.equal(resolved.gateComplete,true,"Genuinely later non-conflicting review restores human evidence");
  const repeatedSameDecision=summarizeCustomerOutcomeLearning([eligible],[
    approved,{...approved,review_id:"another-approval",reviewer:"Owner B"},
  ],[policy]);
  assert.equal(repeatedSameDecision.reviewConflictCount,0);
  assert.equal(repeatedSameDecision.gateComplete,true,"An identical decision is not a conflict");
});

test("different human learning policies with the same latest timestamp cannot choose a favorable threshold",()=>{
  const eligible={...outcomes[0],learning_context:{
    version:"linen-earth-production-learning-context-v1",revisionId:"r1",
    recipeHash:"f".repeat(64),fabrics:{shirtId:"shirt-1",trouserId:"trouser-1"},
  }};
  const review={review_id:"review-1",outcome_id:"o1",decision:"approved" as const,
    reviewer:"Owner",note:"Fit inspected",created_at:"2026-10-31T10:00:00Z"};
  const permissive={policy_id:"policy-1",minimum_approved_cases:1,
    approved_by:"Owner A",note:"One real reviewed case",created_at:"2026-10-31T11:00:00.000Z"};
  const strict={...permissive,policy_id:"policy-2",minimum_approved_cases:25,
    approved_by:"Owner B",note:"Require 25 real cases"};
  for(const policies of [[permissive,strict],[strict,permissive]]){
    const result=summarizeCustomerOutcomeLearning([eligible],[review],policies);
    assert.equal(result.policyConflict,true);
    assert.equal(result.policy,null);
    assert.equal(result.threshold,null);
    assert.equal(result.gateComplete,false);
    assert.equal(result.learningEligible,1,"Valid positive case stays counted but cannot certify conflicting policy");
  }
  const later={...permissive,policy_id:"policy-later",created_at:"2026-10-31T11:00:01Z"};
  const resolved=summarizeCustomerOutcomeLearning([eligible],[review],[strict,permissive,later]);
  assert.equal(resolved.policyConflict,false);
  assert.equal(resolved.threshold,1);
  assert.equal(resolved.gateComplete,true);
});


test("operator human-review UI exposes ambiguous latest human decisions and policy approval",()=>{
  const source=readFileSync("src/app/operator/customer-outcomes/CustomerOutcomesClient.tsx","utf8");
  assert.match(source,/useMemo\(\(\)=>resolveLatestCustomerReviews\(reviews\),\[reviews\]\)/);
  assert.match(readFileSync("src/lib/designer/customer-outcome-learning.ts","utf8"),/current\.decision!==review\.decision/);
  assert.match(source,/role="alert"/);
  assert.match(source,/summary\.reviewConflictCount>0\|\|summary\.policyConflict/);
  assert.match(source,/CONFLICT — REVIEW REQUIRED/);
  assert.match(source,/reviewRow&&!reviewConflicts\.has\(outcome\.outcome_id\.toLowerCase\(\)\)/);
  assert.match(source,/The learning gate remains OPEN until a new unambiguous human decision/);
});

test("older reviews outside the current outcome window cannot veto current human eligibility",()=>{
  const current={...outcomes[0],learning_context:{
    version:"linen-earth-production-learning-context-v1",revisionId:"r1",
    recipeHash:"e".repeat(64),fabrics:{shirtId:"shirt-1",trouserId:"trouser-1"},
  }};
  const currentApproval={review_id:"latest",outcome_id:"O1",decision:"approved" as const,
    reviewer:"Owner",note:"Physical check",created_at:"2026-10-31T11:00:00Z"};
  const irrelevant=[
    {review_id:"old-approved",outcome_id:"OLD-HISTORY",decision:"approved" as const,
      reviewer:"Owner",note:"Legacy",created_at:"2026-10-30T11:00:00Z"},
    {review_id:"old-rejected",outcome_id:"old-history",decision:"rejected" as const,
      reviewer:"Owner",note:"Legacy fault",created_at:"2026-10-30T11:00:00Z"},
  ];
  const policy={policy_id:"policy",minimum_approved_cases:1,
    approved_by:"Owner",note:"Documented case",created_at:"2026-10-31T11:30:00Z"};
  for(const reviews of [
    [currentApproval,...irrelevant],
    [...irrelevant].reverse().concat(currentApproval),
  ]){
    const result=summarizeCustomerOutcomeLearning([current],reviews,[policy]);
    assert.equal(result.approved,1);
    assert.equal(result.learningEligible,1);
    assert.equal(result.reviewConflictCount,0);
    assert.equal(result.gateComplete,true,
      "An out-of-window historical dispute cannot revoke unrelated current approval");
  }
});

test("same human outcome UUID in different letter cases resolves one current decision",()=>{
  const outcome={...outcomes[0],outcome_id:"123e4567-e89b-42d3-a456-426614174aBC",
    learning_context:{version:"linen-earth-production-learning-context-v1",revisionId:"r1",
      recipeHash:"d".repeat(64),fabrics:{shirtId:"shirt-1",trouserId:"trouser-1"}}};
  const review={review_id:"one",outcome_id:outcome.outcome_id.toLowerCase(),
    decision:"approved" as const,reviewer:"Owner",note:"Fit confirmed",
    created_at:"2026-10-31T11:00:00Z"};
  const policy={policy_id:"one",minimum_approved_cases:1,approved_by:"Owner",
    note:"One approved physical case",created_at:"2026-10-31T11:10:00Z"};
  const approved=summarizeCustomerOutcomeLearning([outcome],[review],[policy]);
  assert.equal(approved.approved,1);
  assert.equal(approved.learningEligible,1);
  assert.equal(approved.gateComplete,true);
  const conflict=summarizeCustomerOutcomeLearning([outcome],
    [review,{...review,review_id:"two",outcome_id:outcome.outcome_id,
      decision:"rejected" as const}],[policy]);
  assert.equal(conflict.reviewConflictCount,1);
  assert.equal(conflict.unreviewed,1);
  assert.equal(conflict.approved,0);
  assert.equal(conflict.gateComplete,false);
  const ui=readFileSync("src/app/operator/customer-outcomes/CustomerOutcomesClient.tsx","utf8");
  assert.match(ui,/latestReviewByOutcome\.get\(outcome\.outcome_id\.toLowerCase\(\)\)/);
  assert.match(ui,/reviewConflicts\.has\(outcome\.outcome_id\.toLowerCase\(\)\)/);
});
