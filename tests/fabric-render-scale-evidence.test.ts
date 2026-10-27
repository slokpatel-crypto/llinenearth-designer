import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { approvedFabricTileScaleEvidence } from "../src/lib/fabric-render-scale-evidence.ts";

const physicalEvidence={
  sourceType:"owner_measurement",reference:"Roll ledger 24",checkedBy:"Operator Reviewer",
  evidenceDate:"2026-10-28",
};

test("documented build-time scale retains numeric measurements and provenance",()=>{
  assert.deepEqual(approvedFabricTileScaleEvidence({
    swatchRealWidthMm:120,repeatRealMm:15,physicalEvidence,
  }),{swatchRealWidthMm:120,repeatRealMm:15,physicalEvidence});
  assert.deepEqual(approvedFabricTileScaleEvidence({
    repeatRealMm:15,physicalEvidence,
  }),{repeatRealMm:15,physicalEvidence});
});

test("undocumented or malformed build-time scale never certifies a tile",()=>{
  for(const bad of [undefined,null,{},[],true,"120",{swatchRealWidthMm:120},
    {repeatRealMm:15},{physicalEvidence},{swatchRealWidthMm:120,physicalEvidence:{...physicalEvidence,checkedBy:""}},
  ]) assert.equal(approvedFabricTileScaleEvidence(bad),null);
  for(const invalid of ["120",true,false,0,-1,5001,Number.NaN,Number.POSITIVE_INFINITY,{}]){
    assert.equal(approvedFabricTileScaleEvidence({
      swatchRealWidthMm:invalid,repeatRealMm:15,physicalEvidence,
    }),null);
    assert.equal(approvedFabricTileScaleEvidence({
      swatchRealWidthMm:120,repeatRealMm:invalid,physicalEvidence,
    }),null);
  }
});

test("tile builder consumes approved evidence and never reads raw JSON numbers directly",()=>{
  const builder=readFileSync("scripts/build-fabric-render-assets.mjs","utf8");
  assert.match(builder,/approvedFabricTileScaleEvidence\(declared\[stem\]\)/);
  assert.doesNotMatch(builder,/Number\(scale\.(?:repeatRealMm|swatchRealWidthMm)\)/);
});
