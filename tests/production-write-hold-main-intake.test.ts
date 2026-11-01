import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCTION_WRITE_HOLD_KEY,PRODUCTION_WRITE_EPOCH_KEY,
  PRODUCTION_WRITE_LOCK_NAME,PRODUCTION_WRITE_SESSION_LOCK_NAME,
  productionWriteHoldPending,readProductionWriteHoldKey,
  beginProductionWriteHold,releaseProductionWriteHold,acknowledgeProductionWriteHold,
  captureProductionWriteEpoch,productionWriteEpochUnchanged,
  captureProductionWriteReviewSnapshot,productionWriteReviewSnapshotUnchanged,
  beginProductionWriteHoldAtomically,
} from "../src/lib/designer/production-write-hold.ts";

const key="123e4567-e89b-42d3-a456-426614174070";
const other="9b4216ea-8df6-45a4-8a5c-2f1f91ad283e";
function storage(){
  const map=new Map<string,string>();
  return {
    map,
    getItem:(key:string)=>map.get(key)??null,
    setItem:(key:string,value:string)=>{map.set(key,value);},
    removeItem:(key:string)=>{map.delete(key);},
  };
}
test("main intake: anonymous hold is recorded before a write; only the matching token releases",()=>{
  const s=storage();
  assert.equal(productionWriteHoldPending(s),false);
  assert.equal(beginProductionWriteHold(s,"invalid"),false);
  assert.equal(beginProductionWriteHold(s,key),true);
  assert.equal(s.getItem(PRODUCTION_WRITE_HOLD_KEY),key);
  assert.equal(s.getItem(PRODUCTION_WRITE_EPOCH_KEY),key);
  assert.equal(readProductionWriteHoldKey(s),key);
  assert.equal(productionWriteHoldPending(s),true);
  assert.equal(beginProductionWriteHold(s,other),false,"No concurrent write may replace hold");
  assert.equal(releaseProductionWriteHold(s,other),false,"Wrong writer cannot clear marker");
  assert.equal(releaseProductionWriteHold(s,key),true);
  assert.equal(productionWriteHoldPending(s),false);
  assert.equal(captureProductionWriteEpoch(s),key,
    "The last-write generation survives successful marker release");
});
test("main intake: same-UUID changed write epoch invalidates receipt review",()=>{
  const s=storage();
  assert.equal(beginProductionWriteHold(s,key),true);
  const snapshot=captureProductionWriteReviewSnapshot(s);
  assert.deepEqual(snapshot,{holdToken:key,epoch:key});
  assert.equal(productionWriteReviewSnapshotUnchanged(s,snapshot),true);
  s.setItem(PRODUCTION_WRITE_EPOCH_KEY,other);
  assert.equal(s.getItem(PRODUCTION_WRITE_HOLD_KEY),key);
  assert.equal(productionWriteReviewSnapshotUnchanged(s,snapshot),false,
    "An unchanged original UUID does NOT prove no newer concurrent write");
  assert.equal(acknowledgeProductionWriteHold(s,other),false);
  assert.equal(productionWriteHoldPending(s),true);
});
test("main intake: a completed other-tab write still invalidates an old clean-epoch export",()=>{
  const s=storage();
  assert.equal(captureProductionWriteEpoch(s),"");
  const before=captureProductionWriteEpoch(s);
  assert.equal(beginProductionWriteHold(s,key),true);
  assert.equal(releaseProductionWriteHold(s,key),true);
  assert.equal(productionWriteEpochUnchanged(s,before),false);
  assert.equal(productionWriteEpochUnchanged(s,key),true);
});
test("main intake: invalid or unavailable protected storage fails closed",()=>{
  const s=storage();
  s.setItem(PRODUCTION_WRITE_HOLD_KEY,"invalid");
  assert.equal(productionWriteHoldPending(s),true);
  assert.equal(readProductionWriteHoldKey(s),null);
  assert.equal(captureProductionWriteReviewSnapshot(s),null);
  assert.equal(acknowledgeProductionWriteHold(s),false);
  s.map.clear();
  s.setItem(PRODUCTION_WRITE_EPOCH_KEY,"private notes");
  assert.equal(captureProductionWriteReviewSnapshot(s),null);
  assert.equal(captureProductionWriteEpoch(s),null);
  assert.equal(productionWriteEpochUnchanged(s,""),false);
  assert.equal(productionWriteHoldPending(null),true);
  assert.equal(beginProductionWriteHold(null,key),false);
  const denied={getItem:(_k:string):string|null=>{throw Error("blocked");},
    setItem:(_k:string,_v:string):void=>{throw Error("blocked");},
    removeItem:(_k:string):void=>{throw Error("blocked");}};
  assert.equal(productionWriteHoldPending(denied),true);
  assert.equal(beginProductionWriteHold(denied,key),false);
  assert.equal(releaseProductionWriteHold(denied,key),false);
  assert.equal(captureProductionWriteReviewSnapshot(denied),null);
});
test("main intake: an origin-wide exclusive lock must atomically recheck exact snapshot",async()=>{
  const s=storage();
  const before=captureProductionWriteReviewSnapshot(s);
  assert.deepEqual(before,{holdToken:null,epoch:""});
  const exclusive=async(claim:()=>boolean)=>claim();
  assert.equal(await beginProductionWriteHoldAtomically(s,key,exclusive,before),true);
  assert.equal(s.getItem(PRODUCTION_WRITE_HOLD_KEY),key);
  const old=captureProductionWriteReviewSnapshot(s);
  assert.ok(old);
  assert.equal(releaseProductionWriteHold(s,key),true);
  assert.equal(await beginProductionWriteHoldAtomically(s,other,exclusive,old),false,
    "A stale snapshot may not claim a new production POST");
  assert.equal(s.getItem(PRODUCTION_WRITE_HOLD_KEY),null);
  assert.equal(await beginProductionWriteHoldAtomically(s,other,null,
    captureProductionWriteReviewSnapshot(s)),false,"Missing Web Locks must fail closed");
  assert.equal(s.getItem(PRODUCTION_WRITE_HOLD_KEY),null);
  assert.ok(PRODUCTION_WRITE_LOCK_NAME.includes("write-hold-lock"));
  assert.ok(PRODUCTION_WRITE_SESSION_LOCK_NAME.includes("active-write-session"));
});
