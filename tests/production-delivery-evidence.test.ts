import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProductionDeliveryEvidence, parseAuthoritativeFirstTenDeliveryAudit, summarizeProductionDeliveryEvidence } from "../src/lib/designer/production-delivery-evidence.ts";

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

test("capped or unverified ledger history cannot prove the first-ten production gate",()=>{
  const orders=Array.from({length:10},(_,index)=>({
    order_id:"order-"+index,status:"delivered",created_at:"2026-10-"+String(index+1).padStart(2,"0")+"T10:00:00Z",
  }));
  const evidence=orders.map((order,index)=>({
    order_id:order.order_id,manual_design_reentry:false,operator:"SP",
    evidence_reference:"job-card-"+index,created_at:"2026-10-20T10:00:00Z",
  }));
  assert.equal(summarizeProductionDeliveryEvidence(orders,evidence).gateComplete,true);
  const truncated=summarizeProductionDeliveryEvidence(orders,evidence,10,false);
  assert.equal(truncated.historyComplete,false);
  assert.equal(truncated.auditedTargetCount,10);
  assert.equal(truncated.gateComplete,false);
});

test("production completion provenance rejects coerced objects and contradictory fields",()=>{
  const base={
    manualDesignReentry:false,reentryFields:[],note:"Verified job card",
    operator:"Checker A",evidenceReference:"Tailor packet 004",
  };
  for(const input of [
    {...base,operator:{name:"Checker A"}},
    {...base,evidenceReference:{ref:"Tailor packet 004"}},
    {...base,note:{detail:"not text"}},
    {...base,reentryFields:["unrecognized"]},
    {...base,reentryFields:"fabric_identity"},
    {...base,reentryFields:["fabric_identity"]},
  ]) assert.throws(()=>normalizeProductionDeliveryEvidence(input));
  const incident=normalizeProductionDeliveryEvidence({
    ...base,manualDesignReentry:true,reentryFields:["fabric_identity"],note:"",
  });
  assert.deepEqual(incident.reentryFields,["fabric_identity"]);
});

test("malformed boolean audit evidence cannot certify zero re-entry",()=>{
  const orders=Array.from({length:10},(_,i)=>({
    order_id:"order-"+i,status:"delivered",created_at:"2026-10-"+String(i+1).padStart(2,"0")+"T10:00:00Z",
  }));
  const rows=orders.map((o)=>({
    order_id:o.order_id,manual_design_reentry:false,operator:"Checker A",
    evidence_reference:"packet-004",created_at:"2026-10-28T10:00:00Z",
  }));
  assert.equal(summarizeProductionDeliveryEvidence(orders,rows).gateComplete,true);
  const malformed=rows.map((row,i)=>i===3?{...row,manual_design_reentry:undefined}:row);
  assert.equal(summarizeProductionDeliveryEvidence(orders,malformed as typeof rows).gateComplete,false);
});

test("authoritative first-ten receipt follows delivered-event chronology and total count",()=>{
  const rows=Array.from({length:10},(_,index)=>({
    order_id:`123e4567-e89b-42d3-a456-${String(index).padStart(12,"0")}`,
    revision_id:`revision-${index}`,recipe_hash:"a".repeat(64),current_status:"delivered",
    order_created_at:`2026-01-${String(20-index).padStart(2,"0")}T10:00:00Z`,
    delivered_at:`2026-10-${String(index+1).padStart(2,"0")}T10:00:00Z`,
    total_delivered_count:47,
    evidence_id:`223e4567-e89b-42d3-a456-${String(index).padStart(12,"0")}`,
    manual_design_reentry:false,reentry_fields:[],note:"checked",operator:"SP",
    evidence_reference:`job-card-${index}`,evidence_created_at:"2026-10-20T10:00:00Z",
  }));
  const parsed=parseAuthoritativeFirstTenDeliveryAudit(rows);
  assert.ok(parsed);
  assert.equal(parsed?.deliveredCount,47);
  assert.equal(parsed?.orders[0].delivered_at,rows[0].delivered_at);
  const summary=summarizeProductionDeliveryEvidence(parsed!.orders,parsed!.evidence,10,true,parsed!.deliveredCount);
  assert.equal(summary.deliveredCount,47);
  assert.equal(summary.gateComplete,true);
});

test("historical delivery remains visible and blocks proof after contradictory status drift",()=>{
  const rows=Array.from({length:10},(_,index)=>({
    order_id:`123e4567-e89b-42d3-a456-${String(index).padStart(12,"0")}`,
    revision_id:`revision-${index}`,recipe_hash:"a".repeat(64),current_status:index===2?"ready":"delivered",
    order_created_at:`2026-09-${String(index+1).padStart(2,"0")}T10:00:00Z`,
    delivered_at:`2026-10-${String(index+1).padStart(2,"0")}T10:00:00Z`,total_delivered_count:10,
    evidence_id:`223e4567-e89b-42d3-a456-${String(index).padStart(12,"0")}`,
    manual_design_reentry:false,reentry_fields:[],note:"",operator:"SP",
    evidence_reference:`job-card-${index}`,evidence_created_at:"2026-10-20T10:00:00Z",
  }));
  const parsed=parseAuthoritativeFirstTenDeliveryAudit(rows)!;
  const summary=summarizeProductionDeliveryEvidence(parsed.orders,parsed.evidence,10,true,parsed.deliveredCount);
  assert.equal(summary.firstTargetOrderCount,10);
  assert.equal(summary.statusRegressionCount,1);
  assert.equal(summary.gateComplete,false);
});

test("malformed, duplicated, reordered or inconsistent database receipts fail closed",()=>{
  const row={
    order_id:"123e4567-e89b-42d3-a456-426614174000",revision_id:"revision-1",recipe_hash:"a".repeat(64),
    current_status:"delivered",order_created_at:"2026-09-01T10:00:00Z",delivered_at:"2026-10-01T10:00:00Z",
    total_delivered_count:2,evidence_id:null,manual_design_reentry:null,reentry_fields:null,note:null,
    operator:null,evidence_reference:null,evidence_created_at:null,
  };
  assert.equal(parseAuthoritativeFirstTenDeliveryAudit([row,{...row}]),null);
  assert.equal(parseAuthoritativeFirstTenDeliveryAudit([{...row,total_delivered_count:0}]),null);
  assert.equal(parseAuthoritativeFirstTenDeliveryAudit([{...row,delivered_at:"not-a-date"}]),null);
  assert.equal(parseAuthoritativeFirstTenDeliveryAudit([{...row,current_status:"unknown"}]),null);
  const later={...row,order_id:"123e4567-e89b-42d3-a456-426614174001",delivered_at:"2026-10-02T10:00:00Z"};
  assert.equal(parseAuthoritativeFirstTenDeliveryAudit([later,row]),null);
});
