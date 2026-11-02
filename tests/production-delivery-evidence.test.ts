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


test("ten rows for the same delivered order do not count as ten separate deliveries",()=>{
  const order={order_id:"order-unique",status:"delivered",created_at:"2026-10-01T10:00:00Z"};
  const receipt={order_id:order.order_id,manual_design_reentry:false,
    operator:"Inspector",evidence_reference:"Dispatch register 1",
    created_at:"2026-10-02T10:00:00Z"};
  const summary=summarizeProductionDeliveryEvidence(Array.from({length:10},()=>({...order})),[receipt]);
  assert.equal(summary.deliveredCount,1);
  assert.equal(summary.auditedTargetCount,0,"a duplicated order is unverified");
  assert.ok(summary.evidenceIntegrityIssues>0);
  assert.equal(summary.gateComplete,false);
});

test("duplicated delivered identity outside the first ten also blocks approval",()=>{
  const orders=Array.from({length:10},(_,index)=>({
    order_id:"distinct-"+index,status:"delivered",
    created_at:"2026-10-"+String(index+1).padStart(2,"0")+"T10:00:00Z",
  }));
  const receipts=orders.map(order=>({order_id:order.order_id,
    manual_design_reentry:false,operator:"Checker",
    evidence_reference:"Delivery book "+order.order_id,
    created_at:"2026-10-25T10:00:00Z"}));
  const clean=summarizeProductionDeliveryEvidence(orders,receipts);
  assert.equal(clean.gateComplete,true);
  const repeated=summarizeProductionDeliveryEvidence([...orders,{...orders[9]}],receipts);
  assert.equal(repeated.deliveredCount,10,"unique deliveries, not raw rows");
  assert.equal(repeated.gateComplete,false);
  assert.ok(repeated.evidenceIntegrityIssues>0);
});

test("conflicting duplicate completion receipts cannot be resolved by choosing the favourable one",()=>{
  const orders=Array.from({length:10},(_,i)=>({
    order_id:"ord-"+i,status:"delivered",
    created_at:"2026-10-01T10:00:00Z",
  }));
  const evidence=orders.map(o=>({order_id:o.order_id,
    manual_design_reentry:false,operator:"Checker",evidence_reference:"Cut dispatch",
    created_at:"2026-10-02T10:00:00Z"}));
  const summary=summarizeProductionDeliveryEvidence(orders,[
    ...evidence,{...evidence[0],manual_design_reentry:true},
  ]);
  assert.equal(summary.gateComplete,false);
  assert.equal(summary.auditedTargetCount,9);
  assert.equal(summary.legacyOrUnverifiedCount,1);
  assert.ok(summary.evidenceIntegrityIssues>0);
});

test("missing or forged non-boolean zero-reentry and impossible audit timestamps cannot certify the gate",()=>{
  const orders=Array.from({length:10},(_,i)=>({
    order_id:"ord-"+i,status:"delivered",
    created_at:"2026-10-01T10:00:00Z",
  }));
  const receipts=orders.map(o=>({
    order_id:o.order_id,manual_design_reentry:false,operator:"Checker",
    evidence_reference:"Dispatch register",created_at:"2026-10-02T10:00:00Z",
  }));
  for(const changed of [
    {...receipts[0],manual_design_reentry:"false"},
    {...receipts[0],manual_design_reentry:null},
    {...receipts[0],created_at:"not-a-date"},
    {...receipts[0],created_at:"2026-09-01T10:00:00Z"},
    {...receipts[0],operator:""},
    {...receipts[0],evidence_reference:""},
  ]){
    const summary=summarizeProductionDeliveryEvidence(orders,[changed,...receipts.slice(1)] as typeof receipts);
    assert.equal(summary.gateComplete,false);
    assert.equal(summary.zeroReentryTargetCount,9);
  }
  const wrongOrders=[...orders];
  wrongOrders[0]={...orders[0],created_at:"invalid"};
  assert.equal(summarizeProductionDeliveryEvidence(wrongOrders,receipts).gateComplete,false);
  assert.equal(summarizeProductionDeliveryEvidence(orders,receipts,0).gateComplete,false);
});
