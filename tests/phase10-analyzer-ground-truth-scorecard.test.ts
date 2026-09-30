import test from "node:test";
import assert from "node:assert/strict";
import { fabricGroundTruthStateFromProfile, reconstructOriginalFabricGroundTruthState, scoreFabricGroundTruth, type FabricGroundTruthLabel } from "../src/lib/fabric-ground-truth-scorecard.ts";

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


test("reviewed profile history can reconstruct the pre-correction Analyzer state",()=>{
  const final=fabricGroundTruthStateFromProfile({
    observed:{
      colorFamily:"blue_family",
      patternFamily:"check",
      patternScale:"fine",
      patternDensity:"balanced",
      orientation:"vertical",
      sheen:"low",
      visualWeight:"medium-looking",
    },
    inferredStyle:{formality:3,statementLevel:2},
  });
  const original=reconstructOriginalFabricGroundTruthState(final,[
    {fieldPath:"observed.patternFamily",previousValue:"stripe"},
    {fieldPath:"inferredStyle.formality",previousValue:4},
    // A later edit to the same field must not overwrite the earliest original.
    {fieldPath:"inferredStyle.formality",previousValue:3},
  ]);
  assert.equal(final.patternFamily,"check");
  assert.equal(original.patternFamily,"stripe");
  assert.equal(final.formality,"3");
  assert.equal(original.formality,"4");
});

test("approved profile history becomes an exact owner match",()=>{
  const state=fabricGroundTruthStateFromProfile({
    observed:{
      colorFamily:"neutral_family",
      patternFamily:"solid",
      patternScale:"none",
      patternDensity:"none",
      orientation:"none",
      sheen:"matte",
      visualWeight:"light-looking",
    },
    inferredStyle:{formality:4,statementLevel:1},
  });
  const score=scoreFabricGroundTruth([{
    fabricId:"approved",
    profileId:"profile-approved",
    analyzerVersion:"fabric-analyzer-v4",
    original:{...state},
    final:{...state},
    note:"Backfilled approved profile.",
    at:"2026-09-30T11:00:00Z",
  }]);
  assert.equal(score.exactProfilePercent,100);
  assert.equal(score.fieldAgreementPercent,100);
});


test("incomplete final labels are not counted as exact profile matches",()=>{
  const base=label("incomplete");
  base.original.colorFamily="";
  base.final.colorFamily="";
  const score=scoreFabricGroundTruth([base]);
  assert.equal(score.exactProfileMatches,0);
  assert.equal(score.exactProfilePercent,0);
  assert.equal(score.fieldTotal,8);
});
