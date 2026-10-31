import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("M135 signed Chromium tests a positive packet and a completed write from another tab",()=>{
  const browser=readFileSync("scripts/verify-production-packet-cross-tab-browser.cjs","utf8");
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  assert.match(browser,/GITHUB_ACTIONS/);
  assert.match(browser,/LINEN_BROWSER_QA_RUNTIME/);
  assert.match(browser,/LINEN_OPERATOR_SESSION_SECRET/);
  assert.match(browser,/127\.0\.0\.1/);
  assert.match(browser,/syntheticRevision/);
  assert.match(browser,/positivePacket:true/);
  assert.match(browser,/await ctx\.newPage\(\)/);
  assert.match(browser,/localStorage\.setItem\(holdKey,token\)/);
  assert.match(browser,/localStorage\.setItem\(epochKey,token\)/);
  assert.match(browser,/localStorage\.removeItem\(holdKey\)/);
  assert.match(browser,/completedCrossTabWriteBlocked:true/);
  assert.match(browser,/No stale packet may download/);
  assert.match(browser,/No production POST is allowed/);
  assert.match(browser,/for\(const width of \[390,1440\]\)/);
  assert.match(workflow,/node scripts\/verify-production-packet-cross-tab-browser\.cjs/);
});
