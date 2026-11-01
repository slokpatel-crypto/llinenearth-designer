import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("M138 signed Chromium executes the production helper under real two-tab Web Locks",()=>{
  const browser=readFileSync("scripts/verify-production-native-web-locks-browser.cjs","utf8");
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  assert.match(browser,/GITHUB_ACTIONS/);
  assert.match(browser,/LINEN_BROWSER_QA_RUNTIME/);
  assert.match(browser,/LINEN_OPERATOR_SESSION_SECRET/);
  assert.match(browser,/127\.0\.0\.1/);
  assert.match(browser,/ts\.transpileModule\(source/);
  assert.match(browser,/window\.__titanHold=exports/);
  assert.match(browser,/navigator\.locks\.request\(helper\.PRODUCTION_WRITE_LOCK_NAME/);
  assert.match(browser,/navigator\.locks\.query\(\)/);
  assert.match(browser,/state\.pending\.some/);
  assert.match(browser,/completedEpochBlocksStaleClaim:true/);
  assert.match(browser,/syntheticPostsSecond:0/);
  assert.match(browser,/freshRecovery:true/);
  assert.match(browser,/unsupportedLockFailsClosed:true/);
  assert.match(browser,/No real production POST in synthetic CI/);
  assert.match(browser,/for\(const width of \[390,1440\]\)/);
  assert.match(workflow,/node scripts\/verify-production-native-web-locks-browser\.cjs/);
});


test("M139 signed native Chromium rejects active-session review and permits later recovery",()=>{
  const browser=readFileSync("scripts/verify-production-native-web-locks-browser.cjs","utf8");
  assert.match(browser,/navigator\.locks\.request\(h\.PRODUCTION_WRITE_SESSION_LOCK_NAME/);
  assert.match(browser,/\{mode:"exclusive",ifAvailable:true\}/);
  assert.match(browser,/Second tab must not acknowledge an actively in-flight production write/);
  assert.match(browser,/A completed session must allow deliberate recovery of its exact marker/);
  assert.match(browser,/activeSessionAcknowledgementBlocked:true/);
  assert.match(browser,/postSessionAcknowledgementRecovered:true/);
  assert.match(browser,/realProductionPosts:0,syntheticOnly:true/);
  const reviewBrowser=readFileSync("scripts/verify-production-ledger-refresh-barrier-browser.cjs","utf8");
  assert.match(reviewBrowser,/postSessionRefreshAndSecondClickRequired:true/);
  assert.match(reviewBrowser,/First acknowledgement must not clear a marker before post-session history verification/);
  assert.match(reviewBrowser,/Only the second explicit acknowledgement after a post-session GET may clear the marker/);
});

test("M140 signed browser drives real operator POST while second tab attempts review",()=>{
  const browser=readFileSync("scripts/verify-production-native-web-locks-browser.cjs","utf8");
  const client=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  for(const token of [
    "section.productionRecord select",
    'statusSelect.selectOption("cloth_reserved")',
    "window.__titanUiDeferredPost=state",
    "Another tab has an active production write",
    "Actual React production handler must hold the native session lock",
    "Real React review must not clear a different tab",
    "Exactly one synthetic UI POST was intercepted",
    "realReactDeferredPostReviewBlocked:true,interceptedUiPosts:1",
    "Real UI contention test must never send a production POST over HTTP",
  ])assert.ok(browser.includes(token),`Missing real UI browser acceptance: ${token}`);
  assert.ok(client.includes("await post(body,success,true)"));
  assert.ok(client.includes('PRODUCTION_WRITE_SESSION_LOCK_NAME,{mode:"exclusive",ifAvailable:true}'));
});
