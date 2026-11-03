import test from "node:test";
import assert from "node:assert/strict";
import {
  createOrderLifecycle, applyOrderLifecycleEvent, restoreOrderLifecycleSnapshot,
  ORDER_QC_CHECKS, type OrderLifecycleState, type OrderLifecycleAction,
} from "../src/lib/operator/order-lifecycle.ts";
import { reviewOrderLifecycleLegacySqlCompatibility } from "../src/lib/operator/order-lifecycle-legacy-sql.ts";
import { ORDER_TRANSITIONS } from "../src/lib/designer/production-state.ts";

const orderId="01234567-89ab-4cde-8f01-23456789abcd";
const revision="rev-locked-00000001";
const recipeHash="a".repeat(64);
const created=()=>createOrderLifecycle(orderId,revision,recipeHash);
function next(state:OrderLifecycleState,action:OrderLifecycleAction,extra:Record<string,unknown>={}){
  const index=state.sequence+1;
  return applyOrderLifecycleEvent(state,{
    eventId:"event-"+String(index).padStart(8,"0"),
    orderId,action,from:state.status,sequence:index,
    previousEventId:state.lastEventId,
    occurredAt:new Date(Date.UTC(2026,10,3,0,0,index)).toISOString(),
    actor:"operator-001",evidenceRef:"receipt-"+String(index).padStart(8,"0"),
    ...extra,
  });
}
const qc=()=>({
  inspector:"Named Tailor",inspectionReference:"QC-PHYSICAL-REFERENCE-001",
  revisionId:revision,recipeHash,
  checks:Object.fromEntries(ORDER_QC_CHECKS.map(check=>[check,true])),
});

test("deployed SQL transition contract is narrower than the operator proposal",()=>{
  assert.deepEqual(Object.keys(ORDER_TRANSITIONS),[
    "created","cloth_reserved","cutting","stitching","fitting","ready","delivered","cancelled",
  ]);
  assert.deepEqual(ORDER_TRANSITIONS.created,["cloth_reserved","cancelled"]);
  assert.deepEqual(ORDER_TRANSITIONS.ready,["delivered","cancelled"]);
  assert.deepEqual(ORDER_TRANSITIONS.delivered,[]);
});

test("read-only diagnostics fail closed even when labels happen to match legacy SQL",()=>{
  const empty=reviewOrderLifecycleLegacySqlCompatibility(created());
  assert.equal(empty.currentOperatorStage,"created");
  assert.equal(empty.auditedEvents,0);
  assert.equal(empty.firstGap,null);
  assert.deepEqual(empty.gaps,[]);
  assert.equal(empty.incompatibleEventCount,0);
  assert.equal(Object.isFrozen(empty.gaps),true);
  assert.equal(empty.allAuditTransitionsRepresentable,true);
  assert.equal(empty.productionWriteAuthorized,false);
  assert.equal(empty.blocker,"authenticated_transaction_required");
  assert.equal(Object.isFrozen(empty),true);

  const cancelled=next(created(),"cancel",{reason:"Customer requested cancellation"});
  const review=reviewOrderLifecycleLegacySqlCompatibility(cancelled);
  assert.equal(review.currentOperatorStage,"cancelled");
  assert.equal(review.firstGap,null);
  assert.deepEqual(review.gaps,[]);
  assert.equal(review.incompatibleEventCount,0);
  assert.equal(review.productionWriteAuthorized,false,
    "a transition shared by both graphs must never authorize a production write");
  assert.equal(review.blocker,"authenticated_transaction_required");
});

test("operator acceptance and subsequent cutting/finishing/QC/delivery require explicit mapping",()=>{
  const acceptance=next(created(),"accept");
  const acceptanceReview=reviewOrderLifecycleLegacySqlCompatibility(acceptance);
  assert.deepEqual(acceptanceReview.firstGap,{
    eventId:"event-00000001",action:"accept",
    from:"created",to:"accepted",reason:"unrepresented_status",
  });
  assert.equal(acceptanceReview.blocker,"sql_status_mapping_required");
  assert.equal(acceptanceReview.incompatibleEventCount,1);
  assert.deepEqual(acceptanceReview.gaps,[acceptanceReview.firstGap]);
  assert.equal(Object.isFrozen(acceptanceReview.gaps),true);
  assert.equal(acceptanceReview.productionWriteAuthorized,false);
  assert.equal(Object.isFrozen(acceptanceReview.firstGap),true);

  let state=acceptance;
  for(const action of [
    "start_cutting","start_stitching","start_finishing","submit_qc",
  ] as const) state=next(state,action);
  state=next(state,"approve_qc",{qc:qc()});
  state=next(state,"dispatch");
  state=next(state,"deliver");
  assert.equal(state.status,"delivered");
  const review=reviewOrderLifecycleLegacySqlCompatibility(state);
  assert.equal(review.auditedEvents,8);
  assert.deepEqual(review.firstGap,acceptanceReview.firstGap,
    "a final matching status must not erase unsupported intermediate history");
  assert.equal(review.incompatibleEventCount,7);
  assert.deepEqual(review.gaps.map(gap=>gap.action),[
    "accept","start_cutting","start_finishing","submit_qc","approve_qc","dispatch","deliver",
  ],"report every unsupported transition, including final dispatch/delivery stages");
  assert.equal(review.gaps.every(gap=>gap.reason==="unrepresented_status"),true);
  assert.equal(review.gaps.every(gap=>Object.isFrozen(gap)),true);
  assert.equal(Object.isFrozen(review.gaps),true);
  assert.equal(review.productionWriteAuthorized,false);

  const restored=restoreOrderLifecycleSnapshot(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(reviewOrderLifecycleLegacySqlCompatibility(restored),review);
});

test("recovery/QC holds and forged snapshots cannot bypass compatibility review",()=>{
  const accepted=next(created(),"accept");
  const held=next(accepted,"hold_for_recovery",{reason:"Machine temporarily unavailable"});
  const review=reviewOrderLifecycleLegacySqlCompatibility(held);
  assert.equal(review.currentOperatorStage,"recovery_pending");
  assert.equal(review.productionWriteAuthorized,false);
  assert.equal(review.firstGap?.reason,"unrepresented_status");
  assert.equal(review.incompatibleEventCount,2);
  assert.deepEqual(review.gaps.map(gap=>gap.action),["accept","hold_for_recovery"]);

  assert.throws(()=>reviewOrderLifecycleLegacySqlCompatibility({
    ...held,status:"ready" as never,
  }),/Untrusted lifecycle snapshot/);
  assert.throws(()=>reviewOrderLifecycleLegacySqlCompatibility(
    JSON.parse(JSON.stringify(held)) as OrderLifecycleState,
  ),/Untrusted lifecycle snapshot/);
  assert.equal(reviewOrderLifecycleLegacySqlCompatibility(
    restoreOrderLifecycleSnapshot(JSON.parse(JSON.stringify(held))),
  ).productionWriteAuthorized,false);
});
