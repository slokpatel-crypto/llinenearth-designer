import test from "node:test";
import assert from "node:assert/strict";
import { normalizeManualStockEvent, normalizeStockConsumption, normalizeStockRelease, normalizeStockReservation, stockSnapshot } from "../src/lib/designer/stock-ledger.ts";

test("reservation reduces available stock without changing physical stock",()=>{
  assert.deepEqual(stockSnapshot([
    {type:"receipt",quantityMetres:10},
    {type:"reserve",quantityMetres:2},
  ]),{physicalMetres:10,reservedMetres:2,availableMetres:8});
});

test("consuming a fully reserved quantity reduces physical and reserved equally",()=>{
  assert.deepEqual(stockSnapshot([
    {type:"receipt",quantityMetres:10},
    {type:"reserve",quantityMetres:2},
    {type:"consume",quantityMetres:2},
  ]),{physicalMetres:8,reservedMetres:0,availableMetres:8});
});

test("partial consumption plus release restores unused reserved metres",()=>{
  assert.deepEqual(stockSnapshot([
    {type:"receipt",quantityMetres:10},
    {type:"reserve",quantityMetres:3},
    {type:"consume",quantityMetres:2},
    {type:"release",quantityMetres:1},
  ]),{physicalMetres:8,reservedMetres:0,availableMetres:8});
});


test("manual physical stock evidence requires named provenance",()=>{
  assert.throws(()=>normalizeManualStockEvent({
    fabricId:"shirt-1",eventType:"receipt",quantityMetres:12,recordedBy:"",sourceReference:"roll-count-1",
  }),/Named stock checker/i);
  assert.throws(()=>normalizeManualStockEvent({
    fabricId:"shirt-1",eventType:"receipt",quantityMetres:12,recordedBy:"SP",sourceReference:"",
  }),/source reference/i);
  assert.deepEqual(normalizeManualStockEvent({
    fabricId:"shirt-1",eventType:"receipt",quantityMetres:12.34567,recordedBy:" SP ",sourceReference:" Roll tag LE-42 ",
  }),{
    fabricId:"shirt-1",eventType:"receipt",quantityMetres:12.346,note:"",recordedBy:"SP",sourceReference:"Roll tag LE-42",
  });
});


test("stock reservation quantity requires a named source of truth",()=>{
  assert.throws(()=>normalizeStockReservation({
    fabricId:"shirt-1",revisionId:"LE-LOCK-123456",requestKey:"REQUEST-123456",
    quantityMetres:2.1,requestedBy:"SP",sourceReference:"",
  }),/quantity evidence reference/i);
  const result=normalizeStockReservation({
    fabricId:"shirt-1",revisionId:"LE-LOCK-123456",requestKey:"REQUEST-123456",
    quantityMetres:2.1237,requestedBy:" RJ ",sourceReference:" Approved meterage sheet M-19 ",
  });
  assert.equal(result.quantityMetres,2.124);
  assert.equal(result.requestedBy,"RJ");
  assert.equal(result.sourceReference,"Approved meterage sheet M-19");
});


test("stock consumption requires measured usage provenance",()=>{
  assert.throws(()=>normalizeStockConsumption({
    reservationId:"11111111-1111-4111-8111-111111111111",actualMetres:1.82,checkedBy:"SP",sourceReference:"",
  }),/cloth-usage evidence reference/i);
  const result=normalizeStockConsumption({
    reservationId:"11111111-1111-4111-8111-111111111111",actualMetres:1.8237,
    checkedBy:" RJ ",sourceReference:" Cutting sheet CUT-42 ",note:" Actual cut usage. ",
  });
  assert.equal(result.actualMetres,1.824);
  assert.equal(result.checkedBy,"RJ");
  assert.equal(result.sourceReference,"Cutting sheet CUT-42");
});


test("stock release requires a named operational reason source",()=>{
  assert.throws(()=>normalizeStockRelease({
    reservationId:"11111111-1111-4111-8111-111111111111",releasedBy:"SP",sourceReference:"",
  }),/release reference/i);
  const result=normalizeStockRelease({
    reservationId:"11111111-1111-4111-8111-111111111111",
    releasedBy:" SP ",sourceReference:" Order cancellation ORD-42 ",note:" Customer cancelled before cutting. ",
  });
  assert.equal(result.releasedBy,"SP");
  assert.equal(result.sourceReference,"Order cancellation ORD-42");
});


test("physical stock replay fails closed on overselling, overrelease and consumption without reservations",()=>{
  const receipt={type:"receipt",quantityMetres:5} as const;
  for(const events of [
    [receipt,{type:"reserve",quantityMetres:6} as const],
    [receipt,{type:"adjustment_out",quantityMetres:5.001} as const],
    [receipt,{type:"release",quantityMetres:1} as const],
    [receipt,{type:"consume",quantityMetres:1} as const],
    [receipt,{type:"reserve",quantityMetres:4} as const,{type:"adjustment_out",quantityMetres:2} as const],
    [receipt,{type:"reserve",quantityMetres:1} as const,{type:"consume",quantityMetres:2} as const],
    [receipt,{type:"reserve",quantityMetres:1} as const,{type:"release",quantityMetres:2} as const],
  ])assert.throws(()=>stockSnapshot(events),/exceed|reserved|unavailable/i);
});
test("ledger handles 0.001m precision, decimal float representations, and retains no negative stock",()=>{
  const sample=stockSnapshot([
    {type:"receipt",quantityMetres:1.005},
    {type:"reserve",quantityMetres:.251},
    {type:"consume",quantityMetres:.101},
    {type:"release",quantityMetres:.15},
    {type:"adjustment_out",quantityMetres:.004},
  ]);
  assert.deepEqual(sample,{physicalMetres:.9,reservedMetres:0,availableMetres:.9});
  assert.throws(()=>stockSnapshot([{type:"receipt",quantityMetres:0.0001}]),/decimal places/);
  assert.throws(()=>stockSnapshot([{type:"receipt",quantityMetres:-3}]),/positive/);
  assert.throws(()=>stockSnapshot([{type:"unknown" as never,quantityMetres:4}]),/Unsupported stock/);
});
