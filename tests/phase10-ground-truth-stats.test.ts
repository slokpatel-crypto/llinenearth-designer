import test from "node:test";
import assert from "node:assert/strict";
import { summarizeFabricGroundTruth } from "../src/lib/fabric-ground-truth-stats.ts";

test("ground-truth progress counts unique stock fabrics, not profile rows",()=>{
  const summary=summarizeFabricGroundTruth([
    {fabric_id:"linen-blue",review_status:"approved"},
    {fabric_id:"linen-blue",review_status:"corrected"},
    {fabric_id:"linen-beige",review_status:"unreviewed"},
    {fabric_id:"linen-beige",review_status:"unreviewed"},
    {fabric_id:null,review_status:"approved"},
  ],50);
  assert.equal(summary.reviewedFabrics,1);
  assert.equal(summary.pendingFabrics,1);
  assert.equal(summary.stockBoundProfiles,2);
  assert.equal(summary.remaining,49);
});

test("reviewed state wins over pending duplicate for same fabric",()=>{
  const summary=summarizeFabricGroundTruth([
    {fabric_id:"linen-stripe",review_status:"unreviewed"},
    {fabric_id:"linen-stripe",review_status:"approved"},
  ],4);
  assert.equal(summary.reviewedFabrics,1);
  assert.equal(summary.pendingFabrics,0);
  assert.equal(summary.stockBoundProfiles,1);
  assert.equal(summary.remaining,3);
});
