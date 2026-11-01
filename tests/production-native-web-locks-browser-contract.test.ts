import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("M138 signed Chromium executes the production helper under real two-tab Web Locks",()=>{
  const browser=readFileSync("scripts/verify-production-native-web-locks-browser.cjs","utf8");
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  assert.match(browser,/GITHUB_ACTIONS/);
  assert.match(browser,/LINEN_BROWSER_QA_RUNTIME/);
  assert.match(browser,/LINEN_OPERATOR_SESSION_SECRET/);
  assert.match(browser,/127\\.0\\.0\\.1/);
  assert.match(browser,/ts\\.transpileModule\\(source/);
  assert.match(browser,/window\\.__titanHold=exports/);
  assert.match(browser,/navigator\\.locks\\.request\\(helper\\.PRODUCTION_WRITE_LOCK_NAME/);
  assert.match(browser,/navigator\\.locks\\.query\\(\\)/);
  assert.match(browser,/state\\.pending\\.some/);
  assert.match(browser,/completedEpochBlocksStaleClaim:true/);
  assert.match(browser,/syntheticPostsSecond:0/);
  assert.match(browser,/freshRecovery:true/);
  assert.match(browser,/unsupportedLockFailsClosed:true/);
  assert.match(browser,/No real production POST in synthetic CI/);
  assert.match(browser,/for\\(const width of \\[390,1440\\]\\)/);
  assert.match(workflow,/node scripts\\/verify-production-native-web-locks-browser\\.cjs/);
});
