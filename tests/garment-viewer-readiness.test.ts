import {readFileSync} from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { garmentPatternSubmissionIsLossless, garmentLatencySubmissionIsLossless, garmentRealismSubmissionIsLossless, normalizeGarmentViewerEvidenceForStorage, parseGarmentPatternSamples, parseMeasuredScaleInput } from "../src/lib/garment-viewer-evidence-validation.ts";
import { garmentViewerAssetIdentityKey, garmentViewerAssetIdentityMatches, garmentViewerPromotionReadiness, garmentViewerScaleAudit, type GarmentViewerPromotionInput } from "../src/lib/garment-viewer-readiness.ts";
import {
  GARMENT_VIEWER_CONTRACT_VERSION,
  REQUIRED_GARMENT_VIEWER_MATERIALS,
  validateGarmentViewerModelContract,
  validateGarmentViewerModelManifest,
} from "../src/lib/garment-viewer-model-contract.ts";
import { LINEN_EARTH_MODEL_IDENTITY_ID, LINEN_EARTH_MODEL_REFERENCE_IMAGE } from "../src/lib/designer/model-identity.ts";

const PHYSICAL_TARGETS={
  height:1727,
  shoulderSeamWidth:388,
  outerArmSilhouette:574,
  shirtWaistWidth:294,
  trouserWaistWidth:344,
  handCenterSpacing:500,
  legCenterSpacing:210,
  hemWidth:64,
};

const contract=validateGarmentViewerModelContract({
  modelId:"LE-OFFICEWEAR-V1",
  materialNames:[...REQUIRED_GARMENT_VIEWER_MATERIALS],
});
const manifest=validateGarmentViewerModelManifest({
  version:GARMENT_VIEWER_CONTRACT_VERSION,
  modelId:"LE-OFFICEWEAR-V1",
  referenceHeightMm:1727,
  modelIdentity:{id:LINEN_EARTH_MODEL_IDENTITY_ID,referenceImage:LINEN_EARTH_MODEL_REFERENCE_IMAGE,physicalTargetsMm:PHYSICAL_TARGETS},
  source:{name:"Blender Human Base Meshes",license:"CC0",verifiedAt:"2026-10-05"},
  panels:Object.fromEntries(REQUIRED_GARMENT_VIEWER_MATERIALS.map((name)=>[name,{widthMm:300,heightMm:600}])),
},"LE-OFFICEWEAR-V1");

function passingInput():GarmentViewerPromotionInput {
  return {
    contract,
    manifest,
    patternScaleSamples:[
      {fabricId:"stripe-a",pattern:"stripe" as const,errorPct:4.1,verified:true,physicalRepeatMm:50,renderedRepeatPx:208.2,referenceLengthMm:100,referenceLengthPx:400,evidenceReference:"photo-stripe-physical-001"},
      {fabricId:"check-b",pattern:"check" as const,errorPct:6.4,verified:true,physicalRepeatMm:40,renderedRepeatPx:212.8,referenceLengthMm:100,referenceLengthPx:500,evidenceReference:"photo-check-physical-001"},
    ],
    interactionLatencyMs:[110,120,105,130,125,115,118,122,109,111,126,128],
    realismAssessments:Array.from({length:8},(_,index)=>({
      viewerId:`viewer-${index+1}`,
      rating:index<6?4:3,
    })),
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  };
}

test("production GarmentViewer can only promote when every realism and physical gate passes",()=>{
  const result=garmentViewerPromotionReadiness(passingInput());
  assert.equal(result.ready,true);
  assert.equal(result.contractReady,true);
  assert.equal(result.manifestReady,true);
  assert.equal(result.scaleReady,true);
  assert.equal(result.latencyReady,true);
  assert.equal(result.realismReady,true);
  assert.equal(result.boundaryReady,true);
  assert.deepEqual(result.reasons,[]);
});

test("prototype or invalid model contract blocks promotion",()=>{
  const input=passingInput();
  input.contract=validateGarmentViewerModelContract({
    modelId:"LE-GARMENT-M1",
    materialNames:[...REQUIRED_GARMENT_VIEWER_MATERIALS],
  });
  const result=garmentViewerPromotionReadiness(input);
  assert.equal(result.ready,false);
  assert.equal(result.contractReady,false);
});

test("scale gate requires both verified stripe and check samples within eight percent",()=>{
  const missingCheck=passingInput();
  missingCheck.patternScaleSamples=missingCheck.patternScaleSamples.slice(0,1);
  assert.equal(garmentViewerPromotionReadiness(missingCheck).scaleReady,false);

  const drift=passingInput();
  drift.patternScaleSamples[1].renderedRepeatPx=218;
  assert.equal(garmentViewerPromotionReadiness(drift).scaleReady,false);
});

test("scale gate requires stripe and check measurements from distinct fabric subjects",()=>{
  const input=passingInput();
  input.patternScaleSamples[1].fabricId=input.patternScaleSamples[0].fabricId;
  const result=garmentViewerPromotionReadiness(input);
  assert.equal(result.scaleSamples.length,2);
  assert.equal(result.scaleReady,false);
  assert.match(result.reasons.join(" "),/Distinct stripe and check fabric samples/);
});

test("case-only fabric aliases cannot count as two independent physical subjects",()=>{
  const input=passingInput();
  input.patternScaleSamples[1].fabricId="STRIPE-A";
  const readiness=garmentViewerPromotionReadiness(input);
  assert.equal(readiness.scaleAudit.length,2);
  assert.equal(readiness.scaleAudit.every((row)=>row.passes),true);
  assert.equal(readiness.scaleReady,false);
  assert.equal(readiness.ready,false);
});

test("complete fabric identities are rejected instead of truncated into another subject",()=>{
  const overlong=`fabric-${"x".repeat(154)}`;
  assert.equal(overlong.length,161);
  const raw={...passingInput().patternScaleSamples[0],fabricId:overlong};
  assert.deepEqual(parseGarmentPatternSamples([raw]),[]);
  assert.equal(parseMeasuredScaleInput(overlong,"50","200","100","400","photo-stripe-physical-001","stripe",true),null);

  const input=passingInput();
  input.patternScaleSamples[0].fabricId=overlong;
  assert.equal(garmentViewerPromotionReadiness(input).scaleReady,false);
});

test("overlong evidence references cannot be truncated into calibrated proof",()=>{
  const raw={...passingInput().patternScaleSamples[0],evidenceReference:"e".repeat(241)};
  const parsed=parseGarmentPatternSamples([raw]);
  assert.equal(parsed.length,1);
  assert.equal(parsed[0].verified,false);
  assert.equal(parsed[0].evidenceReference,undefined);
});

test("claimed 0% cannot conceal measured mismatch or rescue legacy percent-only evidence",()=>{
  const misleading=passingInput();
  misleading.patternScaleSamples[1].renderedRepeatPx=220;
  misleading.patternScaleSamples[1].errorPct=0;
  assert.equal(garmentViewerPromotionReadiness(misleading).scaleReady,false);

  const legacy={...passingInput(),patternScaleSamples:[
    {fabricId:"old-stripe",pattern:"stripe" as const,errorPct:0,verified:true},
    {fabricId:"old-check",pattern:"check" as const,errorPct:0,verified:true},
  ]};
  assert.equal(garmentViewerPromotionReadiness(legacy).scaleReady,false);
});

test("physical drift just above 8% fails even when displayed percentage rounds to 8.00",()=>{
  const input=passingInput();
  input.patternScaleSamples[1].renderedRepeatPx=216.008; // 8.004% of expected 200px
  assert.equal(garmentViewerPromotionReadiness(input).scaleReady,false);
});

test("realism, latency and boundary evidence cannot be bypassed",()=>{
  const input=passingInput();
  input.interactionLatencyMs=[100,110];
  input.realismAssessments=[{viewerId:"one",rating:5}];
  input.boundaryChecks={neck:true,cuffs:true,waist:false,trouserGap:true};
  const result=garmentViewerPromotionReadiness(input);
  assert.equal(result.ready,false);
  assert.equal(result.latencyReady,false);
  assert.equal(result.realismReady,false);
  assert.equal(result.boundaryReady,false);
  assert(result.reasons.length>=3);
});


test("QA evidence identity is invalidated by any GLB or manifest revision",()=>{
  const current={modelId:"LE-OFFICEWEAR-V1",modelSha256:"a".repeat(64),manifestSha256:"b".repeat(64)};
  assert.equal(garmentViewerAssetIdentityMatches(current,{...current}),true);
  assert.equal(garmentViewerAssetIdentityMatches(current,{...current,modelSha256:"c".repeat(64)}),false);
  assert.equal(garmentViewerAssetIdentityMatches(current,{...current,manifestSha256:"d".repeat(64)}),false);
  assert.equal(garmentViewerAssetIdentityKey(current),`LE-OFFICEWEAR-V1:${"a".repeat(64)}:${"b".repeat(64)}`);
});


test("viewer late-load recovery is bounded by the original twenty-second loading contract",()=>{
  const source=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert.ok(source.includes("viewer.loaded || (viewer.model?.materials?.length||0)>0"));
  assert.ok(source.includes("if(attempt<160) readinessTimer=window.setTimeout(()=>recoverReadyState(attempt+1),125)"));
  assert.ok(source.includes("setModelReady(true);setProgress(1);setError(\"\")"));
  assert.ok(!source.includes("if(attempt<80) readinessTimer="));
});


test("calibrated scale gate applies exact tolerance before any display rounding",()=>{
  for(const [pixels,expected] of [[107.999,true],[108,true],[108.004,false],[108.1,false],[92,true],[91.999,false]] as const){
    const input=passingInput();
    input.patternScaleSamples=input.patternScaleSamples.map(sample=>({...sample,physicalRepeatMm:10,renderedRepeatPx:100,referenceLengthMm:100,referenceLengthPx:1000}));
    input.patternScaleSamples[1].renderedRepeatPx=pixels;
    input.patternScaleSamples[1].errorPct=0;
    assert.equal(garmentViewerPromotionReadiness(input).scaleReady,expected,`repeat ${pixels}px`);
  }
});

test("a severe measured failure is not removed from an otherwise passing calibration set",()=>{
  const input=passingInput();
    input.patternScaleSamples=input.patternScaleSamples.map(sample=>({...sample,physicalRepeatMm:10,renderedRepeatPx:100,referenceLengthMm:100,referenceLengthPx:1000}));
  input.patternScaleSamples.push({...input.patternScaleSamples[0],fabricId:"bad-stripe",renderedRepeatPx:301,errorPct:0});
  const result=garmentViewerPromotionReadiness(input);
  assert.equal(result.scaleSamples.length,3);
  assert.equal(result.scaleReady,false);
  assert.equal(result.ready,false);
});

test("legacy percentages and incomplete calibration cannot establish physical readiness",()=>{
  for(const field of ["physicalRepeatMm","renderedRepeatPx","referenceLengthMm","referenceLengthPx","evidenceReference"] as const){
    const input=passingInput();
    input.patternScaleSamples=input.patternScaleSamples.map(sample=>({...sample,physicalRepeatMm:10,renderedRepeatPx:100,referenceLengthMm:100,referenceLengthPx:1000}));
    delete input.patternScaleSamples[1][field];
    assert.equal(garmentViewerPromotionReadiness(input).scaleReady,false,field);
  }
  const input=passingInput();
    input.patternScaleSamples=input.patternScaleSamples.map(sample=>({...sample,physicalRepeatMm:10,renderedRepeatPx:100,referenceLengthMm:100,referenceLengthPx:1000}));
  input.patternScaleSamples=input.patternScaleSamples.map(({fabricId,pattern})=>({fabricId,pattern,errorPct:0,verified:true}));
  assert.equal(garmentViewerPromotionReadiness(input).scaleReady,false);
});

test("UI calibration evidence keeps the same gate outcome after ingestion, JSON storage and reload",()=>{
  for(const [repeat,expected] of [[100,true],[108,true],[108.004,false],[301,false]] as const){
    const input=passingInput();
    input.patternScaleSamples=input.patternScaleSamples.map(sample=>({...sample,physicalRepeatMm:10,renderedRepeatPx:100,referenceLengthMm:100,referenceLengthPx:1000}));
    input.patternScaleSamples[1].renderedRepeatPx=repeat;
    const stored=normalizeGarmentViewerEvidenceForStorage(input);
    const persisted=JSON.parse(JSON.stringify(stored));
    const reloaded={...input,...persisted,patternScaleSamples:parseGarmentPatternSamples(persisted.patternScaleSamples)};
    assert.equal(garmentViewerPromotionReadiness(reloaded).ready,expected,`${repeat}px persisted`);
    assert.equal(reloaded.patternScaleSamples.length,2);
  }
});

test("physical measurement audit displays exact calibrated error without trusting a forged percentage",()=>{
  const input=passingInput();
  input.patternScaleSamples[0].errorPct=0;
  input.patternScaleSamples[1].renderedRepeatPx=216.008; // 8.004%, not a passing 8.00%
  input.patternScaleSamples[1].errorPct=0;
  const audit=garmentViewerScaleAudit(input.patternScaleSamples);
  assert.equal(audit.length,2);
  assert.equal(audit[0].sample.physicalRepeatMm,50);
  assert.equal(audit[0].sample.referenceLengthMm,100);
  assert.equal(audit[0].sample.evidenceReference,"photo-stripe-physical-001");
  assert.ok(audit[0].measuredErrorPct!==null&&Math.abs(audit[0].measuredErrorPct-4.1)<1e-9);
  assert.equal(audit[0].passes,true);
  assert.ok(audit[1].measuredErrorPct!==null&&audit[1].measuredErrorPct>8);
  assert.equal(audit[1].passes,false);
  const result=garmentViewerPromotionReadiness(input);
  assert.deepEqual(result.scaleAudit,audit);
  assert.equal(result.scaleReady,false);
});

test("incomplete verified measurement stays visible in audit and blocks a passing set",()=>{
  const input=passingInput();
  input.patternScaleSamples.push({
    fabricId:"unverified-measurement",pattern:"stripe",verified:true,
    errorPct:0,physicalRepeatMm:100,renderedRepeatPx:100,
    referenceLengthMm:100,referenceLengthPx:100,
  });
  const result=garmentViewerPromotionReadiness(input);
  assert.equal(result.scaleAudit.length,3);
  assert.equal(result.scaleAudit[2].measuredErrorPct,null);
  assert.equal(result.scaleAudit[2].passes,false);
  assert.equal(result.scaleReady,false);
  assert.equal(result.ready,false);
});

test("legacy percentage-only claims appear as unverified audit, not a promotion pass",()=>{
  const rows=parseGarmentPatternSamples([{fabricId:"old-stripe",pattern:"stripe",errorPct:0,verified:true}]);
  const audit=garmentViewerScaleAudit(rows);
  assert.equal(audit.length,1);
  assert.equal(audit[0].sample.verified,false);
  assert.equal(audit[0].measuredErrorPct,null);
  assert.equal(audit[0].passes,false);
});

test("submitted QA evidence cannot hide malformed or formerly verified calibration samples",()=>{
  const originals=passingInput().patternScaleSamples;
  assert.equal(garmentPatternSubmissionIsLossless(originals),true);
  assert.equal(garmentPatternSubmissionIsLossless(undefined),true);
  assert.equal(garmentPatternSubmissionIsLossless([]),true);

  const verifiedBad=[
    {...originals[0],renderedRepeatPx:null},
    {...originals[0],evidenceReference:"x".repeat(241)},
    {...originals[0],evidenceReference:"short"},
    {...originals[0],fabricId:"x".repeat(161)},
    {...originals[0],pattern:"not-a-pattern"},
    {fabricId:"legacy-verified",pattern:"stripe",verified:true,errorPct:0},
  ];
  for(const bad of verifiedBad) {
    assert.equal(garmentPatternSubmissionIsLossless([...originals,bad]),false,JSON.stringify(bad));
  }
  assert.equal(garmentPatternSubmissionIsLossless("not-an-array"),false);
  assert.equal(garmentPatternSubmissionIsLossless([...originals, ...Array(19).fill(originals[0])]),false);
  assert.equal(garmentPatternSubmissionIsLossless([...originals, null]),false);

  const archival={fabricId:"legacy-unchecked",pattern:"other",verified:false,errorPct:5};
  assert.equal(garmentPatternSubmissionIsLossless([...originals,archival]),true);
  const stored=normalizeGarmentViewerEvidenceForStorage({patternScaleSamples:[...originals,archival]});
  assert.equal(stored.patternScaleSamples.length,3);
  assert.equal(stored.patternScaleSamples[2].verified,false);
});


test("new latency submissions retain slow and malformed measurements instead of losing them",()=>{
  const passing=passingInput().interactionLatencyMs;
  assert.equal(garmentLatencySubmissionIsLossless(passing),true);
  assert.equal(garmentLatencySubmissionIsLossless(undefined),true);
  assert.equal(garmentLatencySubmissionIsLossless([]),true);
  for(const failure of [null,false,"100",0,-1,10001,1e50,{}]){
    assert.equal(garmentLatencySubmissionIsLossless([...passing,failure]),false,String(failure));
  }
  assert.equal(garmentLatencySubmissionIsLossless("invalid"),false);
  assert.equal(garmentLatencySubmissionIsLossless(Array(121).fill(120)),false);
  assert.equal(garmentLatencySubmissionIsLossless(Array(120).fill(120)),true);
  assert.equal(garmentLatencySubmissionIsLossless([...passing,0.02]),true,"tiny positive observations remain valid when stored exactly");
});

test("QA storage preserves exact latency observations at threshold boundaries",()=>{
  const samples=[0.02,249.96,250.04,250.049,250.051,9999.999];
  assert.equal(garmentLatencySubmissionIsLossless(samples),true);
  const stored=normalizeGarmentViewerEvidenceForStorage({interactionLatencyMs:samples});
  assert.deepEqual(stored.interactionLatencyMs,samples);
  assert.deepEqual(JSON.parse(JSON.stringify(stored)).interactionLatencyMs,samples);
});

test("realism submissions cannot omit bad assessments or truncate viewer identities",()=>{
  const passing=passingInput().realismAssessments;
  assert.equal(garmentRealismSubmissionIsLossless(passing),true);
  assert.equal(garmentRealismSubmissionIsLossless(undefined),true);
  assert.equal(garmentRealismSubmissionIsLossless([]),true);
  assert.equal(garmentRealismSubmissionIsLossless("invalid"),false);
  for(const invalid of [
    null,{},false,{viewerId:"ok",rating:0},{viewerId:"ok",rating:6},
    {viewerId:"ok",rating:4.5},{viewerId:"ok",rating:"4"},
    {viewerId:"x".repeat(81),rating:5},{viewerId:"",rating:5},
    {viewerId:"ok",rating:5,recordedAt:"d".repeat(81)},
    {viewerId:"ok",rating:5,recordedAt:123},
  ]){
    assert.equal(garmentRealismSubmissionIsLossless([...passing,invalid]),false,JSON.stringify(invalid));
  }
  assert.equal(garmentRealismSubmissionIsLossless(Array(51).fill({viewerId:"valid",rating:5})),false);
  assert.equal(garmentRealismSubmissionIsLossless(Array(50).fill({viewerId:"valid",rating:5})),false);
  assert.equal(garmentRealismSubmissionIsLossless(Array.from({length:50},(_,i)=>({viewerId:`valid-${i}`,rating:5}))),true);
  assert.equal(garmentRealismSubmissionIsLossless([{viewerId:"  ViewER-1  ",rating:5}]),true);
  assert.equal(garmentRealismSubmissionIsLossless([...passing,{viewerId:" VIEWER-1 ",rating:5}]),false,
    "a later duplicate reviewer cannot silently replace an earlier negative rating");
});

test("operator 3D QA acceptance is deliberate and cannot be confused with release",()=>{
  const source=readFileSync("src/app/operator/garment-viewer/GarmentViewerEvidenceForm.tsx","utf8");
  assert.match(source,/\[acceptTechnicalEvidence,setAcceptTechnicalEvidence\]=useState\(false\)/);
  assert.match(source,/status:acceptTechnicalEvidence\?"accepted":"review"/);
  assert.match(source,/checked=\{acceptTechnicalEvidence\}/);
  assert.match(source,/NOT owner\/tailor approval/);
  assert.match(source,/Record QA for review/);
  assert.match(source,/garmentLatencySubmissionIsLossless\(savedLatencies\)/);
  assert.match(source,/garmentRealismSubmissionIsLossless\(savedRatings\)/);
  assert.match(source,/setLocalEvidenceCorrupt\(true\)/);
  assert.match(source,/Recording is locked/);
  const operatorPage=readFileSync("src/app/operator/garment-viewer/page.tsx","utf8");
  assert.match(operatorPage,/CUSTOMER PROMOTION GATE — TECHNICAL CHECKS ONLY/);
  assert.match(operatorPage,/owner and tailor sign-off/);
});


test("malformed local QA cache cannot silently turn into clean empty evidence",()=>{
  const source=readFileSync("src/app/operator/garment-viewer/GarmentViewerEvidenceForm.tsx","utf8");
  assert.ok(source.includes("readGarmentViewerScopedCache(localStorage.getItem(key),key,assetKey,fallback)"));
  assert.ok(source.includes("setLocalEvidenceCorrupt(!garmentLatencySubmissionIsLossless(savedLatencies)"));
  assert.ok(source.includes("Recording is locked"));
});

test("GarmentViewer p95 accepts sub-300ms exact timings but blocks values at or above 300ms",()=>{
  const justUnder=passingInput();
  justUnder.interactionLatencyMs=Array(12).fill(299.96);
  assert.equal(garmentViewerPromotionReadiness(justUnder).latencyReady,true);
  assert.equal(garmentViewerPromotionReadiness(justUnder).latency.p95Ms,299.96);
  const justOver=passingInput();
  justOver.interactionLatencyMs=Array(12).fill(300.04);
  assert.equal(garmentViewerPromotionReadiness(justOver).latencyReady,false);
});

test("operator QA submission requires a fresh review after local lab data changes",()=>{
  const source=readFileSync("src/app/operator/garment-viewer/GarmentViewerEvidenceForm.tsx","utf8");
  assert.match(source,/JSON.stringify\(currentLatencies\)!==JSON.stringify\(latencies\)/);
  assert.match(source,/JSON.stringify\(currentAssessments\)!==JSON.stringify\(assessments\)/);
  assert.match(source,/setAcceptTechnicalEvidence\(false\)/);
  assert.match(source,/interactionLatencyMs:currentLatencies/);
  assert.match(source,/realismAssessments:summarizeIndependentRealism\(currentAssessments\).assessments/);
  assert.ok(!source.includes("value:next.slice(-50)"),"ratings must not be silently truncated");
  assert.match(source,/garmentRealismSubmissionIsLossless\(next\)/);
});

test("a new garment asset revision cannot reuse prior accepted physical evidence",()=>{
  const source=readFileSync("src/app/operator/garment-viewer/GarmentViewerEvidenceForm.tsx","utf8");
  const refresh=source.slice(source.indexOf("function refreshLocalEvidence()"),source.indexOf("const latencySummary"));
  assert.match(refresh,/setAcceptTechnicalEvidence\(false\)/);
  assert.match(refresh,/setStripeFabricId\("")/);
  assert.match(refresh,/setCheckFabricId\("")/);
  assert.match(refresh,/setStripeVerified\(false\)/);
  assert.match(refresh,/setCheckVerified\(false\)/);
  assert.match(refresh,/setBoundaryChecks\(\{neck:false,cuffs:false,waist:false,trouserGap:false\}\)/);
  assert.match(refresh,/\},\[assetKey\]\)/);
});
