import test from "node:test";
import assert from "node:assert/strict";
import {
  parseProductionEvidenceTimestamp,
  validProductionFirstTenAuditBasis,
  summarizeProductionDeliveryEvidence,
} from "../src/lib/designer/production-delivery-evidence.ts";
import { verifiedFirstTenAuditReceipt } from "../src/lib/designer/production-first-ten-receipt.ts";

function physicalAuditFixture(){
  const orders=Array.from({length:10},(_,index)=>({
    order_id:`00000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`,
    status:"delivered",
    revision_id:`locked-revision-${index}`,
    recipe_hash:"a".repeat(64),
    created_at:"2026-02-28T10:00:00Z",
    delivered_at:`2026-03-${String(index+1).padStart(2,"0")}T10:00:00Z`,
  }));
  const evidence=orders.map((order,index)=>({
    order_id:order.order_id,
    evidence_id:`10000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`,
    revision_id:order.revision_id,
    recipe_hash:order.recipe_hash,
    order_created_at:order.created_at,
    manual_design_reentry:false,
    reentry_fields:[],
    note:"",
    operator:"Independent checker",
    evidence_reference:`job-card-${index}`,
    created_at:"2026-03-11T10:00:00Z",
  }));
  return {version:"linen-earth-production-first-ten-audit-v2",historyValid:true,orders,evidence};
}

test("physical delivery timestamps require real Gregorian calendar dates and explicit offsets",()=>{
  for(const valid of [
    "2028-02-29T23:59:59Z",
    "2026-03-01T00:00:00.123456+05:30",
    "2026-03-01T00:00:00-04:00",
  ]) assert.ok(Number.isFinite(parseProductionEvidenceTimestamp(valid)),valid);
  for(const invalid of [
    "2026-02-29T10:00:00Z",
    "2026-02-31T10:00:00Z",
    "2028-02-30T10:00:00Z",
    "2026-04-31T10:00:00Z",
    "2026-13-01T10:00:00Z",
    "0000-01-01T10:00:00Z",
    "2026-03-01T24:00:00Z",
    "2026-03-01T10:60:00Z",
    "2026-03-01T10:00:60Z",
    "2026-03-01T10:00:00+24:00",
    "2026-03-01T10:00:00+05:60",
    "2026-03-01T10:00:00",
    "2026-03-01",
    null,
    ["2026-03-01T10:00:00Z"],
  ]) assert.ok(Number.isNaN(parseProductionEvidenceTimestamp(invalid)),JSON.stringify(invalid));
});

test("first-ten authoritative RPC and operator summary reject impossible dates, never normalized success",()=>{
  const basis=physicalAuditFixture();
  assert.equal(validProductionFirstTenAuditBasis(basis),true);
  assert.equal(verifiedFirstTenAuditReceipt(basis).historyValid,true);
  assert.equal(summarizeProductionDeliveryEvidence(basis.orders,basis.evidence).gateComplete,true);
  const invalidOrderDates=["2026-02-31T10:00:00Z","2026-04-31T10:00:00Z","2026-03-01T24:00:00Z"];
  for(const bad of invalidOrderDates){
    const orders=basis.orders.map((order,index)=>index===0?{...order,delivered_at:bad}:order);
    const changed={...basis,orders};
    assert.equal(validProductionFirstTenAuditBasis(changed),false,bad);
    assert.throws(()=>verifiedFirstTenAuditReceipt(changed),/Malformed first-ten/);
    assert.equal(summarizeProductionDeliveryEvidence(orders,basis.evidence).gateComplete,false,bad);
  }
  const badCreated={...basis,orders:[{...basis.orders[0],created_at:"2026-02-31T10:00:00Z"},...basis.orders.slice(1)]};
  assert.equal(validProductionFirstTenAuditBasis(badCreated),false);
  const badAudit={...basis,evidence:[{...basis.evidence[0],created_at:"2026-03-32T10:00:00Z"},...basis.evidence.slice(1)]};
  assert.equal(validProductionFirstTenAuditBasis(badAudit),false);
  assert.equal(summarizeProductionDeliveryEvidence(basis.orders,badAudit.evidence).gateComplete,false);
});

test("first-ten proof rejects padded order and audit receipt identities without rewriting them",()=>{
  const basis=physicalAuditFixture();
  assert.equal(validProductionFirstTenAuditBasis(basis),true);
  const caseVariant={
    ...basis,
    orders:[{...basis.orders[0],order_id:basis.orders[0].order_id.toUpperCase()},...basis.orders.slice(1)],
    evidence:[{...basis.evidence[0],evidence_id:basis.evidence[0].evidence_id.toUpperCase()},...basis.evidence.slice(1)],
  };
  assert.equal(validProductionFirstTenAuditBasis(caseVariant),true);
  const corrupted=[
    {...basis,orders:[{...basis.orders[0],order_id:" "+basis.orders[0].order_id},...basis.orders.slice(1)]},
    {...basis,orders:[{...basis.orders[0],order_id:basis.orders[0].order_id+" "},...basis.orders.slice(1)]},
    {...basis,evidence:[{...basis.evidence[0],order_id:" "+basis.evidence[0].order_id},...basis.evidence.slice(1)]},
    {...basis,evidence:[{...basis.evidence[0],order_id:basis.evidence[0].order_id+"\n"},...basis.evidence.slice(1)]},
    {...basis,evidence:[{...basis.evidence[0],evidence_id:" "+basis.evidence[0].evidence_id},...basis.evidence.slice(1)]},
    {...basis,evidence:[{...basis.evidence[0],evidence_id:basis.evidence[0].evidence_id+" "},...basis.evidence.slice(1)]},
    {...basis,evidence:[{...basis.evidence[0],evidence_id:[basis.evidence[0].evidence_id]},...basis.evidence.slice(1)]},
    {...basis,orders:[{...basis.orders[0],order_id:"synthetic-order-1"},...basis.orders.slice(1)]},
    {...basis,evidence:[{...basis.evidence[0],order_id:"synthetic-order-1"},...basis.evidence.slice(1)]},
    {...basis,evidence:[{...basis.evidence[0],evidence_id:"synthetic-evidence-1"},...basis.evidence.slice(1)]},
  ];
  for(const altered of corrupted){
    assert.equal(validProductionFirstTenAuditBasis(altered),false,JSON.stringify(altered).slice(0,200));
    assert.throws(()=>verifiedFirstTenAuditReceipt(altered),/Malformed first-ten/);
  }
});
