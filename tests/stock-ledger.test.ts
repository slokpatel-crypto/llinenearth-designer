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
    fabricId:"shirt-1",eventType:"receipt",quantityMetres:12.345,recordedBy:" SP ",sourceReference:" Roll tag LE-42 ",
  }),{
    fabricId:"shirt-1",eventType:"receipt",quantityMetres:12.345,note:"",recordedBy:"SP",sourceReference:"Roll tag LE-42",
  });
});


test("stock reservation quantity requires a named source of truth",()=>{
  assert.throws(()=>normalizeStockReservation({
    fabricId:"shirt-1",revisionId:"LE-LOCK-123456",requestKey:"REQUEST-123456",
    quantityMetres:2.1,requestedBy:"SP",sourceReference:"",
  }),/quantity evidence reference/i);
  const result=normalizeStockReservation({
    fabricId:"shirt-1",revisionId:"LE-LOCK-123456",requestKey:"REQUEST-123456",
    quantityMetres:2.124,requestedBy:" RJ ",sourceReference:" Approved meterage sheet M-19 ",
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
    reservationId:"11111111-1111-4111-8111-111111111111",actualMetres:1.824,
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


test("manual, reservation and consumption movements must not round to phantom zero-metres",()=>{
  for(const q of [0.00001,0.0001,0.00049]){
    assert.throws(()=>normalizeManualStockEvent({
      fabricId:"shirt-1",eventType:"receipt",quantityMetres:q,
      recordedBy:"Checker",sourceReference:"Roll LE-001",
    }),/at least 0.001 metres/);
    assert.throws(()=>normalizeStockReservation({
      fabricId:"shirt-1",revisionId:"LOCKED-20261010",requestKey:"RESERVE-20261010",
      quantityMetres:q,requestedBy:"Checker",sourceReference:"Meterage LE-001",
    }),/at least 0.001 metres/);
    assert.throws(()=>normalizeStockConsumption({
      reservationId:"11111111-1111-4111-8111-111111111111",
      actualMetres:q,checkedBy:"Checker",sourceReference:"Cutting LE-001",
    }),/at least 0.001 metres/);
  }
});

test("stock ledger rejects malformed events, coerced quantities and unsafe millimetre totals",()=>{
  assert.throws(()=>stockSnapshot(null as never),/must be an array/);
  assert.throws(()=>stockSnapshot([null as never]),/Invalid stock event/);
  for(const quantity of ["2",true,undefined,Number.MAX_SAFE_INTEGER]){
    assert.throws(()=>stockSnapshot([{type:"receipt",quantityMetres:quantity as number}]),/positive|precision/);
  }
  const nearSafe=Number.MAX_SAFE_INTEGER/1000;
  assert.throws(()=>stockSnapshot([
    {type:"receipt",quantityMetres:Math.floor(nearSafe*1000)/1000},
    {type:"receipt",quantityMetres:1},
  ]),/precision/);
});

test("operator writes never silently round stock receipts, reservations or cutting usage",()=>{
  const base={
    fabricId:"shirt-1",eventType:"receipt",recordedBy:"Physical stock checker",
    revisionId:"LOCKED-20261011",requestKey:"RESERVE-20261011",
    requestedBy:"Tailor reviewer",reservationId:"11111111-1111-4111-8111-111111111111",
    checkedBy:"Cutting checker",sourceReference:"Physical roll ledger LE-111",
  };
  for(const quantity of [0.00051,0.00099,1.2345,2.0000001,1.123456789,"2.125",null,true,Infinity]){
    assert.throws(()=>normalizeManualStockEvent({...base,quantityMetres:quantity}),
      /at least 0.001|decimal places/i,`receipt: ${String(quantity)}`);
    assert.throws(()=>normalizeStockReservation({...base,quantityMetres:quantity}),
      /at least 0.001|decimal places/i,`reservation: ${String(quantity)}`);
    assert.throws(()=>normalizeStockConsumption({...base,actualMetres:quantity}),
      /at least 0.001|decimal places/i,`consumption: ${String(quantity)}`);
  }
  const q=0.001;
  assert.equal(normalizeManualStockEvent({...base,quantityMetres:q}).quantityMetres,q);
  assert.equal(normalizeStockReservation({...base,quantityMetres:q}).quantityMetres,q);
  assert.equal(normalizeStockConsumption({...base,actualMetres:q}).actualMetres,q);
});

test("stock evidence identity fields reject aliases rather than truncating live IDs",()=>{
  const base={
    fabricId:"formal-shirt-01",
    eventType:"receipt",
    revisionId:"LE-LOCK-123456",
    requestKey:"REQUEST-123456",
    quantityMetres:2.345,
    recordedBy:"Stock verifier",
    requestedBy:"Tailor verifier",
    sourceReference:"Actual roll worksheet LE-42",
  };
  // These share valid prefixes with real ids, but must never resolve to
  // the same physical fabric, design revision or idempotency key.
  for(const fabricId of ["x".repeat(160)+"different",42,{},null]){
    assert.throws(()=>normalizeManualStockEvent({...base,fabricId}),/Fabric ID/i);
    assert.throws(()=>normalizeStockReservation({...base,fabricId}),/Fabric ID/i);
  }
  for(const revisionId of ["r".repeat(220)+"other",true,{}]){
    assert.throws(()=>normalizeStockReservation({...base,revisionId}),/Locked revision ID/i);
  }
  for(const requestKey of ["k".repeat(180)+"second-transaction",false,{}]){
    assert.throws(()=>normalizeStockReservation({...base,requestKey}),/Reservation request key/i);
  }
  assert.equal(normalizeStockReservation({...base,requestKey:" REQUEST-123456 "}).requestKey,"REQUEST-123456");
});

test("physical stock provenance cannot silently lose an overlong source reference",()=>{
  const base={
    fabricId:"formal-shirt-01",eventType:"receipt",
    revisionId:"LE-LOCK-123456",requestKey:"REQUEST-123456",
    reservationId:"11111111-1111-4111-8111-111111111111",
    quantityMetres:2,actualMetres:1,
    recordedBy:"Stock checker",requestedBy:"Tailor checker",
    checkedBy:"Cutting checker",releasedBy:"Release checker",
    sourceReference:"a".repeat(240)+"other-document",
  };
  assert.throws(()=>normalizeManualStockEvent(base),/source reference exceeds 240/);
  assert.throws(()=>normalizeStockReservation(base),/evidence reference exceeds 240/);
  assert.throws(()=>normalizeStockConsumption(base),/evidence reference exceeds 240/);
  assert.throws(()=>normalizeStockRelease(base),/release reference exceeds 240/);
  assert.throws(()=>normalizeManualStockEvent({...base,recordedBy:"x".repeat(121),sourceReference:"roll LE-1"}),/checker.*exceeds 120/i);
  assert.throws(()=>normalizeStockReservation({...base,requestedBy:"x".repeat(121),sourceReference:"roll LE-1"}),/requester.*exceeds 120/i);
});

test("only canonical UUID structure can address stock consumption or release",()=>{
  const base={
    actualMetres:1,checkedBy:"Checker",releasedBy:"Checker",
    sourceReference:"Cutting reference LE-42",
  };
  for(const reservationId of ["-".repeat(36),"a".repeat(36),"11111111--11-4111-8111-111111111111"]){
    assert.throws(()=>normalizeStockConsumption({...base,reservationId}),/Valid reservation ID/);
    assert.throws(()=>normalizeStockRelease({...base,reservationId}),/Valid reservation ID/);
  }
});

test("stock event types and reservation UUIDs cannot be laundered through String(array)",()=>{
  const base={
    fabricId:"formal-shirt-01",eventType:"receipt",quantityMetres:2,
    recordedBy:"Stock checker",sourceReference:"Roll tag LE-042",
  };
  assert.equal(normalizeManualStockEvent(base).eventType,"receipt");
  for(const eventType of [["receipt"],{"0":"receipt"},true,1])
    assert.throws(()=>normalizeManualStockEvent({...base,eventType}),/Unsupported manual stock event/);
  const uuid="11111111-1111-4111-8111-111111111111";
  const close={reservationId:uuid,actualMetres:1,checkedBy:"Checker",releasedBy:"Checker",sourceReference:"Cutting LE-42"};
  assert.equal(normalizeStockRelease(close).reservationId,uuid);
  assert.equal(normalizeStockConsumption(close).reservationId,uuid);
  for(const reservationId of [[uuid],{toString:uuid},true,1]){
    assert.throws(()=>normalizeStockRelease({...close,reservationId}),/Valid reservation ID/);
    assert.throws(()=>normalizeStockConsumption({...close,reservationId}),/Valid reservation ID/);
  }
});

test("human stock audit notes must not be coerced or silently truncated",()=>{
  const base={
    fabricId:"formal-shirt-01",eventType:"receipt",quantityMetres:2.125,
    recordedBy:"Stock checker",sourceReference:"Physical roll LE-42",
    reservationId:"11111111-1111-4111-8111-111111111111",
    actualMetres:1.25,checkedBy:"Cutting checker",releasedBy:"Release checker",
  };
  const normalize=[
    normalizeManualStockEvent,
    normalizeStockConsumption,
    normalizeStockRelease,
  ];
  for(const fn of normalize){
    for(const note of [["claimed human note"],{message:"claimed human note"},42,true]){
      assert.throws(()=>fn({...base,note}),/Stock note must be text/i);
    }
    assert.throws(()=>fn({...base,note:"x".repeat(600)+"missing-end"}),/Stock note exceeds 600/i);
    assert.equal(fn({...base,note:"x".repeat(600)}).note.length,600);
    assert.equal(fn({...base,note:"  Checked  against   roll  "}).note,"Checked against roll");
    assert.equal(fn({...base}).note,"");
    assert.equal(fn({...base,note:null}).note,"");
  }
});


test("physical fabric IDs and reservation UUIDs cannot be silently trimmed into another stock identity",()=>{
  const base={
    fabricId:"formal-shirt-01",eventType:"receipt",quantityMetres:2.125,
    recordedBy:"Stock checker",requestedBy:"Tailor checker",
    sourceReference:"Physical roll LE-42",
    revisionId:"LE-LOCK-123456",requestKey:"REQUEST-123456",
    reservationId:"11111111-1111-4111-8111-111111111111",
    actualMetres:1.25,checkedBy:"Cutting checker",releasedBy:"Release checker",
  };
  for(const fabricId of [" formal-shirt-01","formal-shirt-01 ","\nformal-shirt-01","\tformal-shirt-01"]){
    assert.throws(()=>normalizeManualStockEvent({...base,fabricId}),/Fabric ID must match/);
    assert.throws(()=>normalizeStockReservation({...base,fabricId}),/Fabric ID must match/);
  }
  assert.equal(normalizeManualStockEvent(base).fabricId,base.fabricId);
  assert.equal(normalizeStockReservation(base).fabricId,base.fabricId);
  for(const reservationId of [" "+base.reservationId,base.reservationId+" ","\n"+base.reservationId]){
    assert.throws(()=>normalizeStockConsumption({...base,reservationId}),/Valid reservation ID/);
    assert.throws(()=>normalizeStockRelease({...base,reservationId}),/Valid reservation ID/);
  }
  assert.equal(normalizeStockConsumption(base).reservationId,base.reservationId);
  assert.equal(normalizeStockRelease(base).reservationId,base.reservationId);
});
