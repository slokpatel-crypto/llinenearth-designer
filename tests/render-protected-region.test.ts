import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyProtectedRegionChange,
  protectedRegionChangePercent,
} from "../src/lib/designer/render-protected-region.ts";

test("protected render drift uses the same conservative normalized scale as visual QA",()=>{
  assert.equal(protectedRegionChangePercent([0.022,0.044]),15);
  assert.equal(protectedRegionChangePercent([0.11]),50);
  assert.equal(protectedRegionChangePercent([]),null);
});

test("protected region status fails closed only after meaningful front-view drift",()=>{
  assert.equal(classifyProtectedRegionChange(null),"unavailable");
  assert.equal(classifyProtectedRegionChange(Number.NaN),"unavailable");
  assert.equal(classifyProtectedRegionChange(34),"strong");
  assert.equal(classifyProtectedRegionChange(35),"review");
  assert.equal(classifyProtectedRegionChange(60),"review");
  assert.equal(classifyProtectedRegionChange(61),"weak");
});
