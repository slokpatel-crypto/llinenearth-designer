import assert from "node:assert/strict";
import test from "node:test";
import {
  parseGarmentPatternSamples,
  parseGarmentLatencySamples,
  parseGarmentRealismAssessments,
  parseMeasuredScaleInput,
  parseCalibratedScaleInput,
  normalizeGarmentViewerEvidenceForStorage,
} from "../src/lib/garment-viewer-evidence-validation.ts";

const measured=(overrides={})=>({
  fabricId:"stripe-real",pattern:"stripe",verified:true,
  repeatMm:20,observedRepeatPx:104.1,referenceMm:100,referencePx:500,
  physicalEvidenceNote:"Fabric ruler and render calibration verified",errorPct:4.1,
  ...overrides,
});

test("physical-scale evidence requires noncoerced raw measurement dimensions",()=>{
  for(const invalid of [null,"",false,"4",0,-1,Infinity,NaN,5001]){
    for(const key of ["repeatMm","referenceMm"]){
      assert.deepEqual(parseGarmentPatternSamples([measured({[key]:invalid})]),[],key+" "+String(invalid));
    }
  }
  for(const invalid of [null,"",false,"4",0,-1,Infinity,NaN,20001]){
    for(const key of ["observedRepeatPx","referencePx"]){
      assert.deepEqual(parseGarmentPatternSamples([measured({[key]:invalid})]),[],key+" "+String(invalid));
    }
  }
  assert.deepEqual(parseGarmentPatternSamples([measured({physicalEvidenceNote:"unverified"})]),[]);
});

test("operator-claimed scale error cannot override recomputed physical ratio",()=>{
  const [sample]=parseGarmentPatternSamples([measured({errorPct:0})]);
  assert.equal(sample.errorPct,4.1);
  assert.equal(sample.verified,true);
  const [perfect]=parseGarmentPatternSamples([measured({observedRepeatPx:100,errorPct:20})]);
  assert.equal(perfect.errorPct,0);
  assert.deepEqual(parseGarmentPatternSamples([measured({observedRepeatPx:118,errorPct:0})])[0].errorPct,18);
  assert.equal(parseGarmentPatternSamples([measured({observedRepeatPx:108.004})])[0].errorPct,8); // display is rounded only
  assert.deepEqual(parseGarmentPatternSamples([measured({errorPct:"0"})]),[]);
  assert.deepEqual(parseGarmentPatternSamples([measured({errorPct:null})]),[]);
  assert.deepEqual(parseGarmentPatternSamples([measured({observedRepeatPx:300})]),[]);
});

test("legacy percentage-only evidence cannot count as physical verification",()=>{
  assert.deepEqual(parseGarmentPatternSamples([{
    fabricId:"stripe-real",pattern:"stripe",errorPct:0,verified:true,
  }]),[]);
  assert.deepEqual(parseGarmentPatternSamples([{
    fabricId:"stripe-real",pattern:"stripe",errorPct:0,verified:false,
  }]),[{fabricId:"stripe-real",pattern:"stripe",errorPct:0,verified:false}]);
  assert.deepEqual(parseMeasuredScaleInput("cloth","0","stripe",true),{
    fabricId:"cloth",pattern:"stripe",errorPct:0,verified:false,
  });
});

test("calibrated UI input requires every dimension and a source note",()=>{
  for(const text of [""," ","NaN","Infinity","0x10","-1","0"]){
    assert.equal(parseCalibratedScaleInput("cloth","stripe",text,"100","100","500","Measured source photograph",true),null);
  }
  assert.equal(parseCalibratedScaleInput("cloth","stripe","20","104.1","100","500","short",true),null);
  assert.deepEqual(parseCalibratedScaleInput(" cloth ","stripe","20","104.1","100","500","Measured source photograph",true),{
    fabricId:"cloth",pattern:"stripe",errorPct:4.1,verified:true,
    repeatMm:20,observedRepeatPx:104.1,referenceMm:100,referencePx:500,
    physicalEvidenceNote:"Measured source photograph",
  });
});

test("fake latency observations cannot make up twelve real samples",()=>{
  const fake=[null,"",false,"4",0,-1,Infinity,NaN,10001];
  assert.deepEqual(parseGarmentLatencySamples([...fake,23.5,100]),[23.5,100]);
  assert.equal(parseGarmentLatencySamples(Array(12).fill(null)).length,0);
});

test("realism ratings must be measured numeric integers, not coerced values",()=>{
  const rows=[
    {viewerId:"VIEWER-1",rating:4},
    {viewerId:"v2",rating:"5"},
    {viewerId:"v3",rating:4.4},
    {viewerId:"v4",rating:null},
    {viewerId:"v5",rating:5},
  ];
  assert.deepEqual(parseGarmentRealismAssessments(rows),[
    {viewerId:"viewer-1",rating:4,recordedAt:""},
    {viewerId:"v5",rating:5,recordedAt:""},
  ]);
});

test("operator event normalizes calibrated ratios and filters fake observations",()=>{
  const result=normalizeGarmentViewerEvidenceForStorage({
    patternScaleSamples:[
      measured({errorPct:null}),
      measured({fabricId:"check-b",pattern:"check",observedRepeatPx:102.678,errorPct:0}),
    ],
    interactionLatencyMs:[null,false,"1",0,0.02,17.86,88],
    realismAssessments:[{viewerId:"v1",rating:"5"},{viewerId:"v2",rating:5}],
  });
  assert.deepEqual(result,{
    patternScaleSamples:[measured({fabricId:"check-b",pattern:"check",observedRepeatPx:102.678,errorPct:2.68})],
    interactionLatencyMs:[17.9,88],
    realismAssessments:[{viewerId:"v2",rating:5,recordedAt:""}],
  });
});
