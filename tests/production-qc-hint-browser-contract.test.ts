import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("M120 real browser regression is CI-only, local, signed, and never posts delivery",()=>{
  const script=readFileSync("scripts/verify-production-qc-hint-browser.cjs","utf8");
  assert.match(script,/GITHUB_ACTIONS/);
  assert.match(script,/process\.env\.CI/);
  assert.match(script,/127\.0\.0\.1/);
  assert.match(script,/createHmac/);
  assert.match(script,/PINNED|Pinned/);
  assert.match(script,/chromium\.launch/);
  assert.match(script,/ctx\.addCookies/);
  assert.match(script,/status:"ready"/);
  assert.match(script,/firstIntercepted/);
  assert.match(script,/firstRelease/);
  assert.match(script,/status:503/);
  assert.match(script,/status:200/);
  assert.match(script,/Refresh production history/);
  assert.match(script,/stale positive answer/);
  assert.match(script,/option\[value="delivered"\]/);
  assert.match(script,/deliveryPosted:false/);
  assert.doesNotMatch(script,/(?:method:"POST"|method:'POST'|page\.getByText\("deliver"\)\.click)/,
    "The isolated UI test must never issue any delivery mutation");
  assert.match(script,/for\(const width of \[390,1440\]\)/);
  assert.match(script,/physicalEvidence:false/);
});

test("M120 production UI browser check runs in full and independent Non-3D CI",()=>{
  for(const path of [".github/workflows/ci.yml",".github/workflows/deep-engine-non3d.yml"]){
    const s=readFileSync(path,"utf8");
    assert.match(s,/node scripts\/verify-production-qc-hint-browser\.cjs/);
    assert.ok(s.indexOf("verify-production-qc-hint-browser.cjs")>
      s.indexOf("verify-production-delivery-eligibility-private-http.cjs"),
      "New UI regression must run after signed API contract");
  }
  const ui=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  assert.match(ui,/const response=await fetch\("\/api\/operator\/production"/);
  assert.match(ui,/if\(readVersion===ledgerReadVersion\.current\)setDeliveryEligibility\(rows\)/);
  assert.match(ui,/hasVerifiedSqlDeliveryEligibility\(deliveryEligibility,item\)/);
});
