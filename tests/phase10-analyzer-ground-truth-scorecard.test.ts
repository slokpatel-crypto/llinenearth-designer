import test from "node:test";
import assert from "node:assert/strict";
import { scoreFabricGroundTruth, type FabricGroundTruthLabel } from "../src/lib/fabric-ground-truth-scorecard.ts";

function label(fabricId:string,changes:Partial<Record<string,string>>={},at="2026-09-30T10:00:00Z"):FabricGroundTruthLabel{
  const original={
    colorFamily:"blue_family",
    patternFamily:"stripe",
    patternScale:"fine",
    patternDensity:"balanced",
    orientation:"vertical",
    sheen:"low",
    visualWeight:"medium-looking",
    formality:"4",
    statementLevel:"2",
  };
  return {
    fabricId,
    profileId:`profile-${fabricId}`,
    analyzerVersion:"fabric-analyzer-v4",
    original,
    final:{...original,...changes},
    note:"",
    at,
  };
}

test("scorecard reports exact and field agreement from owner labels",()=>{
  const score=scoreFabricGroundTruth([
    label("a"),
    label("b",{patternFamily:"check"}),
    label("c",{formality:"3",statementLevel:"3"}),
  ]);
  assert.equal(score.uniqueFabrics,3);
  assert.equal(score.exactProfileMatches,1);
  assert.equal(score.correctedFabrics,2);
  assert.equal(score.exactProfilePercent,33.3);
  assert.equal(score.fieldTotal,27);
  assert.equal(score.fieldMatches,24);
  assert.equal(score.fieldAgreementPercent,88.9);
  const pattern=score.perField.find((row)=>row.field==="patternFamily");
  assert.equal(pattern?.percent,66.7);
});

test("scorecard keeps only the newest label for each fabric",()=>{
  const score=scoreFabricGroundTruth([
    label("a",{patternFamily:"check"},"2026-09-30T09:00:00Z"),
    label("a",{},"2026-09-30T10:00:00Z"),
  ]);
  assert.equal(score.uniqueFabrics,1);
  assert.equal(score.exactProfilePercent,100);
});
