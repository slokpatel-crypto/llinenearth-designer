import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isCurrentVerifiedProductionLedger } from "../src/lib/designer/production-ledger-generation.ts";

test("only the latest successfully verified production ledger may authorize an action",()=>{
  assert.equal(isCurrentVerifiedProductionLedger(0,0,0),false,"initial empty state");
  assert.equal(isCurrentVerifiedProductionLedger(1,1,1),true,"verified first read");
  assert.equal(isCurrentVerifiedProductionLedger(2,1,1),false,"refresh started before React commits disabled controls");
  assert.equal(isCurrentVerifiedProductionLedger(2,0,0),false,"refresh failed or returned unconfigured");
  assert.equal(isCurrentVerifiedProductionLedger(2,2,1),false,"verified GET has not yet rendered to the operator");
  assert.equal(isCurrentVerifiedProductionLedger(2,2,2),true,"new generation verified and rendered");
  assert.equal(isCurrentVerifiedProductionLedger(3,2,2),false,"later mutation or refresh invalidated it");
  for(const bad of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
    assert.equal(isCurrentVerifiedProductionLedger(bad,bad,bad),false);
  }
});

test("operator review, mutations and packet export check the synchronous generation barrier",()=>{
  const src=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const load=src.split("async function load(")[1]?.split("useEffect(()=>{")[0]||"";
  const post=src.split("async function post(")[1]?.split("async function lookupPendingCreationReceipt(")[0]||"";
  const review=src.split("function confirmReviewedProductionHistory()")[1]?.split("async function loadLockedDesign(")[0]||"";
  const packet=src.split("async function exportProductionPacket()")[1]?.split("const quoteRows=")[0]||"";
  assert.match(src,/const verifiedLedgerReadVersion=useRef\(0\)/);
  assert.match(src,/isCurrentVerifiedProductionLedger\(ledgerReadVersion\.current,verifiedLedgerReadVersion\.current,renderedLedgerReadVersion\)/);
  assert.match(src,/const \[renderedLedgerReadVersion,setRenderedLedgerReadVersion\]=useState\(0\)/);
  assert.match(load,/const readVersion=\+\+ledgerReadVersion\.current;\s*verifiedReviewSessionReadVersion\.current=0;\s*const reviewSnapshot=captureProductionWriteReviewSnapshot\(safeProductionHoldStorage\(\)\);\s*verifiedWriteReviewSnapshot\.current=null;\s*verifiedLedgerReadVersion\.current=0;/);
  assert.match(load,/if\(readVersion!==ledgerReadVersion\.current\) return false;/);
  assert.match(load,/verifiedLedgerReadVersion\.current=data\.configured\?readVersion:0;\s*setRenderedLedgerReadVersion\(data\.configured\?readVersion:0\);/);
  assert.match(load,/if\(response\.status===401\)\{if\(readVersion===ledgerReadVersion\.current\)/);
  assert.match(post,/if\(!hasCurrentVerifiedLedger\(\)\) return;/);
  assert.match(post,/ledgerReadVersion\.current\+=1;\s*verifiedLedgerReadVersion\.current=0;/);
  assert.match(review,/if\(!hasCurrentVerifiedLedger\(\)\)return;/);
  assert.match(packet,/if\(!hasCurrentVerifiedLedger\(\)\) return;/);
  assert.match(packet,/const packetLedgerVersion=ledgerReadVersion\.current;/);
  assert.match(packet,/if\(!isCurrentVerifiedProductionLedger\(ledgerReadVersion\.current,verifiedLedgerReadVersion\.current,renderedLedgerReadVersion\)\s*\|\|ledgerReadVersion\.current!==packetLedgerVersion\)/);
});
