import test from "node:test";
import assert from "node:assert/strict";
import {
  createOrderLifecycle, applyOrderLifecycleEvent, replayOrderLifecycle, restoreOrderLifecycleSnapshot,
  ORDER_QC_CHECKS, type OrderLifecycleAction, type OrderLifecycleState,
} from "../src/lib/operator/order-lifecycle.ts";

const id = "01234567-89ab-4cde-8f01-23456789abcd";
const revision = "rev-locked-00000001";
const hash = "a".repeat(64);
const base = () => createOrderLifecycle(id, revision, hash);
const qc = () => ({inspector:"Named Tailor", inspectionReference:"QC-REAL-RECEIPT-001",
  revisionId:revision, recipeHash:hash,
  checks:Object.fromEntries(ORDER_QC_CHECKS.map(x=>[x,true]))});
function step(state:OrderLifecycleState,action:OrderLifecycleAction,extra:Record<string,unknown>={}) {
  return applyOrderLifecycleEvent(state,{
    eventId:"event-"+String(state.sequence+1).padStart(8,"0"),orderId:id,
    action,from:state.status,sequence:state.sequence+1,previousEventId:state.lastEventId,
    occurredAt:new Date(Date.UTC(2026,10,3,0,0,state.sequence+1)).toISOString(),
    actor:"operator-001",evidenceRef:"receipt-"+String(state.sequence+1).padStart(8,"0"),
    ...extra,
  });
}
function progress(...actions:OrderLifecycleAction[]){return actions.reduce((s,a)=>step(s,a),base());}
const toQc = () => progress("accept","start_cutting","start_stitching","start_finishing","submit_qc");

test("full audited order lifecycle requires acceptance, finishing, QC, dispatch and delivery",()=>{
  const accepted=progress("accept");
  assert.equal(accepted.status,"accepted");
  const ready=step(toQc(),"approve_qc",{qc:qc()});
  const dispatched=step(ready,"dispatch");
  const delivered=step(dispatched,"deliver");
  assert.equal(delivered.status,"delivered");
  assert.equal(delivered.audit.length,8);
  assert.deepEqual(delivered.audit.map(x=>x.to),[
    "accepted","cutting","stitching","finishing","qc_pending","qc_approved","dispatched","delivered"]);
  assert.equal(replayOrderLifecycle(id,revision,hash,delivered.audit).status,"delivered");
  assert.equal(base().audit.length,0);
});

test("cannot skip acceptance, cutting, stitching, finishing, QC or dispatch",()=>{
  for(const [state,action] of [[base(),"start_cutting"],[base(),"deliver"],
    [progress("accept"),"start_stitching"],[progress("accept","start_cutting"),"submit_qc"],
    [toQc(),"dispatch"]] as const){
    assert.throws(()=>step(state,action),/Illegal order transition/);
  }
});

test("QC requires all six checks, named inspector, physical reference and exact locked lineage",()=>{
  const s=toQc();
  for(const wrong of [
    {...qc(),checks:{...qc().checks,recipe_match:false}},
    {...qc(),checks:{...qc().checks,unexpected:true}},
    {...qc(),inspector:"X"},
    {...qc(),inspectionReference:"x"},
    {...qc(),revisionId:"different-revision"},
    {...qc(),recipeHash:"b".repeat(64)},
  ]) assert.throws(()=>step(s,"approve_qc",{qc:wrong}),/QC|Invalid/);
  assert.throws(()=>step(s,"approve_qc"),/Invalid lifecycle event/);
});

test("QC rework must return through stitching, finishing and a NEW approval",()=>{
  const rejected=step(toQc(),"reject_qc",{reason:"Hem needs restitching"});
  assert.equal(rejected.status,"qc_rework");
  assert.throws(()=>step(rejected,"dispatch"),/Illegal/);
  const stitched=step(rejected,"start_rework");
  const rechecked=step(step(stitched,"start_finishing"),"submit_qc");
  assert.equal(step(rechecked,"approve_qc",{qc:qc()}).status,"qc_approved");
});

test("rework and recovery require a new physical QC inspection reference",()=>{
  const first=step(toQc(),"approve_qc",{qc:qc()});
  const held=step(first,"hold_for_recovery",{reason:"Seam defect found after first QC"});
  const resumed=step(held,"resume_recovery",{reason:"Tailor approved rework"});
  const pending=step(step(resumed,"start_finishing"),"submit_qc");
  assert.throws(()=>step(pending,"approve_qc",{qc:qc()}),
    /fresh QC inspection reference/,"an earlier QC receipt cannot approve repaired work");
  const fresh={...qc(),inspectionReference:"QC-REAL-RECEIPT-002"};
  const approved=step(pending,"approve_qc",{qc:fresh});
  assert.equal(approved.status,"qc_approved");
  assert.equal(approved.audit.filter(x=>x.action==="approve_qc").length,2);
  assert.equal(replayOrderLifecycle(id,revision,hash,approved.audit).status,"qc_approved");
  const tampered=approved.audit.map(x=>x.action==="approve_qc" && x.sequence===approved.sequence
    ? {...x,qc:qc()} : x);
  assert.throws(()=>replayOrderLifecycle(id,revision,hash,tampered),
    /fresh QC inspection reference/,"replay must also reject duplicated QC receipts");
});

test("cancellation is audited, reason-required and terminal; dispatch cannot cancel",()=>{
  for(const s of [base(),progress("accept"),toQc(),step(toQc(),"approve_qc",{qc:qc()})]){
    assert.throws(()=>step(s,"cancel"),/reason/);
    const cancelled=step(s,"cancel",{reason:"Customer explicitly withdrew before dispatch"});
    assert.equal(cancelled.status,"cancelled");
    assert.throws(()=>step(cancelled,"accept"),/Illegal/);
    assert.throws(()=>step(cancelled,"resume_recovery",{reason:"attempt"}),/Illegal/);
  }
  const shipped=step(step(toQc(),"approve_qc",{qc:qc()}),"dispatch");
  assert.throws(()=>step(shipped,"cancel",{reason:"too late"}),/Illegal/);
  assert.throws(()=>step(step(shipped,"deliver"),"cancel",{reason:"too late"}),/Illegal/);
});

test("recovery holds are audited and never restore old QC approval",()=>{
  const approved=step(toQc(),"approve_qc",{qc:qc()});
  const held=step(approved,"hold_for_recovery",{reason:"Unexpected physical recheck required"});
  assert.equal(held.status,"recovery_pending");
  assert.equal(held.heldFrom,"qc_approved");
  assert.throws(()=>step(held,"dispatch"),/Illegal/);
  assert.throws(()=>step(held,"resume_recovery"),/reason/);
  const resumed=step(held,"resume_recovery",{reason:"Rework authorized and logged"});
  assert.equal(resumed.status,"stitching");
  assert.equal(resumed.heldFrom,null);
  assert.throws(()=>step(resumed,"dispatch"),/Illegal/);
  const newQc=step(step(resumed,"start_finishing"),"submit_qc");
  assert.equal(step(newQc,"approve_qc",{
    qc:{...qc(),inspectionReference:"QC-REAL-RECEIPT-002"},
  }).status,"qc_approved");
});

test("recovery from accepted/cutting preserves stage without advancing",()=>{
  for(const s of [progress("accept"),progress("accept","start_cutting")]){
    const held=step(s,"hold_for_recovery",{reason:"Production interruption"});
    const resumed=step(held,"resume_recovery",{reason:"Operator confirmed restart"});
    assert.equal(resumed.status,s.status);
  }
  assert.throws(()=>step(base(),"hold_for_recovery",{reason:"unsupported"}),/Illegal/);
});

test("stale concurrency, replay, duplicates and wrong order identity fail closed",()=>{
  const s=progress("accept");
  const event={eventId:"event-00000002",orderId:id,action:"start_cutting",from:"accepted",
    sequence:2,previousEventId:s.lastEventId,occurredAt:"2026-11-03T00:00:02.000Z",
    actor:"operator-001",evidenceRef:"receipt-00000002"};
  assert.equal(applyOrderLifecycleEvent(s,event).status,"cutting");
  for(const bad of [
    {...event,sequence:1},{...event,sequence:3},{...event,previousEventId:null},
    {...event,orderId:"00000000-0000-4000-8000-000000000000"},
    {...event,from:"created"},{...event,eventId:s.lastEventId},
    {...event,occurredAt:"2026-11-03T00:00:01.000Z"},
    {...event,occurredAt:"not-a-date"},
  ]) assert.throws(()=>applyOrderLifecycleEvent(s,bad));
});

test("reject malformed identities, evidence, actor, event action and unrecognized QC payload",()=>{
  assert.throws(()=>createOrderLifecycle("bad",revision,hash),/order ID/);
  assert.throws(()=>createOrderLifecycle(id,"short",hash),/revision/);
  assert.throws(()=>createOrderLifecycle(id,revision,"A".repeat(64)),/recipe hash/);
  const s=base();
  for(const extra of [{actor:" "},{evidenceRef:"missing"},{action:"teleport"},
    {eventId:"short"},{qc:qc()}]) assert.throws(()=>step(s,"accept",extra));
});

test("blank-only operator, receipt, reason and QC evidence fail closed",()=>{
  const s=base();
  for(const extra of [
    {actor:"   "}, {evidenceRef:"        "},
  ]) assert.throws(()=>step(s,"accept",extra),/Invalid/);
  assert.throws(()=>step(s,"cancel",{reason:"   "}),/Invalid reason/);
  assert.throws(()=>step(toQc(),"reject_qc",{reason:"   "}),/Invalid reason/);
  for(const wrong of [
    {...qc(),inspector:"  "},
    {...qc(),inspectionReference:"   "},
  ]) assert.throws(()=>step(toQc(),"approve_qc",{qc:wrong}),/Invalid/);
  assert.equal(step(s,"accept").status,"accepted",
    "normal nonblank operator evidence remains accepted");
});

test("replay refuses altered destinations, removed history and out-of-order events",()=>{
  const delivered=step(step(toQc(),"approve_qc",{qc:qc()}),"dispatch");
  assert.throws(()=>replayOrderLifecycle(id,revision,hash,delivered.audit.slice(1)),/Stale|non-sequential/);
  assert.throws(()=>replayOrderLifecycle(id,revision,hash,[{...delivered.audit[0],to:"delivered"}]),/Tampered/);
  assert.throws(()=>replayOrderLifecycle(id,revision,hash,Array(10001).fill(null)),/oversized/);
});

test("applied audit replay requires a present exact destination on every stored event",()=>{
  const delivered=step(step(toQc(),"approve_qc",{qc:qc()}),"dispatch");
  const first=delivered.audit[0];
  const missing=Object.fromEntries(Object.entries(first).filter(([key])=>key!=="to"));
  for(const altered of [
    missing,{...first,to:undefined},{...first,to:null},{...first,to:"delivered"},
  ]){
    assert.throws(()=>replayOrderLifecycle(id,revision,hash,[altered]),/Tampered audit destination/);
  }
  assert.equal(replayOrderLifecycle(id,revision,hash,delivered.audit).status,"dispatched");
});

test("calendar-invalid ISO-shaped event dates fail closed, including offset and leap boundaries",()=>{
  for(const occurredAt of [
    "2026-02-29T00:00:00Z",
    "2026-02-30T00:00:00Z",
    "2026-04-31T12:00:00Z",
    "1900-02-29T00:00:00Z",
    "2026-11-03T24:00:00Z",
    "2026-11-03T00:60:00Z",
    "2026-11-03T00:00:60Z",
    "2026-11-03T00:00:00+14:01",
    "2026-11-03T00:00:00-23:00",
    "2026-11-03T00:00:00+01:60",
    "0000-01-01T00:00:00Z",
  ]) assert.throws(()=>step(base(),"accept",{occurredAt}),/Invalid event timestamp/,occurredAt);
  for(const occurredAt of [
    "2024-02-29T23:59:59+14:00",
    "2000-02-29T00:00:00-14:00",
    "2026-04-30T23:59:59.999Z",
    "2026-11-03T00:00:00+05:30",
  ]) assert.equal(step(base(),"accept",{occurredAt}).status,"accepted",occurredAt);
  const first=step(base(),"accept",{occurredAt:"2024-02-29T23:59:59+14:00"});
  assert.throws(()=>step(first,"start_cutting",{occurredAt:"2024-02-29T09:59:59Z"}),
    /timestamps must increase strictly/,"equivalent instant is not a later audit event");
});


test("external evidence references cannot be reused across stages or forged in audit replay",()=>{
  const accepted=progress("accept");
  assert.throws(()=>step(accepted,"start_cutting",{
    evidenceRef:accepted.audit[0].evidenceRef,
  }),/already used/,"the same external receipt must not attest two different transitions");
  const cutting=step(accepted,"start_cutting");
  const tampered=cutting.audit.map((item,index)=>index===1
    ? {...item,evidenceRef:cutting.audit[0].evidenceRef} : item);
  assert.throws(()=>replayOrderLifecycle(id,revision,hash,tampered),/already used/,
    "audit replay must reject a receipt duplicated after the fact");
});

test("accepted state, audit entries and QC checks are frozen at runtime",()=>{
  const approved=step(toQc(),"approve_qc",{qc:qc()});
  const last=approved.audit[approved.audit.length-1];
  const checks=last.qc?.checks;
  assert.ok(checks);
  for(const value of [approved,approved.audit,last,last.qc,checks])
    assert.equal(Object.isFrozen(value),true,"accepted audit data must be immutable");
  assert.throws(()=>Object.assign(approved,{status:"delivered"}),TypeError);
  assert.throws(()=>Object.assign(approved.audit,{0:null}),TypeError);
  assert.throws(()=>Object.assign(last,{actor:"forged-operator"}),TypeError);
  assert.throws(()=>Object.assign(checks,{recipe_match:false}),TypeError);
  assert.equal(replayOrderLifecycle(id,revision,hash,approved.audit).status,"qc_approved");
});


test("serialized order snapshots must replay exactly before reuse",()=>{
  const approved=step(toQc(),"approve_qc",{qc:qc()});
  const saved=JSON.parse(JSON.stringify(approved));
  const restored=restoreOrderLifecycleSnapshot(saved);
  assert.deepEqual(restored,approved);
  assert.notEqual(restored,saved,"rehydration must not trust a mutable input object");
  assert.equal(Object.isFrozen(restored.audit),true);
  assert.equal(Object.isFrozen(restored.audit.at(-1)?.qc?.checks),true);
  assert.equal(step(restored,"dispatch").status,"dispatched");

  const held=step(approved,"hold_for_recovery",{reason:"New seam defect requires recovery"});
  const heldSnapshot=JSON.parse(JSON.stringify(held));
  assert.deepEqual(restoreOrderLifecycleSnapshot(heldSnapshot),held);
  for(const corrupted of [
    {...saved,status:"delivered"},
    {...saved,sequence:0},
    {...saved,lastEventId:"event-99999999"},
    {...saved,heldFrom:"stitching"},
    {...saved,audit:saved.audit.slice(0,-1)},
    {...saved,audit:[...saved.audit.slice(0,-1),{...saved.audit.at(-1),to:"delivered"}]},
    {...saved,orderId:"123e4567-e89b-12d3-a456-426614174000"},
    {...saved,revisionId:"rev-locked-00000002"},
    {...saved,recipeHash:"b".repeat(64)},
    {...saved,audit:null},
    {...heldSnapshot,heldFrom:"cutting"},
  ]) assert.throws(()=>restoreOrderLifecycleSnapshot(corrupted),
    /snapshot|audit|identity|revision|recipe|destination|Invalid|Stale|non-sequential/);
});

test("untrusted lifecycle objects cannot bypass QC, recovery or audit rehydration",()=>{
  const created=base();
  // This fabricated state used to allow a direct dispatch without any QC
  // event: its structural TypeScript shape was trusted by the reducer.
  const forgedApproved={...created,status:"qc_approved" as const};
  assert.throws(()=>step(forgedApproved,"dispatch"),
    /Untrusted lifecycle snapshot/, "a forged approved stage cannot dispatch");
  const forgedHeld={...created,status:"recovery_pending" as const,heldFrom:"accepted" as const};
  assert.throws(()=>step(forgedHeld,"resume_recovery",{reason:"Fake recovery"}),
    /Untrusted lifecycle snapshot/, "a fabricated recovery pointer cannot resume");
  const realApproved=step(toQc(),"approve_qc",{qc:qc()});
  const jsonClone=JSON.parse(JSON.stringify(realApproved)) as OrderLifecycleState;
  assert.throws(()=>step(jsonClone,"dispatch"),/Untrusted lifecycle snapshot/,
    "serialized data must be replayed before authorizing a transition");
  const prototypeClone=Object.create(realApproved) as OrderLifecycleState;
  assert.throws(()=>step(prototypeClone,"dispatch"),/Untrusted lifecycle snapshot/,
    "inherited state fields cannot borrow the trusted object's identity");
  const restored=restoreOrderLifecycleSnapshot(jsonClone);
  assert.equal(step(restored,"dispatch").status,"dispatched",
    "canonical audit replay restores trusted transition eligibility");
  assert.equal(step(realApproved,"dispatch").status,"dispatched",
    "original reducer-minted state remains usable");
});
