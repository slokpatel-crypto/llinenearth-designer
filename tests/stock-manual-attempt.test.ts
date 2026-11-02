import test from "node:test";
import assert from "node:assert/strict";
import {createStockManualAttemptTracker} from "../src/lib/designer/stock-manual-attempt.ts";
const record={fabricId:"linen-a",eventType:"receipt",quantityMetres:3.125,
  note:"roll counted",recordedBy:"checker",sourceReference:"ROLL-0001"};
function memoryStorage(){
  const memory=new Map<string,string>();
  return {
    getItem(key:string){return memory.get(key)??null;},
    setItem(key:string,value:string){memory.set(key,value);},
    values(){return [...memory.values()];},
  };
}
function keys(){
  let count=0;
  return ()=>`00000000-0000-4000-8000-${String(++count).padStart(12,"0")}`;
}
test("manual movement replays original key across tab reload and confirmed ACK",async()=>{
  const store=memoryStorage(),next=keys();
  const firstTracker=createStockManualAttemptTracker(next,()=>store);
  const first=await firstTracker.keyFor(record);
  const reload=createStockManualAttemptTracker(next,()=>store);
  assert.equal(await reload.keyFor({...record}),first);
  assert.equal(await reload.keyFor({...record,note:" roll   counted "}),first);
  assert.ok(!store.values().join("").includes("ROLL-0001"),
    "physical source evidence must never be persisted as plaintext");
});
test("multiple changed physical movements retain separate keys, including return to an old roll",async()=>{
  const store=memoryStorage(),tracker=createStockManualAttemptTracker(keys(),()=>store);
  const first=await tracker.keyFor(record);
  for(const change of [{sourceReference:"ROLL-0002"},{quantityMetres:4.125},
    {eventType:"adjustment_out"},{recordedBy:"second checker"},
    {note:"new evidence"},{fabricId:"linen-b"}]){
    const changed=await tracker.keyFor({...record,...change});
    assert.notEqual(changed,first);
    assert.equal(await tracker.keyFor({...record,...change}),changed);
  }
  assert.equal(await createStockManualAttemptTracker(keys(),()=>store).keyFor(record),first);
});
test("session storage blocked or corrupted fails closed before any stock RPC",async()=>{
  const unavailable=createStockManualAttemptTracker(keys(),()=>{
    throw new Error("SecurityError");
  });
  await assert.rejects(()=>unavailable.keyFor(record),/No stock movement was sent/);
  const corrupted=memoryStorage();
  corrupted.setItem("linen-earth:manual-stock-attempts:v1","{bad json");
  await assert.rejects(
    ()=>createStockManualAttemptTracker(keys(),()=>corrupted).keyFor(record),
    /No stock movement was sent/
  );
  const readonly={
    getItem(){return null;},
    setItem(){throw new Error("QuotaExceededError");},
  };
  await assert.rejects(
    ()=>createStockManualAttemptTracker(keys(),()=>readonly).keyFor(record),
    /No stock movement was sent/
  );
});

test("server-equivalent trimmed and capped stock evidence MUST keep the original key",async()=>{
  const store=memoryStorage(),tracker=createStockManualAttemptTracker(keys(),()=>store);
  const long={
    ...record,
    fabricId:" F".padEnd(190,"x"),
    note:" ".repeat(3)+"n".repeat(610),
    recordedBy:" C".padEnd(145,"h"),
    sourceReference:" R".padEnd(267,"s"),
  };
  const first=await tracker.keyFor(long);
  assert.equal(await tracker.keyFor({...long,fabricId:long.fabricId.trim().slice(0,160)}),first);
  assert.equal(await tracker.keyFor({...long,note:long.note.replace(/\s+/g," ").trim().slice(0,600)}),first);
  assert.equal(await tracker.keyFor({...long,recordedBy:long.recordedBy.replace(/\s+/g," ").trim().slice(0,120)}),first);
  assert.equal(await tracker.keyFor({...long,sourceReference:long.sourceReference.replace(/\s+/g," ").trim().slice(0,240)}),first);
  assert.equal(await createStockManualAttemptTracker(keys(),()=>store).keyFor(long),first);
});
test("changes inside SQL evidence field bounds continue to get distinct keys",async()=>{
  const store=memoryStorage(),tracker=createStockManualAttemptTracker(keys(),()=>store);
  const id=await tracker.keyFor(record);
  assert.notEqual(await tracker.keyFor({...record,sourceReference:"ROLL-0002"}),id);
  assert.notEqual(await tracker.keyFor({...record,recordedBy:"other"}),id);
});

test("at journal capacity, old physical receipts stay protected and new writes fail closed",async()=>{
  const store=memoryStorage(),tracker=createStockManualAttemptTracker(keys(),()=>store);
  const first=await tracker.keyFor(record);
  for(let i=1;i<64;i++)
    await tracker.keyFor({...record,sourceReference:"ROLL-"+String(i).padStart(4,"0")});
  assert.equal(await tracker.keyFor(record),first);
  const before=store.values().join("");
  await assert.rejects(
    ()=>tracker.keyFor({...record,sourceReference:"ROLL-0064"}),
    /No stock movement was sent/
  );
  assert.equal(store.values().join(""),before,"full journal must not discard original key");
  assert.equal(await createStockManualAttemptTracker(keys(),()=>store).keyFor(record),first);
});
