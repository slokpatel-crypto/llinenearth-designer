import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProductionDeliveryEvidence, summarizeProductionDeliveryEvidence } from "../src/lib/designer/production-delivery-evidence.ts";

test("manual re-entry incident requires field or note evidence",()=>{
  assert.throws(()=>normalizeProductionDeliveryEvidence({
    manualDesignReentry:true,reentryFields:[],note:"",
    operator:"SP",evidenceReference:"Packing audit sheet 001",
  }),/what had to be re-entered/i);
});

test("zero-reentry confirmation requires named checker and production-flow provenance",()=>{
  assert.throws(()=>normalizeProductionDeliveryEvidence({
    manualDesignReentry:false,reentryFields:[],note:"No design fields were retyped.",operator:"",
    evidenceReference:"job-card-1",
  }),/Named operator/i);
  assert.throws(()=>normalizeProductionDeliveryEvidence({
    manualDesignReentry:false,reentryFields:[],note:"No design fields were retyped.",operator:"SP",
    evidenceReference:"",
  }),/evidence reference/i);
  const result=normalizeProductionDeliveryEvidence({
    manualDesignReentry:false,reentryFields:[],note:"No design fields were retyped.",operator:"SP",
    evidenceReference:"Tailor job card LE-001",
  });
  assert.equal(result.manualDesignReentry,false);
  assert.equal(result.evidenceReference,"Tailor job card LE-001");
  assert.deepEqual(result.reentryFields,[]);
});

test("phase gate requires the first ten delivered orders to be audited with zero re-entry",()=>{
  const orders=Array.from({length:10},(_,index)=>({
    order_id:"order-"+index,status:"delivered",created_at:"2026-10-"+String(index+1).padStart(2,"0")+"T10:00:00Z",
  }));
  const evidence=orders.map((order,index)=>({
    order_id:order.order_id,manual_design_reentry:index===9,operator:"SP",evidence_reference:"job-card-"+index,created_at:"2026-10-20T10:00:00Z",
  }));
  const failed=summarizeProductionDeliveryEvidence(orders,evidence);
  assert.equal(failed.gateComplete,false);
  assert.equal(failed.reentryIncidentCount,1);

  const clean=evidence.map((item)=>({...item,manual_design_reentry:false}));
  assert.equal(summarizeProductionDeliveryEvidence(orders,clean).gateComplete,true);
});

test("fewer than ten delivered orders never completes the gate",()=>{
  const orders=[{order_id:"one",status:"delivered",created_at:"2026-10-01T10:00:00Z"}];
  const evidence=[{order_id:"one",manual_design_reentry:false,operator:"SP",evidence_reference:"job-card-one",created_at:"2026-10-01T12:00:00Z"}];
  assert.equal(summarizeProductionDeliveryEvidence(orders,evidence).gateComplete,false);
});


test("legacy delivery audits without provenance stay visible but cannot satisfy the gate",()=>{
  const orders=Array.from({length:10},(_,index)=>({
    order_id:"legacy-"+index,status:"delivered",created_at:"2026-10-"+String(index+1).padStart(2,"0")+"T10:00:00Z",
  }));
  const evidence=orders.map((order)=>({
    order_id:order.order_id,manual_design_reentry:false,created_at:"2026-10-20T10:00:00Z",
  }));
  const summary=summarizeProductionDeliveryEvidence(orders,evidence);
  assert.equal(summary.recordedTargetCount,10);
  assert.equal(summary.auditedTargetCount,0);
  assert.equal(summary.legacyOrUnverifiedCount,10);
  assert.equal(summary.gateComplete,false);
});

function tenAuditedDeliveries(){
  const orders=Array.from({length:10},(_,i)=>({
    order_id:`le-order-${i}`,status:"delivered",
    created_at:`2026-10-${String(i+1).padStart(2,"0")}T10:00:00Z`,
  }));
  const evidence=orders.map((order,i)=>({
    order_id:order.order_id,manual_design_reentry:false,
    operator:"Independent checker",evidence_reference:`delivery-job-card-${i}`,
    created_at:"2026-10-21T08:00:00Z",
  }));
  return {orders,evidence};
}

test("later zero-reentry evidence cannot overwrite an earlier re-entry incident",()=>{
  const {orders,evidence}=tenAuditedDeliveries();
  const incident={...evidence[0],manual_design_reentry:true,created_at:"2026-10-20T08:00:00Z"};
  for(const rows of [
    [incident,...evidence],
    [...evidence,incident],
  ]){
    const summary=summarizeProductionDeliveryEvidence(orders,rows);
    assert.equal(summary.recordedTargetCount,10);
    assert.equal(summary.reentryIncidentCount,1);
    assert.equal(summary.disputedTargetCount,1);
    assert.equal(summary.zeroReentryTargetCount,9);
    assert.equal(summary.gateComplete,false);
  }
});

test("duplicate delivered-order rows cannot masquerade as ten distinct successful deliveries",()=>{
  const {orders,evidence}=tenAuditedDeliveries();
  const duplicated=[...orders.slice(0,9),orders[0]];
  const summary=summarizeProductionDeliveryEvidence(duplicated,evidence);
  assert.equal(summary.deliveredCount,9);
  assert.equal(summary.duplicateDeliveredOrderCount,1);
  assert.equal(summary.firstTargetOrderCount,9);
  assert.equal(summary.gateComplete,false);
  const withTen=[...orders,orders[0]];
  assert.equal(summarizeProductionDeliveryEvidence(withTen,evidence).gateComplete,false);
});

test("unknown re-entry state, missing provenance and corrupt timestamps never become a zero-reentry release pass",()=>{
  const {orders,evidence}=tenAuditedDeliveries();
  assert.equal(summarizeProductionDeliveryEvidence(orders,evidence).gateComplete,true);
  for(const changed of [
    {...evidence[0],manual_design_reentry:undefined},
    {...evidence[0],manual_design_reentry:"false"},
    {...evidence[0],operator:""},
    {...evidence[0],created_at:"not-a-date"},
  ]){
    const summary=summarizeProductionDeliveryEvidence(orders,[changed as never,...evidence.slice(1)]);
    assert.equal(summary.auditedTargetCount,9);
    assert.equal(summary.zeroReentryTargetCount,9);
    assert.equal(summary.gateComplete,false,JSON.stringify(changed));
  }
  assert.equal(summarizeProductionDeliveryEvidence([
    {...orders[0],created_at:"broken-delivery-time"},...orders.slice(1),
  ],evidence).gateComplete,false);
});

test("phase eight first-ten standard cannot be weakened with zero or small target arguments",()=>{
  const {orders,evidence}=tenAuditedDeliveries();
  assert.equal(summarizeProductionDeliveryEvidence(orders,evidence,0).gateComplete,false);
  assert.equal(summarizeProductionDeliveryEvidence(orders,evidence,1).gateComplete,false);
  assert.equal(summarizeProductionDeliveryEvidence(orders,evidence,9).gateComplete,false);
  assert.equal(summarizeProductionDeliveryEvidence(orders,evidence,10).gateComplete,true);
});

test("two concordant audits for the same delivery retain both while counting one verified order",()=>{
  const {orders,evidence}=tenAuditedDeliveries();
  const result=summarizeProductionDeliveryEvidence(orders,[
    ...evidence,{...evidence[0],created_at:"2026-10-22T09:00:00Z"},
  ]);
  assert.equal(result.recordedTargetCount,10);
  assert.equal(result.reentryIncidentCount,0);
  assert.equal(result.disputedTargetCount,0);
  assert.equal(result.gateComplete,true);
});

test("delivery evidence refuses lossy or coerced checker and source identities",()=>{
  const base={manualDesignReentry:false,reentryFields:[],operator:"Independent Checker",evidenceReference:"Tailor job card 001"};
  for(const operator of ["x".repeat(121),["Independent Checker"],{name:"Independent Checker"},true]){
    assert.throws(()=>normalizeProductionDeliveryEvidence({...base,operator}),/Named operator/,JSON.stringify(operator));
  }
  for(const evidenceReference of ["r".repeat(241),["Tailor job card 001"],{id:"Tailor job card 001"},true]){
    assert.throws(()=>normalizeProductionDeliveryEvidence({...base,evidenceReference}),/Production-flow evidence reference/,JSON.stringify(evidenceReference));
  }
  assert.equal(normalizeProductionDeliveryEvidence({...base,operator:"O".repeat(120)}).operator.length,120);
  assert.equal(normalizeProductionDeliveryEvidence({...base,evidenceReference:"R".repeat(240)}).evidenceReference.length,240);
});

test("delivery signoff rejects historically truncated evidence rather than proving zero re-entry",()=>{
  const {orders,evidence}=tenAuditedDeliveries();
  for(const changed of [
    {...evidence[0],operator:"o".repeat(121)},
    {...evidence[0],evidence_reference:"r".repeat(241)},
  ]){
    const summary=summarizeProductionDeliveryEvidence(orders,[changed,...evidence.slice(1)]);
    assert.equal(summary.auditedTargetCount,9);
    assert.equal(summary.gateComplete,false);
  }
});

test("ten distinct deliveries cannot reuse the same physical job card source",()=>{
  const {orders,evidence}=tenAuditedDeliveries();
  const reused={...evidence[1],evidence_reference:"  "+evidence[0].evidence_reference.toUpperCase()+"  "};
  const summary=summarizeProductionDeliveryEvidence(orders,[evidence[0],reused,...evidence.slice(2)]);
  assert.equal(summary.auditedTargetCount,10);
  assert.equal(summary.zeroReentryTargetCount,10);
  assert.equal(summary.duplicateEvidenceSourceCount,1);
  assert.equal(summary.gateComplete,false);
});

test("repeat audit of the same physical source for its original order is not a cross-order collision",()=>{
  const {orders,evidence}=tenAuditedDeliveries();
  const repeat={...evidence[0],evidence_reference:evidence[0].evidence_reference.toUpperCase(),
    created_at:"2026-10-22T12:00:00Z"};
  const summary=summarizeProductionDeliveryEvidence(orders,[...evidence,repeat]);
  assert.equal(summary.duplicateEvidenceSourceCount,0);
  assert.equal(summary.gateComplete,true);
});

test("capitalization of an order ID never turns one delivery into two",()=>{
  const {orders,evidence}=tenAuditedDeliveries();
  const aliased={...orders[0],order_id:orders[0].order_id.toUpperCase()};
  const summary=summarizeProductionDeliveryEvidence([...orders,aliased],evidence);
  assert.equal(summary.deliveredCount,10);
  assert.equal(summary.duplicateDeliveredOrderCount,1);
  assert.equal(summary.gateComplete,false);
});

test("operator RPC 500-row truncation cannot certify first ten historical deliveries",()=>{
  const {orders,evidence}=tenAuditedDeliveries();
  assert.equal(summarizeProductionDeliveryEvidence(orders,evidence).gateComplete,true);
  const otherOrders=Array.from({length:490},(_,i)=>({
    order_id:"later-pending-"+i,status:"created",created_at:"2026-10-21T12:00:00Z",
  }));
  const olderCoverage=summarizeProductionDeliveryEvidence([...orders,...otherOrders],evidence);
  assert.equal(olderCoverage.sourceCoverageUnknown,true);
  assert.equal(olderCoverage.gateComplete,false);
  const otherEvidence=Array.from({length:490},(_,i)=>({
    ...evidence[0],order_id:"later-delivery-"+i,evidence_reference:"later-job-"+i,
  }));
  const auditsTruncated=summarizeProductionDeliveryEvidence(orders,[...evidence,...otherEvidence]);
  assert.equal(auditsTruncated.sourceCoverageUnknown,true);
  assert.equal(auditsTruncated.gateComplete,false);
});

test("first-ten API/SQL/UI contract uses all history instead of treating newest-500 as certification",async()=>{
  const {readFileSync}=await import("node:fs");
  const sql=readFileSync("supabase/migrations/20261103_production_first_ten_delivery_audit.sql","utf8");
  const route=readFileSync("src/app/api/operator/production-evidence/route.ts","utf8");
  const client=readFileSync("src/app/operator/production-evidence/ProductionEvidenceClient.tsx","utf8");
  const roadmap=readFileSync("src/lib/designer/roadmap-readiness.ts","utf8");
  assert.match(sql,/function public\.production_first_ten_delivery_audit\(\)/);
  assert.match(sql,/where o\.status='delivered'/);
  assert.match(sql,/order by delivered_at asc nulls first,created_at asc,order_id asc/);
  assert.match(sql,/join first_ten o on o\.order_id=e\.order_id/);
  assert.match(sql,/from private\.production_delivery_evidence e/);
  assert.match(sql,/from private\.production_order_events ev/);
  assert.match(sql,/ev\.status='delivered'/);
  assert.match(sql,/historyValid/);
  assert.match(sql,/revoke all on function public\.production_first_ten_delivery_audit\(\)/);
  assert.match(sql,/grant execute on function public\.production_first_ten_delivery_audit\(\)/);
  assert.match(route,/rpc<unknown>\("production_first_ten_delivery_audit",\{\}\)/);
  assert.match(route,/firstTenBasis/);
  assert.match(client,/setFirstTenBasis\(basis\)/);
  assert.match(client,/firstTenBasis\?\.orders\|\|\[\]/);
  assert.match(roadmap,/productionInput\.firstTenBasis===undefined/);
  assert.match(roadmap,/linen-earth-production-first-ten-audit-v2/);
  assert.match(roadmap,/historyValid===true/);
});

test("proof ordering respects real delivery completion, not when work was first booked",()=>{
  const {orders,evidence}=tenAuditedDeliveries();
  const extraOrder={order_id:"later-created-but-first-delivered",status:"delivered",
    created_at:"2026-10-11T10:00:00Z",delivered_at:"2026-10-11T11:00:00Z"};
  // Ten existing deliveries all completed after the newer-created order.
  const completed=orders.map((item,i)=>({...item,delivered_at:
    "2026-10-12T"+String(i+10).padStart(2,"0")+":00:00Z"}));
  const summary=summarizeProductionDeliveryEvidence([...completed,extraOrder],evidence);
  assert.equal(summary.deliveredCount,11);
  assert.equal(summary.firstTargetOrderCount,10);
  assert.equal(summary.auditedTargetCount,9);
  assert.equal(summary.gateComplete,false);
});

test("backdated or unparseable delivered timestamps cannot prove zero re-entry",()=>{
  const {orders,evidence}=tenAuditedDeliveries();
  const dated=orders.map((item)=>({...item,delivered_at:"2026-10-20T10:00:00Z"}));
  assert.equal(summarizeProductionDeliveryEvidence(dated,evidence).gateComplete,true);
  for(const delivered_at of ["2026-09-01T01:00:00Z","broken",null]){
    const changed=[{...dated[0],delivered_at},...dated.slice(1)];
    const summary=summarizeProductionDeliveryEvidence(changed,evidence);
    assert.equal(summary.invalidDeliveredOrderCount,1);
    assert.equal(summary.gateComplete,false);
  }
});

test("live release refuses missing or corrupted first-ten delivery audit RPC",async()=>{
  const {readFileSync}=await import("node:fs");
  const checker=readFileSync("scripts/check-cloud-readiness.mjs","utf8");
  const release=readFileSync("scripts/release-readiness.mjs","utf8");
  assert.match(checker,/production_first_ten_delivery_audit/);
  assert.match(checker,/linen-earth-production-first-ten-audit-v2/);
  assert.match(checker,/basis\?\.historyValid===true/);
  assert.match(checker,/basis\.orders\.length<=10/);
  assert.match(release,/20261103_production_first_ten_delivery_audit.sql/);
  assert.match(release,/production_first_ten_delivery_audit/);
});

test("immutable manual zero-reentry audit cannot predate the real delivery event",()=>{
  const {orders,evidence}=tenAuditedDeliveries();
  const withDelivery=orders.map((order)=>({...order,delivered_at:"2026-10-20T10:00:00Z"}));
  assert.equal(summarizeProductionDeliveryEvidence(withDelivery,evidence).gateComplete,true);
  const priorAudit={...evidence[0],created_at:"2026-10-19T10:00:00Z"};
  const summary=summarizeProductionDeliveryEvidence(withDelivery,[priorAudit,...evidence.slice(1)]);
  assert.equal(summary.legacyOrUnverifiedCount,1);
  assert.equal(summary.auditedTargetCount,9);
  assert.equal(summary.gateComplete,false);
});
