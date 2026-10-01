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
