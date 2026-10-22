import assert from "node:assert/strict";
import test from "node:test";
import {
  parseGarmentPatternSamples,
  parseGarmentLatencySamples,
  parseGarmentRealismAssessments,
  parseMeasuredScaleInput,
  normalizeGarmentViewerEvidenceForStorage,
} from "../src/lib/garment-viewer-evidence-validation.ts";

const stripe={
  fabricId:"stripe-real",pattern:"stripe",verified:true,
  physicalRepeatMm:50,renderedRepeatPx:208,referenceLengthMm:100,
  referenceLengthPx:400,evidenceReference:"PHOTO-SCALE-STRIPE-001",
};

test("legacy claimed percentages are visible but cannot pass as verified calibration",()=>{
  const base={fabricId:"old-stripe",pattern:"stripe",verified:true};
  assert.deepEqual(parseGarmentPatternSamples([{...base,errorPct:0}]),
    [{...base,errorPct:0,verified:false}]);
  for(const invalid of [null,"","0",false,true,undefined,NaN,Infinity,-1,101]){
    assert.deepEqual(parseGarmentPatternSamples([{...base,errorPct:invalid}]),[]);
  }
});

test("calculated physical repeat error cannot be forged using a submitted percentage",()=>{
  assert.deepEqual(parseGarmentPatternSamples([{...stripe,errorPct:0}]),[
    {...stripe,errorPct:4},
  ]);
  assert.deepEqual(parseGarmentPatternSamples([{...stripe,errorPct:99}]),[
    {...stripe,errorPct:4},
  ]);
});

test("invalid physical evidence never produces verified samples",()=>{
  const bad=[
    {physicalRepeatMm:null},{physicalRepeatMm:"50"},{physicalRepeatMm:0},
    {renderedRepeatPx:"208"},{renderedRepeatPx:0},
    {referenceLengthMm:0},{referenceLengthPx:false},
    {evidenceReference:""},{evidenceReference:"no"},
  ];
  for(const patch of bad){
    const parsed=parseGarmentPatternSamples([{...stripe,...patch,errorPct:0}]);
    assert.equal(parsed.length,1);
    assert.equal(parsed[0].verified,false);
  }
});

test("physical input derives a percent from original calibration rather than accepting error",()=>{
  const args=[" linen-01 ","50","208","100","400","PHOTO-STRIPE-01","stripe",true];
  assert.deepEqual(parseMeasuredScaleInput(...args),{
    fabricId:"linen-01",pattern:"stripe",errorPct:4,verified:true,
    physicalRepeatMm:50,renderedRepeatPx:208,referenceLengthMm:100,
    referenceLengthPx:400,evidenceReference:"PHOTO-STRIPE-01",
  });
  for(const invalid of [""," ","NaN","Infinity","0x0","-0.0","0", "1e1000"]){
    assert.equal(parseMeasuredScaleInput("cloth",invalid,"208","100","400","photo-123456","stripe",true),null);
  }
  assert.equal(parseMeasuredScaleInput("cloth","50","208","100","400","", "stripe",true),null);
});

test("calibrated scale greater than 100 percent remains a measured failure",()=>{
  assert.deepEqual(parseGarmentPatternSamples([{...stripe,renderedRepeatPx:500,errorPct:0}]),[
    {...stripe,renderedRepeatPx:500,errorPct:150},
  ]);
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

test("operator-event canonicalizer retains traceable calibration and drops fake measurements",()=>{
  const result=normalizeGarmentViewerEvidenceForStorage({
    patternScaleSamples:[
      {fabricId:"stripe-a",pattern:"stripe",errorPct:null,verified:true},
      {...stripe,errorPct:0},
    ],
    interactionLatencyMs:[null,false,"1",0,0.02,17.86,88],
    realismAssessments:[{viewerId:"v1",rating:"5"},{viewerId:"v2",rating:5}],
  });
  assert.deepEqual(result,{
    patternScaleSamples:[{...stripe,errorPct:4}],
    interactionLatencyMs:[0.02,17.86,88],
    realismAssessments:[{viewerId:"v2",rating:5,recordedAt:""}],
  });
});


const calibration={fabricId:"cloth",pattern:"stripe",errorPct:0,verified:true,
  physicalRepeatMm:10,renderedRepeatPx:108.004,referenceLengthMm:100,referenceLengthPx:1000,evidenceReference:"measurement-fixture"};

test("calibrated measurements survive storage and reload without rounding a failure into a pass",()=>{
  const stored=normalizeGarmentViewerEvidenceForStorage({patternScaleSamples:[calibration]});
  const reloaded=parseGarmentPatternSamples(JSON.parse(JSON.stringify(stored)).patternScaleSamples);
  assert.deepEqual(reloaded,stored.patternScaleSamples);
  assert.equal(reloaded.length,1);
  assert.equal(reloaded[0].errorPct,8); // Display rounding does not change stored dimensions.
  assert.equal(reloaded[0].verified,true);
  for(const field of ["physicalRepeatMm","renderedRepeatPx","referenceLengthMm","referenceLengthPx","evidenceReference"]){
    assert.equal(reloaded[0][field],calibration[field]);
  }
});

test("severe measured errors stay auditable through ingestion and reload",()=>{
  const severe={...calibration,renderedRepeatPx:301};
  const stored=normalizeGarmentViewerEvidenceForStorage({patternScaleSamples:[severe]});
  const reloaded=parseGarmentPatternSamples(JSON.parse(JSON.stringify(stored)).patternScaleSamples);
  assert.equal(reloaded.length,1);
  assert.ok(Math.abs(reloaded[0].errorPct-201)<1e-10);
  assert.equal(reloaded[0].verified,true);
});

test("invalid JSON calibration dimensions revoke verification rather than trusting a claimed zero",()=>{
  for(const field of ["physicalRepeatMm","renderedRepeatPx","referenceLengthMm","referenceLengthPx"]){
    for(const invalid of [null,"10",false,0,-1,NaN,Infinity,undefined]){
      const [result]=parseGarmentPatternSamples([{...calibration,[field]:invalid}]);
      assert.equal(result.verified,false,`${field}: ${String(invalid)}`);
    }
  }
});


test("extreme finite measured errors cannot overflow display rounding during JSON storage",()=>{
  const stored=normalizeGarmentViewerEvidenceForStorage({patternScaleSamples:[{...calibration,physicalRepeatMm:1e-305,renderedRepeatPx:100}]});
  assert.equal(stored.patternScaleSamples.length,1);
  assert.ok(Number.isFinite(stored.patternScaleSamples[0].errorPct));
  assert.ok(stored.patternScaleSamples[0].errorPct>100);
  assert.deepEqual(parseGarmentPatternSamples(JSON.parse(JSON.stringify(stored)).patternScaleSamples),stored.patternScaleSamples);
});
