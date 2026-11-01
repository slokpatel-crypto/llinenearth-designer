import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("M150 cross-tab localStorage.clear must revoke verified operator history",()=>{
  const client=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const browser=readFileSync("scripts/verify-production-storage-clear-browser.cjs","utf8");
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  const storageHandler=client.split("const onStorage=(event:StorageEvent)=>{")[1]
    ?.split("window.addEventListener(\"storage\",onStorage)")[0]??"";
  assert.ok(storageHandler.includes("event.key===null"),
    "StorageEvent.key is null when another tab calls localStorage.clear()");
  for(const marker of [
    "verifiedLedgerReadVersion.current=0",
    "verifiedWriteReviewSnapshot.current=null",
    "setRenderedLedgerReadVersion(0)",
    "setConfigured(false)",
    "setRequiresWriteReview(true)",
    "protected browser storage was cleared",
  ])assert.ok(storageHandler.includes(marker),"Storage clear must fail closed: "+marker);
  for(const marker of [
    "M150 storage-clear operator browser acceptance is CI-only",
    "for(const width of [390,768,1440])",
    "await b.evaluate(()=>localStorage.clear())",
    "Storage clear must synchronously invalidate the operator write controls",
    "A fresh GET alone must not clear a storage-loss uncertainty hold",
    "assert.deepEqual(productionPosts,[]",
    "M150 signed Chromium cross-tab storage-clear write veto PASS.",
  ])assert.ok(browser.includes(marker),"Signed browser acceptance missing "+marker);
  assert.ok(workflow.includes("node scripts/verify-production-storage-clear-browser.cjs"));
});
