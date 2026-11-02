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


test("stock release and consumption require canonical valid reservation UUIDs",()=>{
  for(const reservationId of [
    "a".repeat(36),
    "111111111111-4111-8111-111111111111",
    "11111111-1111-0111-8111-111111111111",
    "11111111-1111-4111-7111-111111111111",
    "11111111-1111-4111-8111-11111111111z",
    "11111111-1111-4111-8111-111111111111X",
    "not-a-uuid",
  ]){
    assert.throws(()=>normalizeStockRelease({
      reservationId,releasedBy:"Operator",sourceReference:"Cancellation LE-11",
    }),/Valid reservation ID/,reservationId);
    assert.throws(()=>normalizeStockConsumption({
      reservationId,actualMetres:1.125,checkedBy:"Tailor",sourceReference:"Cut LE-11",
    }),/Valid reservation ID/,reservationId);
  }
  const reservationId="B287E470-0E90-4FD4-B5FB-976EECEBD244";
  assert.equal(normalizeStockRelease({
    reservationId,releasedBy:"Operator",sourceReference:"Cancellation LE-11",
  }).reservationId,reservationId,"existing upper-case UUIDs remain compatible");
  assert.equal(normalizeStockConsumption({
    reservationId,actualMetres:1.125,checkedBy:"Tailor",sourceReference:"Cut LE-11",
  }).reservationId,reservationId);
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


test("stock closure IDs must be literal strings, not coercible arrays or objects",()=>{
  const valid="B287E470-0E90-4FD4-B5FB-976EECEBD244";
  const base={reservationId:valid,actualMetres:1.125,checkedBy:"Cutting checker",
    releasedBy:"Stock checker",sourceReference:"Signed cut/return sheet LE-2026-11"};
  for(const reservationId of [[valid],{0:valid,length:1},{value:valid},null,42,true]){
    assert.throws(()=>normalizeStockConsumption({...base,reservationId}),
      /Valid reservation ID/,String(reservationId));
    assert.throws(()=>normalizeStockRelease({...base,reservationId}),
      /Valid reservation ID/,String(reservationId));
  }
  assert.equal(normalizeStockConsumption(base).reservationId,valid);
  assert.equal(normalizeStockRelease(base).reservationId,valid);
});


test("privileged stock record and reservation identities require literal JSON strings",()=>{
  const record={fabricId:"shirt-1",eventType:"receipt",quantityMetres:2.125,
    recordedBy:"Physical checker",sourceReference:"Signed roll LE-001"};
  const reserve={fabricId:"shirt-1",revisionId:"LE-LOCK-20261102",
    requestKey:"LE-REQUEST-20261102",quantityMetres:1.125,
    requestedBy:"Cutting checker",sourceReference:"Approved sheet LE-002"};
  for(const fabricId of [["shirt-1"],{0:"shirt-1",length:1},null,42]){
    assert.throws(()=>normalizeManualStockEvent({...record,fabricId}),/Fabric ID is required/);
    assert.throws(()=>normalizeStockReservation({...reserve,fabricId}),/Fabric ID is required/);
  }
  for(const eventType of [["receipt"],{0:"receipt",length:1},null]){
    assert.throws(()=>normalizeManualStockEvent({...record,eventType}),/Unsupported manual stock event/);
  }
  for(const revisionId of [[reserve.revisionId],{0:reserve.revisionId,length:1},null]){
    assert.throws(()=>normalizeStockReservation({...reserve,revisionId}),/Locked revision ID is required/);
  }
  for(const requestKey of [[reserve.requestKey],{0:reserve.requestKey,length:1},null]){
    assert.throws(()=>normalizeStockReservation({...reserve,requestKey}),/Reservation request key is required/);
  }
  assert.equal(normalizeManualStockEvent(record).fabricId,"shirt-1");
  assert.equal(normalizeStockReservation(reserve).revisionId,reserve.revisionId);
  assert.equal(normalizeStockReservation(reserve).requestKey,reserve.requestKey);
});


test("all privileged stock operations require literal checker names and physical source references",()=>{
  const reservationId="11111111-1111-4111-8111-111111111111";
  const fixtures=[
    {run:normalizeManualStockEvent,base:{fabricId:"shirt-1",eventType:"receipt",
      quantityMetres:2.125,recordedBy:"Physical checker",sourceReference:"Signed roll-1"},
      actor:"recordedBy",actorError:"Named stock checker / recorder is required.",
      sourceError:"Physical stock source reference is required."},
    {run:normalizeStockReservation,base:{fabricId:"shirt-1",
      revisionId:"LE-LOCK-20261102",requestKey:"LE-REQUEST-20261102",
      quantityMetres:1.125,requestedBy:"Cutting checker",sourceReference:"Approved sheet-2"},
      actor:"requestedBy",actorError:"Named reservation checker / requester is required.",
      sourceError:"Reservation quantity evidence reference is required."},
    {run:normalizeStockRelease,base:{reservationId,releasedBy:"Physical checker",
      sourceReference:"Signed release-3"},
      actor:"releasedBy",actorError:"Named reservation release checker is required.",
      sourceError:"Reservation release reference is required."},
    {run:normalizeStockConsumption,base:{reservationId,actualMetres:1.125,
      checkedBy:"Cutting checker",sourceReference:"Signed cut sheet-4"},
      actor:"checkedBy",actorError:"Named consumption checker is required.",
      sourceError:"Actual cloth-usage evidence reference is required."},
  ];
  for(const {run,base,actor,actorError,sourceError} of fixtures){
    for(const field of [actor,"sourceReference"]){
      for(const invalid of [["Forged name"],{value:"Forged name"},null,42,true]){
        assert.throws(()=>run({...base,[field]:invalid}),{
          message:field==="sourceReference"?sourceError:actorError,
        },`Reject coerced ${actor==="recordedBy"?"record":actor} ${field}: ${String(invalid)}`);
      }
    }
    assert.equal(typeof run(base).sourceReference,"string");
  }
});


test("physical stock evidence never silently truncates a checker or signed source",()=>{
  const reservationId="11111111-1111-4111-8111-111111111111";
  const cases=[
    {run:normalizeManualStockEvent,base:{fabricId:"shirt-1",eventType:"receipt",
      quantityMetres:1.125,recordedBy:"Operator",sourceReference:"Signed roll"},
      actor:"recordedBy",actorError:/Named stock checker/,refError:/Physical stock source/},
    {run:normalizeStockReservation,base:{fabricId:"shirt-1",
      revisionId:"LE-LOCK-20261102",requestKey:"LE-REQUEST-20261102",
      quantityMetres:1.125,requestedBy:"Operator",sourceReference:"Signed sheet"},
      actor:"requestedBy",actorError:/Named reservation checker/,refError:/quantity evidence reference/},
    {run:normalizeStockRelease,base:{reservationId,releasedBy:"Operator",
      sourceReference:"Signed release"},actor:"releasedBy",
      actorError:/Named reservation release checker/,refError:/Reservation release reference/},
    {run:normalizeStockConsumption,base:{reservationId,actualMetres:1.125,
      checkedBy:"Operator",sourceReference:"Signed cutting"},
      actor:"checkedBy",actorError:/Named consumption checker/,refError:/cloth-usage evidence reference/},
  ];
  for(const {run,base,actor,actorError,refError} of cases){
    assert.throws(()=>run({...base,[actor]:"A".repeat(121)}),actorError);
    assert.throws(()=>run({...base,sourceReference:"R".repeat(241)}),refError);
    assert.throws(()=>run({...base,[actor]:"  "+"A".repeat(121)+"  "}),actorError);
    assert.throws(()=>run({...base,sourceReference:"  "+"R".repeat(241)+"  "}),refError);
    const accepted=run({...base,[actor]:"A".repeat(120),
      sourceReference:"R".repeat(240)});
    assert.equal(accepted[actor as keyof typeof accepted],"A".repeat(120));
    assert.equal(accepted.sourceReference,"R".repeat(240));
    const normalized=run({...base,[actor]:"  A  B  ",
      sourceReference:"  R  1  "});
    assert.equal(normalized[actor as keyof typeof normalized],"A B");
    assert.equal(normalized.sourceReference,"R 1");
  }
});
