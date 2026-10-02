import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { customerPhotoCalibrationFromProofPayload } from "../src/lib/designer/photo-calibration.ts";
import { UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION } from "../src/lib/designer/photo-calibration-types.ts";

function acceptedPayload(){
  return {
    subtype:"roadmap_phase1_proof",
    version:"linen-earth-phase1-proof-v4",
    repeatMm:50,
    measuredPreviewRepeatPx:40,
    photoReferenceMm:100,
    photoReferencePx:80,
    scaleCoordinateSystem:"photo-1024x1536-fixture",
    physicalEvidenceNote:"Owner measured the photographed fixture and fabric repeat with a ruler.",
    realModelSampleDurationsMs:Array.from({length:12},()=>120),
    realismAssessments:Array.from({length:8},(_,index)=>({
      viewerId:`viewer-${index+1}`,
      rating:index<6?5:4,
      recordedAt:"2026-10-02T12:00:00Z",
    })),
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  };
}

test("accepted Phase 1 proof publishes only the safe photo calibration",()=>{
  const calibration=customerPhotoCalibrationFromProofPayload(acceptedPayload());
  assert.deepEqual(calibration,{
    verified:true,
    photoPxPerMm:.8,
    scaleCoordinateSystem:"photo-1024x1536-fixture",
    proofVersion:"linen-earth-phase1-proof-v4",
  });
  assert.deepEqual(Object.keys(calibration).sort(),[
    "photoPxPerMm","proofVersion","scaleCoordinateSystem","verified",
  ]);
});

test("review-state proof cannot activate customer photo calibration",()=>{
  const payload=acceptedPayload();
  payload.boundaryChecks={neck:true,cuffs:true,waist:true,trouserGap:false};
  assert.deepEqual(
    customerPhotoCalibrationFromProofPayload(payload),
    UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION,
  );
});

test("missing physical provenance cannot publish photo calibration",()=>{
  const payload=acceptedPayload();
  payload.physicalEvidenceNote="";
  assert.deepEqual(
    customerPhotoCalibrationFromProofPayload(payload),
    UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION,
  );
});

test("wrong coordinate system cannot publish photo calibration",()=>{
  const payload=acceptedPayload();
  payload.scaleCoordinateSystem="legacy-photo-space";
  assert.deepEqual(
    customerPhotoCalibrationFromProofPayload(payload),
    UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION,
  );
});

test("missing proof fails closed",()=>{
  assert.deepEqual(
    customerPhotoCalibrationFromProofPayload(null),
    UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION,
  );
});


test("public photo-calibration route exposes no operator proof notes or viewer data",()=>{
  const route=readFileSync("src/app/api/designer/photo-calibration/route.ts","utf8");
  const server=readFileSync("src/lib/designer/phase1-proof-server.ts","utf8");
  const browserContract=readFileSync("src/lib/designer/photo-calibration-types.ts","utf8");
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const client=readFileSync("src/lib/designer/photo-calibration-client.ts","utf8");
  assert.match(server,/import "server-only"/);
  assert.doesNotMatch(browserContract,/proof-scale|evaluateRecordedPhase1ProofEvidence|physicalEvidenceNote|realismAssessments/);
  assert.match(route,/customerPhotoCalibrationFromProofPayload/);
  assert.doesNotMatch(route,/physicalEvidenceNote|realismAssessments|viewerId|strongRatings/);
  assert.match(client,/\/api\/designer\/photo-calibration/);
  assert.match(client,/photo-1024x1536-fixture/);
  assert.match(client,/linen-earth-phase1-proof-v4/);
  assert.match(preview,/photoPxPerMm:verifiedPhotoPxPerMm/);
  assert.match(preview,/accepted studio calibration/);
});


test("customer preview refreshes proof-backed calibration after returning to the tab",()=>{
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const client=readFileSync("src/lib/designer/photo-calibration-client.ts","utf8");
  assert.match(client,/\.finally\(\(\)=>\{customerPhotoCalibrationRequest=null;\}\)/);
  assert.match(preview,/window\.addEventListener\("focus",refresh\)/);
  assert.match(preview,/document\.addEventListener\("visibilitychange",onVisibility\)/);
  assert.match(preview,/document\.visibilityState==="visible"/);
  assert.match(preview,/window\.removeEventListener\("focus",refresh\)/);
  assert.match(preview,/document\.removeEventListener\("visibilitychange",onVisibility\)/);
});


test("changing proof-backed calibration invalidates the locked final render signature",()=>{
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(preview,/photoCalibration:photoCalibration\.verified \? \{/);
  assert.match(preview,/photoPxPerMm:verifiedPhotoPxPerMm/);
  assert.match(preview,/scaleCoordinateSystem:photoCalibration\.scaleCoordinateSystem/);
  assert.match(preview,/proofVersion:photoCalibration\.proofVersion/);
  assert.match(preview,/\} : \{verified:false\}/);
  assert.match(preview,/setFinalLocked\(false\)/);
  assert.match(preview,/selectedLookSessionCache\.get\(renderSignature\)/);
});


test("Style Director invalidates a generated photoreal when accepted photo calibration changes",()=>{
  const page=readFileSync("src/app/style-director/page.tsx","utf8");
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const client=readFileSync("src/lib/designer/photo-calibration-client.ts","utf8");

  assert.match(client,/export function customerPhotoCalibrationIdentity/);
  assert.match(page,/currentCalibrationIdentity/);
  assert.match(page,/lockedPreviewCalibrationIdentity/);
  assert.match(page,/renderCalibrationIdentity/);
  assert.match(page,/fetchCustomerPhotoCalibration/);
  assert.match(page,/renderCalibrationIdentity!==currentCalibrationIdentity/);
  assert.match(page,/setRenderSet\(null\)/);
  assert.match(page,/setLockedPreviewImage\(""\)/);
  assert.match(page,/function acceptLockedPreview\(dataUrl:string,calibrationIdentity:string\)/);
  assert.match(page,/setRenderCalibrationIdentity\(sourceCalibrationIdentity\)/);
  assert.match(preview,/resolvedCalibrationIdentity/);
  assert.match(preview,/onPreviewReadyRef\.current\(canvas\.toDataURL\("image\/jpeg",\.92\),resolvedCalibrationIdentity\)/);
});
