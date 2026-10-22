import { garmentViewerTechnicalEvidenceReady } from "../src/lib/garment-viewer-readiness.ts";
import assert from "node:assert/strict";
import test from "node:test";
import {
  parseGarmentPatternSamples,
  parseGarmentLatencySamples,
  parseGarmentRealismAssessments,
  parseMeasuredScaleInput,
  normalizeGarmentViewerEvidenceForStorage,
  readGarmentViewerScopedCache,
  garmentRealismSubmissionIsLossless,
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

test("scoped QA cache rejects all present-but-malformed rows without inventing an empty pass",()=>{
  const assetKey="LE-OFFICEWEAR-V1:"+"a".repeat(64)+":"+"b".repeat(64);
  const latencyKey="linen-earth-garment-viewer-latency-v1";
  const ratingKey="linen-earth-garment-viewer-realism-v1";
  const read=(raw,key=latencyKey)=>readGarmentViewerScopedCache(raw,key,assetKey,[]);
  assert.deepEqual(read(null),[],"absent cache is an empty observation");
  for(const raw of [""," ","null","false","0","[]","\"empty\"","{}",
    JSON.stringify({samples:[100]}),JSON.stringify({assetKey:null,samples:[100]}),
    JSON.stringify({assetKey,samples:null}),"{broken"]){
    assert.equal(read(raw),null,raw);
  }
  assert.deepEqual(read(JSON.stringify({assetKey,samples:[0.02,299.96]})),[0.02,299.96]);
  assert.deepEqual(read(JSON.stringify({assetKey:"obsolete-model",samples:[999]})),[]);
  assert.equal(read(JSON.stringify({assetKey,value:[]})),null);
  assert.equal(read(JSON.stringify({assetKey,samples:[]}),ratingKey),null);
  assert.deepEqual(read(JSON.stringify({assetKey,value:[{viewerId:"v-01",rating:4}]}),ratingKey),
    [{viewerId:"v-01",rating:4}]);
  assert.equal(read(JSON.stringify({assetKey,value:null}),ratingKey),null);
  assert.equal(read(JSON.stringify({assetKey,value:[]}),"other-key"),null);
});

test("3D operator QA rejects visually confusable reviewer identities before storing or rating",()=>{
  const legitimate=[{viewerId:"VIEWER-01",rating:5}];
  assert.equal(garmentRealismSubmissionIsLossless(legitimate),true);
  for(const viewerId of [
    "viewer-01\u200b","viewer\u2060-01","viewer 01","v\u0131ewer-01",
    "viewer-01\u0000","viewer-01\u0301",
  ]){
    const forged=[{viewerId,rating:5}];
    assert.equal(garmentRealismSubmissionIsLossless(forged),false,JSON.stringify(viewerId));
    assert.deepEqual(parseGarmentRealismAssessments(forged),[],JSON.stringify(viewerId));
  }
  assert.equal(garmentRealismSubmissionIsLossless([
    {viewerId:"Viewer-01",rating:5},{viewerId:"viewer-01",rating:5},
  ]),false,"letter casing cannot create an independent viewer");
});

test("3D technical acceptance cannot pass with only an operator checkbox",()=>{
  const stripeProof={...stripe,errorPct:4};
  const checkProof={...stripeProof,fabricId:"check-real",pattern:"check",renderedRepeatPx:200,errorPct:0};
  const complete={
    patternScaleSamples:[stripeProof,checkProof],
    interactionLatencyMs:Array(12).fill(100),
    realismAssessments:Array.from({length:8},(_,i)=>({
      viewerId:"independent-"+i,rating:i<6?5:3,
    })),
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  };
  assert.equal(garmentViewerTechnicalEvidenceReady(complete),true);
  for(const altered of [
    {...complete,patternScaleSamples:[]},
    {...complete,patternScaleSamples:[stripeProof,{...stripeProof,pattern:"check"}]},
    {...complete,patternScaleSamples:[{...stripeProof,renderedRepeatPx:260},checkProof]},
    {...complete,interactionLatencyMs:Array(11).fill(100)},
    {...complete,interactionLatencyMs:Array(12).fill(300)},
    {...complete,realismAssessments:complete.realismAssessments.slice(0,7)},
    {...complete,realismAssessments:complete.realismAssessments.map((row,i)=>({...row,rating:i<5?5:3}))},
    {...complete,boundaryChecks:{...complete.boundaryChecks,trouserGap:false}},
  ]) assert.equal(garmentViewerTechnicalEvidenceReady(altered),false,JSON.stringify(altered));
});

test("3D accepted technical events require complete proof on both server and operator UI",async()=>{
  const {readFileSync}=await import("node:fs");
  const server=readFileSync("src/app/api/memory/event/route.ts","utf8");
  const form=readFileSync("src/app/operator/garment-viewer/GarmentViewerEvidenceForm.tsx","utf8");
  assert.match(server,/status==="accepted"&&!garmentViewerTechnicalEvidenceReady/);
  assert.match(form,/acceptTechnicalEvidence&&!garmentViewerTechnicalEvidenceReady/);
  assert.match(form,/disabled=\{!technicalEvidenceReady\}/);
  assert.match(form,/Record QA for review/);
});
