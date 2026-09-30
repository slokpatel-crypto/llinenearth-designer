import test from "node:test";
import assert from "node:assert/strict";
import { summarizeFabricGroundTruth } from "../src/lib/fabric-ground-truth-stats.ts";

test("ground truth counts unique stock fabrics instead of profile rows",()=>{
  const summary=summarizeFabricGroundTruth([
    {fabric_id:"fabric-a",review_status:"approved"},
    {fabric_id:"fabric-a",review_status:"approved"},
    {fabric_id:"fabric-b",review_status:"corrected"},
    {fabric_id:"fabric-c",review_status:"unreviewed"},
    {fabric_id:null,review_status:"approved"},
  ],50);
  assert.equal(summary.reviewedFabrics,2);
  assert.equal(summary.pendingFabrics,1);
  assert.equal(summary.stockBoundProfiles,3);
  assert.equal(summary.remaining,48);
});

test("reviewed status wins over duplicate pending row for the same fabric",()=>{
  const summary=summarizeFabricGroundTruth([
    {fabric_id:"fabric-a",review_status:"unreviewed"},
    {fabric_id:"fabric-a",review_status:"approved"},
    {fabric_id:"fabric-b",review_status:"unreviewed"},
  ],2);
  assert.equal(summary.reviewedFabrics,1);
  assert.equal(summary.pendingFabrics,1);
  assert.equal(summary.stockBoundProfiles,2);
  assert.equal(summary.remaining,1);
});

test("rejected and unbound profiles do not inflate reviewed progress",()=>{
  const summary=summarizeFabricGroundTruth([
    {fabric_id:"fabric-a",review_status:"rejected"},
    {fabric_id:null,review_status:"corrected"},
    {fabric_id:"",review_status:"approved"},
  ],50);
  assert.equal(summary.reviewedFabrics,0);
  assert.equal(summary.pendingFabrics,0);
  assert.equal(summary.stockBoundProfiles,1);
  assert.equal(summary.remaining,50);
});
