import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createStockReservationAttemptTracker} from "../src/lib/designer/stock-reservation-attempt.ts";

const draft={fabricId:"linen-plain-60-sky-blue",revisionId:"LE-LOCK-20261101190000-ABABABABABAB",
  quantityMetres:2.125,requestedBy:"Verified tailor",sourceReference:"Cutting sheet 24"};
function memoryStorage(){
  const values=new Map<string,string>();
  return {
    getItem(key:string){return values.get(key)??null;},
    setItem(key:string,value:string){values.set(key,value);},
    values(){return [...values.values()];},
  };
}
function keys(){
  let n=0;
  return ()=>`00000000-0000-4000-8000-${String(++n).padStart(12,"0")}`;
}

test("reservation retry key survives uncertain acknowledgment, tab reload and confirmed ACK",async()=>{
  const store=memoryStorage(),next=keys();
  const tracker=createStockReservationAttemptTracker(next,()=>store);
  const first=await tracker.keyFor(draft);
  assert.equal(await tracker.keyFor({...draft}),first);
  const afterReload=createStockReservationAttemptTracker(next,()=>store);
  assert.equal(await afterReload.keyFor({...draft}),first);
  assert.equal(await afterReload.keyFor({...draft}),first,
    "even after an ACK a repeated physical source must not become a new reservation");
  assert.ok(!store.values().join("").includes(draft.sourceReference),
    "no cutting sheet may be stored in plaintext");
  assert.ok(!store.values().join("").includes(draft.revisionId),
    "locked customer design revision IDs remain hashed");
});

test("changed locked design, source, requested metres or checker gets a distinct durable key",async()=>{
  const store=memoryStorage(),tracker=createStockReservationAttemptTracker(keys(),()=>store);
  const first=await tracker.keyFor(draft);
  for(const changed of [
    {...draft,fabricId:"linen-plain-60-peach"},
    {...draft,revisionId:"LE-LOCK-20261101190001-ABABABABABAB"},
    {...draft,quantityMetres:2.126},
    {...draft,requestedBy:"Another tailor"},
    {...draft,sourceReference:"Cutting sheet 25"},
  ]){
    const key=await tracker.keyFor(changed);
    assert.notEqual(key,first);
    assert.equal(await createStockReservationAttemptTracker(keys(),()=>store).keyFor(changed),key);
  }
  assert.equal(await tracker.keyFor(draft),first,
    "revisiting the same source after other reservations must retain its key");
});

test("server-equivalent quantity and trimmed/capped evidence share the same reservation key",async()=>{
  const store=memoryStorage(),tracker=createStockReservationAttemptTracker(keys(),()=>store);
  const first=await tracker.keyFor({...draft,quantityMetres:1.125,
    sourceReference:" "+draft.sourceReference+" "});
  assert.equal(await tracker.keyFor({...draft,quantityMetres:1.12500000000001}),first);
  const long={...draft,revisionId:"LE-LOCK-"+ "r".repeat(300)};
  assert.equal(await tracker.keyFor(long),
    await tracker.keyFor({...long,revisionId:long.revisionId.trim().slice(0,220)}));
});

test("blocked/corrupt/full reservation retry storage prevents a privileged submission",async()=>{
  const denied=createStockReservationAttemptTracker(keys(),()=>{throw Error("SecurityError");});
  await assert.rejects(()=>denied.keyFor(draft),/No stock movement was sent/);
  const bad=memoryStorage();
  bad.setItem("linen-earth:reservation-attempts:v2","invalid json");
  await assert.rejects(
    ()=>createStockReservationAttemptTracker(keys(),()=>bad).keyFor(draft),
    /No stock movement was sent/);
  const full=memoryStorage(),tracker=createStockReservationAttemptTracker(keys(),()=>full);
  const original=await tracker.keyFor(draft);
  for(let i=1;i<64;i++)
    await tracker.keyFor({...draft,sourceReference:"Synthetic cutting sheet "+i});
  await assert.rejects(
    ()=>tracker.keyFor({...draft,sourceReference:"Synthetic cutting sheet 65"}),
    /No stock movement was sent/);
  assert.equal(await tracker.keyFor(draft),original,
    "full retry journal must never discard an existing physical reservation key");
});

test("Stock Desk persists the reservation key before network POST and never resets it at ACK",()=>{
  const src=readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
  assert.match(src,/useRef\(createStockReservationAttemptTracker\(\(\)=>crypto\.randomUUID\(\)\)\)/);
  const post=src.split("  async function post(")[1]?.split("  const totalAvailable=")[0]??"";
  const action=src.slice(src.indexOf('onClick={()=>{const draft={...reservation,quantityMetres:Number(reservation.quantityMetres)}'));
  assert.ok(post.indexOf("reservationAttempt.current.keyFor(reservationDraft)")<
    post.indexOf("uncertainJournal.current.markPending()"));
  assert.ok(post.indexOf("uncertainJournal.current.markPending()")<
    post.indexOf('fetch("/api/operator/stock"'));
  assert.ok(post.indexOf("requireStockClientAcknowledgment(body.action,data)")<
    post.indexOf("const refreshed=await load()"));
  assert.doesNotMatch(post,/reservationAttempt\.current\.confirmed\(/);
  assert.match(action,/void post\(\{action:"reserve",\.\.\.draft,\},"Provenance-backed reservation created\.",draft\)/);
  assert.doesNotMatch(src,/requestKey:crypto\.randomUUID\(\)/);
});

test("existing reserve SQL serializes an identical idempotency key",()=>{
  const sql=readFileSync("supabase/migrations/20261031_stock_reservation_concurrency_provenance.sql","utf8");
  const reserve=sql.split("create or replace function public.fabric_stock_reserve_v2(")[1]?.split("create or replace function public.fabric_stock_release_v2(")[0]??"";
  assert.match(reserve,/pg_advisory_xact_lock\(hashtext\('stock-request:'\|\|v_key\)\)/);
  assert.match(reserve,/where request_key=v_key limit 1/);
  assert.match(reserve,/if v_existing is not null then return v_existing/);
});
