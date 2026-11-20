import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCustomerQualityInsights, CUSTOMER_INSIGHT_RPC_LIMITS } from "../src/lib/designer/customer-quality-insights.ts";
import type { CustomerOutcomeEvidenceRow, CustomerOutcomeReviewRow, CustomerOutcomePolicyRow } from "../src/lib/designer/customer-outcome-learning.ts";

const at=(day:number,hour=12)=>`2026-11-${String(day).padStart(2,"0")}T${String(hour).padStart(2,"0")}:00:00Z`;
function outcome(id:string,orderId:string,extra:Partial<CustomerOutcomeEvidenceRow>={}):CustomerOutcomeEvidenceRow{
  return {
    outcome_id:id,order_id:orderId,revision_id:"rev-"+orderId,overall_rating:"good",
    fit_result:"clean_first_fit",worn_confirmed:true,created_at:at(18),note:"private customer note NEVER DISPLAY",
    learning_context: {
      version:"linen-earth-production-learning-context-v1",
      revisionId:"rev-"+orderId,
      recipeHash:"a".repeat(64),
      fabrics:{shirtId:"shirt-1",trouserId:"pant-1"},
      shirt:{fit:"Regular / Classic Fit"},
      trouser:{shape:"Straight Trouser"},
      context:{occasion:"Formal"},
    }, ...extra,
  };
}
function review(id:string,extra:Partial<CustomerOutcomeReviewRow>={}):CustomerOutcomeReviewRow {
  return {review_id:"review-"+id,outcome_id:id,decision:"approved",reviewer:"Owner",note:"",created_at:at(19),...extra};
}
const policy:CustomerOutcomePolicyRow={policy_id:"policy-1",minimum_approved_cases:2,approved_by:"Owner",note:"Human threshold",created_at:at(17)};

test("real latest reviewed orders are counted once with construction cohorts",()=>{
  const summary=summarizeCustomerQualityInsights([
    outcome("o1","order-1"),outcome("o2","order-2",{overall_rating:"needs_work",fit_result:"major_alteration"}),
  ],[review("o1"),review("o2")],[policy]);
  assert.equal(summary.reviewedUniqueOrders,2);
  assert.equal(summary.approvedWithLineage,2);
  assert.equal(summary.verifiedWornFit,2);
  assert.equal(summary.ratings.good,1);
  assert.equal(summary.ratings.needs_work,1);
  assert.equal(summary.fits.clean_first_fit,1);
  assert.equal(summary.fits.major_alteration,1);
  assert.equal(summary.gate,"review_only");
  assert.equal(summary.cohorts.length,3);
  assert.deepEqual(summary.cohorts.find(x=>x.dimension==="Shirt fit"),{
    dimension:"Shirt fit",value:"Regular / Classic Fit",orders:2,worn:2,
    cleanFirstFit:1,minorAlterations:0,majorAlterations:1,needsWork:1,
  });
  assert.equal(JSON.stringify(summary).includes("private customer note"),false);
  assert.equal(JSON.stringify(summary).includes("order-1"),false);
  assert.equal(JSON.stringify(summary).includes("rev-order"),false);
});

test("newer unreviewed outcome blocks stale approved evidence for the same order",()=>{
  const summary=summarizeCustomerQualityInsights([
    outcome("old","order-1",{created_at:at(17)}),
    outcome("new","order-1",{created_at:at(19),overall_rating:"needs_work",fit_result:"major_alteration"}),
  ],[review("old",{created_at:at(18)})],[policy]);
  assert.equal(summary.approvedWithLineage,0);
  assert.equal(summary.excluded.unreviewed,1);
  assert.equal(summary.gate,"collecting");
});

test("latest reviewer rejection cancels earlier human approval",()=>{
  const result=summarizeCustomerQualityInsights([outcome("o1","order-1")],[
    review("o1",{review_id:"approve",created_at:at(18)}),
    review("o1",{review_id:"reject",created_at:at(20),decision:"rejected"}),
  ],[policy]);
  assert.equal(result.excluded.rejected,1);
  assert.equal(result.approvedWithLineage,0);
});

test("equal-timestamp competing outcomes and reviews fail closed without guessing order",()=>{
  const sameOrder=summarizeCustomerQualityInsights([
    outcome("a","order-1"),outcome("b","order-1"),
  ],[review("a"),review("b")],[]);
  assert.equal(sameOrder.excluded.ambiguous,1);
  const sameReview=summarizeCustomerQualityInsights([outcome("a","order-1")],[
    review("a",{review_id:"first",decision:"approved"}),
    review("a",{review_id:"second",decision:"rejected"}),
  ],[]);
  assert.equal(sameReview.excluded.ambiguous,1);
  assert.equal(sameReview.approvedWithLineage,0);
});

test("missing, foreign or fabricated garment lineage never contributes to quality cohorts",()=>{
  const cases=[
    outcome("bad1","order-1",{learning_context:null}),
    outcome("bad2","order-2",{learning_context:{version:"linen-earth-production-learning-context-v1",revisionId:"wrong",recipeHash:"a".repeat(64)}}),
    outcome("bad3","order-3",{learning_context:{
      version:"linen-earth-production-learning-context-v1",revisionId:"rev-order-3",
      recipeHash:"a".repeat(64),fabrics:{shirtId:"shirt-1",trouserId:"pant-1"},
      shirt:{fit:""},trouser:{shape:"Straight"},context:{occasion:"Formal"},
    }}),
  ];
  const result=summarizeCustomerQualityInsights(cases,cases.map(x=>review(x.outcome_id)),[policy]);
  assert.equal(result.excluded.invalidLineage,3);
  assert.equal(result.approvedWithLineage,0);
  assert.equal(result.cohorts.length,0);
});

test("unworn feedback can describe satisfaction but cannot certify physical fit",()=>{
  const result=summarizeCustomerQualityInsights([
    outcome("o1","order-1",{worn_confirmed:false,fit_result:"not_checked",overall_rating:"love"}),
    outcome("o2","order-2",{worn_confirmed:false,fit_result:"major_alteration"}),
  ],[review("o1"),review("o2")],[policy]);
  assert.equal(result.approvedWithLineage,1);
  assert.equal(result.ratings.love,1);
  assert.equal(result.verifiedWornFit,0);
  assert.equal(result.excluded.invalidData,1);
});

test("human policy is mandatory, and capped RPC snapshots never claim readiness",()=>{
  const approved=summarizeCustomerQualityInsights([outcome("a","order-1")],[review("a")],[]);
  assert.equal(approved.gate,"no_human_policy");
  const cappedOutcomes=Array.from({length:CUSTOMER_INSIGHT_RPC_LIMITS.outcomes},(_,i)=>
    outcome("case-"+i,"order-"+i));
  const snapshot=summarizeCustomerQualityInsights(cappedOutcomes,[],[policy]);
  assert.equal(snapshot.sampleLimited,true);
  assert.equal(snapshot.gate,"incomplete_snapshot");
});

test("different construction families produce separate, deterministic drill-down rows",()=>{
  const a=outcome("o1","order-1");
  const b=outcome("o2","order-2",{learning_context:{
    ...(a.learning_context as object),revisionId:"rev-order-2",
    shirt:{fit:"Slim Fit"},trouser:{shape:"Wide Leg"},context:{occasion:"Casual"},
  }});
  const input=[a,b],reviews=[review("o1"),review("o2")];
  const first=summarizeCustomerQualityInsights(input,reviews,[policy]);
  const second=summarizeCustomerQualityInsights([...input].reverse(),[...reviews].reverse(),[policy]);
  assert.deepEqual(first,second);
  assert.equal(first.cohorts.filter(x=>x.dimension==="Shirt fit").length,2);
});
