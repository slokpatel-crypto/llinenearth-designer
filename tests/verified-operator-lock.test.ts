import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isCurrentVerifiedOperatorLock} from "../src/lib/designer/verified-operator-lock.ts";

test("a recovery token edit revokes the previous rendered lock in the same event turn",()=>{
  const original=Object.freeze({revisionId:"old",recipeHash:"a".repeat(64)});
  const next=Object.freeze({revisionId:"new",recipeHash:"b".repeat(64)});
  let verified:object|null=original;
  const oldRendered=original;
  assert.equal(isCurrentVerifiedOperatorLock(oldRendered,verified),true);
  verified=null; // synchronous input change or new recovery start, before React rerender
  assert.equal(isCurrentVerifiedOperatorLock(oldRendered,verified),false);
  verified=next; // successful response, before React commits its new loadedRevision
  assert.equal(isCurrentVerifiedOperatorLock(oldRendered,verified),false);
  assert.equal(isCurrentVerifiedOperatorLock(next,verified),true);
  assert.equal(isCurrentVerifiedOperatorLock({...next},verified),false,
    "equivalent recipe data is not proof this handler displays the verified response");
  assert.equal(isCurrentVerifiedOperatorLock(null,verified),false);
});

test("operator revokes lock before async recovery and token edits, and never exports stale handlers",()=>{
  const src=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  assert.match(src,/const verifiedLockedRevision=useRef<LockedDesignRevision\|null>\(null\)/);
  const recovery=src.split("async function loadLockedDesign(){")[1]?.split("function download(")[0]??"";
  const revoked=recovery.indexOf("verifiedLockedRevision.current=null;");
  const awaitVault=recovery.indexOf('await fetch("/api/designer/vault"');
  const verified=recovery.indexOf("verifiedLockedRevision.current=revision;");
  const setLoaded=recovery.indexOf("setLoadedRevision(revision);");
  assert.ok(revoked>=0&&awaitVault>revoked&&verified>awaitVault&&setLoaded>verified,
    "new vault recovery revokes old lock synchronously and verifies before rendering");
  assert.match(recovery,/catch\(error\)\{\s*verifiedLockedRevision\.current=null;/);
  const input=src.split('value={recoveryToken} disabled={busy} onChange={(e)=>{')[1]
    ?.split('placeholder="lev1.')[0]??"";
  assert.match(input,/verifiedLockedRevision\.current=null;\s*setRecoveryToken\(e\.target\.value\)/);
  const post=src.split("async function post(")[1]?.split("async function lookupPendingCreationReceipt(")[0]??"";
  assert.match(post,/body\.action==="create_quote"\|\|body\.action==="create_order"/);
  assert.match(post,/!isCurrentVerifiedOperatorLock\(loadedRevision,verifiedLockedRevision\.current\)/);
  for(const [name,end] of [
    ["exportHandoff","async function exportTechPack()"],
    ["exportTechPack","async function exportProductionPacket()"],
    ["exportProductionPacket","const quoteRows=useMemo("],
  ]){
    const fn=src.split(`async function ${name}(){`)[1]?.split(end)[0]??"";
    const gate="isCurrentVerifiedOperatorLock(loadedRevision,verifiedLockedRevision.current)";
    assert.ok(fn.includes(gate),name+" must reject a stale loaded revision before export");
    assert.ok(fn.indexOf(gate)<fn.indexOf("await "),name+" must gate before awaiting");
    assert.ok(fn.lastIndexOf(gate)>fn.indexOf("await "),name+" must recheck after awaiting");
  }
});
