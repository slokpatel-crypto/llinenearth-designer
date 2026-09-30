import test from "node:test";
import assert from "node:assert/strict";

test("prewarm endpoint stays private and explicitly zero-cost",async()=>{
  const source=await import("node:fs").then((fs)=>fs.readFileSync("src/app/api/operator/designer-render-cache/plan/route.ts","utf8"));
  assert.match(source,/verifyOperatorSession/);
  assert.match(source,/visibleOnCustomerWeb:false/);
  assert.match(source,/spendsRenderCredits:false/);
  assert.doesNotMatch(source,/renderSelectedLookFashnFront|renderSelectedLookFashnView|runEdit/);
});

test("prewarm planner is deterministic and bounded",async()=>{
  const fs=await import("node:fs");
  const source=fs.readFileSync("src/lib/designer/prewarm-plan.ts","utf8");
  assert.match(source,/Math\.min\(30/);
  assert.match(source,/new Set<string>/);
  assert.match(source,/deterministic candidate only, no render credit spent/);
  assert.doesNotMatch(source,/Date\.now|Math\.random/);
});
