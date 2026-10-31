import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  PRODUCTION_WRITE_HOLD_KEY,PRODUCTION_WRITE_EPOCH_KEY,
  beginProductionWriteHold,releaseProductionWriteHold,
  acknowledgeProductionWriteHold,productionWriteHoldPending,
  captureProductionWriteEpoch,productionWriteEpochUnchanged,
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
  const begin=post.indexOf("beginProductionWriteHold(safeProductionHoldStorage(),holdToken)");
  const fetch=post.indexOf('await fetch("/api/operator/production",{method:"POST"');
  assert.ok(begin>=0&&fetch>begin,"No possibly durable SQL write before the private marker exists");
  assert.match(post,/if\(!beginProductionWriteHold\(safeProductionHoldStorage\(\),holdToken\)\)\{/);
  assert.match(post,/setRequiresWriteReview\(true\);\s*actionInFlight.current=true;/);
  assert.match(post,/releaseProductionWriteHold\(safeProductionHoldStorage\(\),holdToken\)/);
  assert.match(post,/if\(confirmed\)\{\s*if\(releaseProductionWriteHold/);
  assert.match(post,/if\(certainPrewriteRejection\)\{[^]*?releaseProductionWriteHold/);
  assert.match(review,/if\(!acknowledgeProductionWriteHold\(safeProductionHoldStorage\(\)\)\)\{/);
  assert.match(source,/productionWriteHoldPending\(safeProductionHoldStorage\(\)\)/);
  assert.match(source,/window.addEventListener\("storage",onStorage\)/);
  assert.match(source,/if\(event.key===PRODUCTION_WRITE_HOLD_KEY\)\{/);
  assert.match(source,/setRecoveredCreationReceipts\(null\);\s*if\(event.newValue!==null\)setRequiresWriteReview\(true\);/);
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
