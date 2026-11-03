import test from "node:test";
import assert from "node:assert/strict";
import { fabricGroundTruthStateFromProfile, isStockBoundFabricGroundTruthId, normalizeExplicitFabricGroundTruthState, reconstructOriginalFabricGroundTruthState, scoreFabricGroundTruth, type FabricGroundTruthLabel } from "../src/lib/fabric-ground-truth-scorecard.ts";

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

test("approved profile backfill is not a fabricated 100 percent accuracy match",()=>{
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
    eligibleForAccuracy:false,
  }]);
  assert.equal(score.uniqueFabrics,0);
  assert.equal(score.exactProfileMatches,0);
  assert.equal(score.exactProfilePercent,null);
  assert.equal(score.fieldAgreementPercent,null);
  assert.equal(score.fieldTotal,0);
});

test("corrected history is not independent truth for untouched fields",()=>{
  const corrected={...label("corrected",{patternFamily:"check"}),eligibleForAccuracy:false};
  const actual=scoreFabricGroundTruth([corrected]);
  assert.equal(actual.uniqueFabrics,0);
  assert.equal(actual.fieldTotal,0);
  assert.equal(actual.exactProfilePercent,null);
});

test("legacy owner labels remain eligible while synthetic backfills cannot displace them",()=>{
  const owner=label("a",{patternFamily:"check"},"2026-10-01T09:00:00Z");
  const synthetic={...label("a",{},"2026-10-02T09:00:00Z"),eligibleForAccuracy:false};
  const actual=scoreFabricGroundTruth([owner,synthetic]);
  assert.equal(actual.uniqueFabrics,1);
  assert.equal(actual.exactProfileMatches,0);
  assert.equal(actual.fieldMatches,8);
  assert.equal(actual.fieldTotal,9);
  assert.equal(actual.exactProfilePercent,0);
});


test("incomplete final labels are not counted as exact profile matches",()=>{
  const base=label("incomplete");
  base.original.colorFamily="";
  base.final.colorFamily="";
  const score=scoreFabricGroundTruth([base]);
  assert.equal(score.exactProfileMatches,0);
  assert.equal(score.exactProfilePercent,null);
  assert.equal(score.completeFabrics,0);
  assert.equal(score.incompleteFabrics,1);
  assert.equal(score.correctedFabrics,0);
  assert.equal(score.fieldTotal,8);
});

test("unknown analyzer field is not a false disagreement or correction",()=>{
  const incomplete=label("partial");
  incomplete.original.patternFamily="";
  const result=scoreFabricGroundTruth([incomplete]);
  assert.equal(result.uniqueFabrics,1);
  assert.equal(result.completeFabrics,0);
  assert.equal(result.exactProfileMatches,0);
  assert.equal(result.exactProfilePercent,null);
  assert.equal(result.correctedFabrics,0);
  assert.equal(result.fieldTotal,8);
  assert.equal(result.fieldMatches,8);
  assert.equal(result.fieldAgreementPercent,100);
});

test("a real correction in a partial label is counted without faking exact-profile accuracy",()=>{
  const incomplete=label("partial",{patternFamily:"check"});
  incomplete.original.colorFamily="";
  incomplete.final.colorFamily="";
  const result=scoreFabricGroundTruth([incomplete]);
  assert.equal(result.uniqueFabrics,1);
  assert.equal(result.completeFabrics,0);
  assert.equal(result.correctedFabrics,1);
  assert.equal(result.exactProfilePercent,null);
  assert.equal(result.fieldTotal,8);
  assert.equal(result.fieldMatches,7);
});

test("a mixture of complete and partial labels cannot publish a misleading exact-profile rate",()=>{
  const partial=label("partial");
  partial.original.colorFamily="";
  partial.final.colorFamily="";
  const result=scoreFabricGroundTruth([label("complete"),partial]);
  assert.equal(result.uniqueFabrics,2);
  assert.equal(result.completeFabrics,1);
  assert.equal(result.incompleteFabrics,1);
  assert.equal(result.exactProfileMatches,1);
  assert.equal(result.exactProfilePercent,null);
  assert.equal(result.correctedFabrics,0);
});

test("explicit owner labels reject JSON arrays, objects and oversized field literals",()=>{
  const valid=label("owner").original;
  assert.deepEqual(normalizeExplicitFabricGroundTruthState(valid),valid);
  for(const [field,value] of [
    ["patternFamily",["stripe"]],
    ["colorFamily",{id:"blue_family"}],
    ["patternScale",true],
    ["orientation",1],
    ["sheen"," ".repeat(81)+"low"],
    ["formality",Infinity],
    ["statementLevel","5".repeat(81)],
    ["formality","6"],
  ] as const){
    assert.equal(normalizeExplicitFabricGroundTruthState({...valid,[field]:value}),null,field);
  }
});

test("explicit labels may have unknown fields but require a real literal classification",()=>{
  assert.equal(normalizeExplicitFabricGroundTruthState({}),null);
  assert.equal(normalizeExplicitFabricGroundTruthState([]),null);
  assert.equal(normalizeExplicitFabricGroundTruthState(null),null);
  const accepted=normalizeExplicitFabricGroundTruthState({
    patternFamily:" stripe ",formality:4,statementLevel:"2",
  });
  assert.equal(accepted?.patternFamily,"stripe");
  assert.equal(accepted?.formality,"4");
  assert.equal(accepted?.statementLevel,"2");
  assert.equal(accepted?.colorFamily,"");
});

test("benchmark only admits exact active stock fabric IDs, never unrelated operator notes",()=>{
  const active=new Set(["linen-plain-60-sky-blue","linen-print-60-01"]);
  assert.equal(isStockBoundFabricGroundTruthId("linen-plain-60-sky-blue",active),true);
  for(const bad of [
    "made-up-lot-007","linen-plain-60-sky-blue ", "linen-plain-60-sky",
    ["linen-plain-60-sky-blue"],{id:"linen-plain-60-sky-blue"},null,undefined,0,"",
  ]){
    assert.equal(isStockBoundFabricGroundTruthId(bad,active),false,String(bad));
  }
  const incoming=[
    label("linen-plain-60-sky-blue"),
    label("made-up-lot-007"),
    label("linen-print-60-01",{patternFamily:"check"}),
  ];
  const eligible=incoming.filter((item)=>isStockBoundFabricGroundTruthId(item.fabricId,active));
  const score=scoreFabricGroundTruth(eligible);
  assert.equal(score.uniqueFabrics,2);
  assert.equal(score.exactProfileMatches,1);
  assert.equal(score.correctedFabrics,1);
});
