import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createStockReservationAttemptTracker} from "../src/lib/designer/stock-reservation-attempt.ts";

const draft={fabricId:"linen-plain-60-sky-blue",revisionId:"LE-LOCK-20261101190000-ABABABABABAB",
  quantityMetres:2.125,requestedBy:"Verified tailor",sourceReference:"Cutting sheet 24"};

test("reservation retries of exactly the same draft reuse the original SQL idempotency key",()=>{
  let n=0;
  const tracker=createStockReservationAttemptTracker(()=>`synthetic-attempt-${++n}`);
  const first=tracker.keyFor(draft);
  assert.equal(tracker.keyFor({...draft}),first);
  assert.equal(n,1);
  // HTTP 500, network timeout or invalid ACK must NOT call confirmed().
  assert.equal(tracker.keyFor(draft),first);
  tracker.confirmed({...draft,quantityMetres:3});
  assert.equal(tracker.keyFor(draft),first,"confirming a different request must not clear pending key");
  tracker.confirmed(draft);
  assert.notEqual(tracker.keyFor(draft),first,"acknowledged new reservation is a new intent");
  assert.equal(n,2);
});

test("changed fabric, revision, metres, checker or source NEVER shares an old reservation key",()=>{
  let n=0;
  const tracker=createStockReservationAttemptTracker(()=>`request-${++n}`);
  let previous=tracker.keyFor(draft);
  for(const next of [
    {...draft,fabricId:"linen-plain-60-peach"},
    {...draft,revisionId:"LE-LOCK-20261101190001-ABABABABABAB"},
    {...draft,quantityMetres:2.126},
    {...draft,requestedBy:"Another tailor"},
    {...draft,sourceReference:"New cutting sheet"},
  ]){
    const key=tracker.keyFor(next);
    assert.notEqual(key,previous);
    assert.equal(tracker.keyFor({...next}),key);
    previous=key;
  }
  assert.equal(n,6);
  assert.notEqual(tracker.keyFor(draft),previous);
});

test("Stock Desk uses deterministic logical retry key and clears it only after valid success ACK",()=>{
  const src=readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
  assert.match(src,/useRef\(createStockReservationAttemptTracker\(\(\)=>crypto\.randomUUID\(\)\)\)/);
  const post=src.split("  async function post(")[1]?.split("  const totalAvailable=")[0]??"";
  const action=src.slice(src.indexOf('onClick={()=>{const draft={...reservation,quantityMetres:Number(reservation.quantityMetres)}'));
  assert.ok(post.indexOf("requireStockClientAcknowledgment(body.action,data)")<
    post.indexOf('reservationAttempt.current.confirmed(reservationDraft)'));
  assert.ok(post.indexOf('reservationAttempt.current.confirmed(reservationDraft)')<
    post.indexOf("setMessage(success)"));
  assert.match(action,/requestKey:reservationAttempt\.current\.keyFor\(draft\)/);
  assert.match(action,/draft\);\}\}/);
  assert.doesNotMatch(src,/requestKey:crypto\.randomUUID\(\)/);
});

test("existing reserve SQL is idempotent under the exact same request key",()=>{
  const sql=readFileSync("supabase/migrations/20261031_stock_reservation_concurrency_provenance.sql","utf8");
  const reserve=sql.split("create or replace function public.fabric_stock_reserve_v2(")[1]?.split("create or replace function public.fabric_stock_release_v2(")[0]??"";
  assert.match(reserve,/pg_advisory_xact_lock\(hashtext\('stock-request:'\|\|v_key\)\)/);
  assert.match(reserve,/where request_key=v_key limit 1/);
  assert.match(reserve,/if v_existing is not null then return v_existing/);
});
