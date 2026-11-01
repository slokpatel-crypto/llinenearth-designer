import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  PRODUCTION_WRITE_HOLD_KEY,PRODUCTION_WRITE_EPOCH_KEY,
  beginProductionWriteHold,releaseProductionWriteHold,
  acknowledgeProductionWriteHold,productionWriteHoldPending,
  captureProductionWriteEpoch,productionWriteEpochUnchanged,
  captureProductionWriteReviewSnapshot,productionWriteReviewSnapshotUnchanged,
  beginProductionWriteHoldAtomically,PRODUCTION_WRITE_LOCK_NAME,
  PRODUCTION_WRITE_SESSION_LOCK_NAME,
} from "../src/lib/designer/production-write-hold.ts";

const id="123e4567-e89b-42d3-a456-426614174000";
const id2="123e4567-e89b-42d3-a456-426614174001";
function storage(){
  const items=new Map<string,string>();
  return {
    items,
    getItem:(key:string)=>items.get(key)??null,
    setItem:(key:string,value:string)=>{items.set(key,value);},
    removeItem:(key:string)=>{items.delete(key);},
  };
}

test("a token-only pre-POST barrier persists until matching verified release",()=>{
  const s=storage();
  assert.equal(productionWriteHoldPending(s),false);
  assert.equal(beginProductionWriteHold(s,id),true);
  assert.equal(productionWriteHoldPending(s),true);
  assert.equal(s.items.get(PRODUCTION_WRITE_HOLD_KEY),id);
  assert.equal(beginProductionWriteHold(s,id2),false,
    "Another tab or reload cannot start a competing write while one is unresolved");
  assert.equal(releaseProductionWriteHold(s,id2),false,
    "One tab cannot clear another write's marker");
  assert.equal(productionWriteHoldPending(s),true);
  assert.equal(releaseProductionWriteHold(s,id),true);
  assert.equal(productionWriteHoldPending(s),false);
  assert.equal(beginProductionWriteHold(s,"bad"),false);
});

test("manual acknowledgement works only for present readable marker, never as automatic GET success",()=>{
  const s=storage();
  assert.equal(acknowledgeProductionWriteHold(s),false);
  assert.equal(beginProductionWriteHold(s,id),true);
  assert.equal(acknowledgeProductionWriteHold(s),true);
  assert.equal(productionWriteHoldPending(s),false);
});

test("inaccessible or incoherent storage fails closed without a production POST",()=>{
  const broken={
    getItem:(_k:string):string|null=>{throw Error("storage denied");},
    setItem:(_k:string,_v:string)=>{throw Error("storage denied");},
    removeItem:(_k:string)=>{throw Error("storage denied");},
  };
  assert.equal(productionWriteHoldPending(broken),true);
  assert.equal(beginProductionWriteHold(broken,id),false);
  assert.equal(releaseProductionWriteHold(broken,id),false);
  assert.equal(acknowledgeProductionWriteHold(broken),false);
  const lost=storage();
  lost.setItem=()=>{}; // Browser reported a write that never persisted.
  assert.equal(beginProductionWriteHold(lost,id),false);
  const noRemove=storage();
  assert.equal(beginProductionWriteHold(noRemove,id),true);
  noRemove.removeItem=()=>{};
  assert.equal(releaseProductionWriteHold(noRemove,id),false);
  assert.equal(productionWriteHoldPending(noRemove),true);
});

test("denied storage getter fails closed before any mutation can be prepared",()=>{
  assert.equal(productionWriteHoldPending(null),true);
  assert.equal(productionWriteHoldPending(undefined),true);
  assert.equal(beginProductionWriteHold(null,id),false);
  assert.equal(releaseProductionWriteHold(null,id),false);
  assert.equal(acknowledgeProductionWriteHold(null),false);
  const ui=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  assert.match(ui,/function safeProductionHoldStorage\(\):Storage\|null\{/);
  assert.match(ui,/try\{return window\.localStorage;\}\s*catch\{return null;\}/);
});

test("browser production write barrier is saved BEFORE POST and reviewed after fresh history",()=>{
  const source=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const post=source.split("async function post(")[1]?.split("function confirmReviewedProductionHistory(")[0]||"";
  const review=source.split("function confirmReviewedProductionHistory(")[1]?.split("async function loadLockedDesign(")[0]||"";
  const begin=post.indexOf("beginProductionWriteHoldAtomically(");
  const fetch=post.indexOf('await fetch("/api/operator/production",{method:"POST"');
  assert.ok(begin>=0&&fetch>begin,"No possibly durable SQL write before the private marker exists");
  assert.match(post,/const claimed=await beginProductionWriteHoldAtomically\(/);
  assert.match(post,/actionInFlight.current=true;\s*setBusy\(true\);\s*const claimed=await beginProductionWriteHoldAtomically/);
  assert.match(post,/if\(claimed\)releaseProductionWriteHold\(storage,holdToken\)/);
  assert.match(post,/releaseProductionWriteHold\(safeProductionHoldStorage\(\),holdToken\)/);
  assert.match(post,/if\(confirmed\)\{\s*if\(releaseProductionWriteHold/);
  assert.match(post,/if\(certainPrewriteRejection\)\{[^]*?releaseProductionWriteHold/);
  assert.match(review,/productionWriteReviewSnapshotUnchanged\(storage,snapshot\)/);
  assert.match(review,/acknowledgeProductionWriteHold\(storage,snapshot\.holdToken\)/);
  assert.match(source,/productionWriteHoldPending\(safeProductionHoldStorage\(\)\)/);
  assert.match(source,/window.addEventListener\("storage",onStorage\)/);
  assert.match(source,/event.key===PRODUCTION_WRITE_HOLD_KEY\|\|event.key===PRODUCTION_WRITE_EPOCH_KEY/);
  assert.match(source,/verifiedWriteReviewSnapshot\.current=null;\s*setRenderedLedgerReadVersion\(0\);\s*setConfigured\(false\);/);
  assert.doesNotMatch(source,/localStorage\.setItem\([^\n]*recoveryToken/);
  assert.doesNotMatch(source,/localStorage\.setItem\([^\n]*pendingWriteReview/);
  const helper=readFileSync("src/lib/designer/production-write-hold.ts","utf8");
  assert.doesNotMatch(helper,/recoveryToken|lineItems|customerPhone|sessionCookie/);
});


test("M135 packet snapshot detects cross-tab writes even after their pending marker clears",()=>{
  const s=storage();
  const before=captureProductionWriteEpoch(s);
  assert.equal(before,"","clean legacy browser can capture its first epoch");
  assert.equal(productionWriteEpochUnchanged(s,before),true);
  assert.equal(beginProductionWriteHold(s,id),true);
  assert.equal(captureProductionWriteEpoch(s),null,"no export while the write is pending");
  assert.equal(productionWriteEpochUnchanged(s,before),false);
  assert.equal(releaseProductionWriteHold(s,id),true);
  assert.equal(productionWriteEpochUnchanged(s,before),false,
    "a completed concurrent write still invalidates the in-flight packet");
  const after=captureProductionWriteEpoch(s);
  assert.equal(after,id);
  assert.equal(productionWriteEpochUnchanged(s,after),true);
  assert.equal(beginProductionWriteHold(s,id2),true);
  assert.equal(releaseProductionWriteHold(s,id2),true);
  assert.equal(productionWriteEpochUnchanged(s,after),false);
  assert.equal(s.items.get(PRODUCTION_WRITE_EPOCH_KEY),id2);
});

test("M135 malformed/unavailable write epochs fail closed without disclosing production data",()=>{
  const s=storage();
  assert.equal(captureProductionWriteEpoch(null),null);
  assert.equal(productionWriteEpochUnchanged(null,""),false);
  s.setItem(PRODUCTION_WRITE_EPOCH_KEY,"malformed");
  assert.equal(captureProductionWriteEpoch(s),null);
  assert.equal(productionWriteEpochUnchanged(s,""),false);
  s.removeItem(PRODUCTION_WRITE_EPOCH_KEY);
  const noEpochWrite=storage();
  noEpochWrite.setItem=(key:string,value:string)=>{
    if(key===PRODUCTION_WRITE_EPOCH_KEY)throw Error("epoch persistence denied");
    noEpochWrite.items.set(key,value);
  };
  assert.equal(beginProductionWriteHold(noEpochWrite,id),false,
    "no SQL POST may proceed if the cross-tab epoch cannot be persisted");
  assert.equal(productionWriteHoldPending(noEpochWrite),true,
    "a failed epoch write must leave the uncertain hold in place");
});

test("M135 packet export checks the anonymous epoch before GET and after async packet build",()=>{
  const src=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const packet=src.split("async function exportProductionPacket()")[1]?.split("const quoteRows=")[0]||"";
  const capture=packet.indexOf("const packetWriteEpoch=captureProductionWriteEpoch(safeProductionHoldStorage())");
  const fetch=packet.indexOf('await fetch("/api/operator/production",{cache:"no-store"})');
  const build=packet.indexOf("await buildVerifiedProductionPacket(");
  const verify=packet.indexOf("productionWriteEpochUnchanged(safeProductionHoldStorage(),packetWriteEpoch)");
  const download=packet.indexOf("download(`linen-earth-production-packet-");
  assert.ok(capture>=0&&capture<fetch&&fetch<build&&build<verify&&verify<download,
    "a concurrent tab must not produce an export before or after an async ledger read");
  assert.match(packet,/if\(packetWriteEpoch===null\)\{/);
  assert.match(packet,/verifiedLedgerReadVersion\.current=0;\s*setRenderedLedgerReadVersion\(0\);\s*setConfigured\(false\);/);
  assert.match(packet,/if\(productionWriteHoldPending\(safeProductionHoldStorage\(\)\)\)setRequiresWriteReview\(true\)/);
  assert.doesNotMatch(src,/localStorage\.setItem\([^\n]*(?:recoveryToken|lineItems|customerPhone)/);
});


test("M136 a reviewed marker and epoch cannot authorize acknowledgement after another tab changes either",()=>{
  const s=storage();
  assert.equal(beginProductionWriteHold(s,id),true);
  const original=captureProductionWriteReviewSnapshot(s);
  assert.deepEqual(original,{holdToken:id,epoch:id});
  assert.equal(productionWriteReviewSnapshotUnchanged(s,original),true);
  assert.equal(acknowledgeProductionWriteHold(s,id2),false,
    "a reviewed token mismatch must never clear another tab's marker");
  assert.equal(productionWriteHoldPending(s),true);
  assert.equal(releaseProductionWriteHold(s,id),true);
  assert.equal(productionWriteReviewSnapshotUnchanged(s,original),false,
    "a completed write invalidates a previously reviewed pending marker");
  const completed=captureProductionWriteReviewSnapshot(s);
  assert.deepEqual(completed,{holdToken:null,epoch:id});
  assert.equal(productionWriteReviewSnapshotUnchanged(s,completed),true,
    "a fresh clean ledger may support explicit UI review without deleting a marker");
  assert.equal(beginProductionWriteHold(s,id2),true);
  assert.equal(productionWriteReviewSnapshotUnchanged(s,completed),false);
  assert.equal(acknowledgeProductionWriteHold(s,id),false);
  assert.equal(s.items.get(PRODUCTION_WRITE_HOLD_KEY),id2);
});

test("M136 unreadable or corrupted review marker cannot be acknowledged",()=>{
  const s=storage();
  assert.equal(captureProductionWriteReviewSnapshot(null),null);
  assert.equal(productionWriteReviewSnapshotUnchanged(null,null),false);
  s.setItem(PRODUCTION_WRITE_HOLD_KEY,"not-a-uuid");
  assert.equal(captureProductionWriteReviewSnapshot(s),null);
  assert.equal(acknowledgeProductionWriteHold(s),false);
  s.removeItem(PRODUCTION_WRITE_HOLD_KEY);
  s.setItem(PRODUCTION_WRITE_EPOCH_KEY,"bad-epoch");
  assert.equal(captureProductionWriteReviewSnapshot(s),null);
  assert.equal(productionWriteReviewSnapshotUnchanged(s,{holdToken:null,epoch:""}),false);
});

test("M136 storage events synchronously revoke history review, and fresh GET binds the exact marker",()=>{
  const src=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const load=src.split("async function load(")[1]?.split("useEffect(()=>{")[0]||"";
  const review=src.split("function confirmReviewedProductionHistory()")[1]?.split("async function loadLockedDesign(")[0]||"";
  assert.match(load,/const reviewSnapshot=captureProductionWriteReviewSnapshot\(safeProductionHoldStorage\(\)\)/);
  assert.match(load,/productionWriteReviewSnapshotUnchanged\(safeProductionHoldStorage\(\),reviewSnapshot\)/);
  assert.match(load,/verifiedWriteReviewSnapshot\.current=data\.configured\?reviewSnapshot:null/);
  assert.match(src,/event.key===PRODUCTION_WRITE_HOLD_KEY\|\|event.key===PRODUCTION_WRITE_EPOCH_KEY/);
  assert.match(src,/ledgerReadVersion\.current\+=1;\s*verifiedLedgerReadVersion\.current=0;\s*verifiedWriteReviewSnapshot\.current=null/);
  assert.match(review,/const snapshot=verifiedWriteReviewSnapshot\.current/);
  assert.match(review,/productionWriteReviewSnapshotUnchanged\(storage,snapshot\)/);
  assert.match(review,/snapshot\.holdToken!==null&&!acknowledgeProductionWriteHold\(storage,snapshot\.holdToken\)/);
});


test("M137 same-origin exclusive lock prevents two simultaneous production POST claims",async()=>{
  const s=storage();
  const expected=captureProductionWriteReviewSnapshot(s);
  let previous:Promise<unknown>=Promise.resolve();
  const exclusive=(claim:()=>boolean):Promise<boolean>=>{
    const next=previous.then(()=>claim());
    previous=next.then(()=>undefined,()=>undefined);
    return next;
  };
  const [first,second]=await Promise.all([
    beginProductionWriteHoldAtomically(s,id,exclusive,expected),
    beginProductionWriteHoldAtomically(s,id2,exclusive,expected),
  ]);
  assert.deepEqual([first,second],[true,false],
    "a second tab must not win a stale read-then-write after the first claim");
  assert.equal(s.getItem(PRODUCTION_WRITE_HOLD_KEY),id);
  assert.equal(s.getItem(PRODUCTION_WRITE_EPOCH_KEY),id);
  assert.equal(releaseProductionWriteHold(s,id),true);
  assert.equal(await beginProductionWriteHoldAtomically(s,id2,exclusive,expected),false,
    "a completed write while waiting must invalidate the original epoch");
  const refreshed=captureProductionWriteReviewSnapshot(s);
  assert.equal(await beginProductionWriteHoldAtomically(s,id2,exclusive,refreshed),true);
});

test("M137 unavailable, rejected or interrupted Web Lock fails closed before POST",async()=>{
  const s=storage();
  const snapshot=captureProductionWriteReviewSnapshot(s);
  assert.equal(await beginProductionWriteHoldAtomically(s,id,null,snapshot),false);
  assert.equal(await beginProductionWriteHoldAtomically(s,id,undefined,snapshot),false);
  assert.equal(await beginProductionWriteHoldAtomically(s,id,async()=>true,null),false);
  assert.equal(await beginProductionWriteHoldAtomically(s,id,async()=>{throw Error("lock unavailable");},snapshot),false);
  assert.equal(s.getItem(PRODUCTION_WRITE_HOLD_KEY),null);
  assert.equal(await beginProductionWriteHoldAtomically(s,id,async claim=>{
    assert.equal(claim(),true);
    throw Error("lock callback interrupted after marker write");
  },snapshot),false);
  assert.equal(s.getItem(PRODUCTION_WRITE_HOLD_KEY),id,
    "an uncertain claim remains pending for explicit review");
});

test("M137 browser uses origin-wide Web Locks and rechecks verified history after await",()=>{
  const src=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const post=src.split("async function post(")[1]?.split("async function lookupPendingCreationReceipt(")[0]||"";
  assert.match(src,/locks\.request\(PRODUCTION_WRITE_LOCK_NAME,\{mode:"exclusive"\},claim\)/);
  assert.match(src,/if\(!locks\|\|typeof locks\.request!=="function"\)return null/);
  assert.equal(PRODUCTION_WRITE_LOCK_NAME,"linen-earth:production:write-hold-lock:v1");
  assert.match(post,/const beforeLock=captureProductionWriteReviewSnapshot\(storage\)/);
  assert.match(post,/const claimed=await beginProductionWriteHoldAtomically\(/);
  assert.match(post,/if\(!claimed\|\|!hasCurrentVerifiedLedger\(\)/);
  assert.match(post,/if\(claimed\)releaseProductionWriteHold\(storage,holdToken\)/);
  const claim=post.indexOf("const claimed=await beginProductionWriteHoldAtomically(");
  const postNetwork=post.indexOf('await fetch("/api/operator/production",{method:"POST"');
  assert.ok(claim>=0&&postNetwork>claim,"no SQL mutation before exclusive claim succeeds");
});


test("M139 a full-request Web Lock prevents acknowledgement of an in-flight production POST",()=>{
  const src=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const post=src.split("async function post(")[1]?.split("async function lookupPendingCreationReceipt(")[0]||"";
  const review=src.split("function confirmReviewedProductionHistory()")[1]?.split("async function loadLockedDesign(")[0]||"";
  const load=src.split("async function load(")[1]?.split("useEffect(()=>{")[0]||"";
  assert.equal(PRODUCTION_WRITE_SESSION_LOCK_NAME,"linen-earth:production:active-write-session:v1");
  assert.match(post,/locks\\.request\\(PRODUCTION_WRITE_SESSION_LOCK_NAME,\\{mode:"exclusive",ifAvailable:true\\},async lock=>\\{/);
  assert.match(post,/await post\\(body,success,true\\)/);
  assert.match(post,/if\\(!sessionLockHeld\\)\\{/);
  assert.match(post,/const claimed=await beginProductionWriteHoldAtomically\\(/);
  assert.match(post,/await fetch\\("\\/api\\/operator\\/production",\\{method:"POST"/);
  assert.match(review,/locks\\.request\\(PRODUCTION_WRITE_SESSION_LOCK_NAME,\\{mode:"exclusive",ifAvailable:true\\},async lock=>\\{/);
  assert.match(review,/if\\(!lock\\)\\{/);
  const deny=review.indexOf("if(!lock){");
  const acknowledge=review.indexOf("acknowledgeProductionWriteHold(storage,snapshot.holdToken)");
  assert.ok(deny>=0&&acknowledge>deny,"no acknowledgement while another tab owns the full-request lock");
  assert.match(load,/verifiedReviewSessionReadVersion\\.current=0/);
  const recheck=review.indexOf("const refreshed=await load();");
  const proof=review.indexOf("verifiedReviewSessionReadVersion.current=ledgerReadVersion.current",recheck);
  assert.ok(recheck>=0&&proof>recheck&&acknowledge>proof,
    "review must re-fetch authoritative history under the session lock before a second deliberate acknowledgement");
  assert.match(review,/if\\(verifiedReviewSessionReadVersion\\.current!==ledgerReadVersion\\.current\\)/);
  assert.match(review,/if\\(!hasCurrentVerifiedLedger\\(\\)\\)return/);
});
