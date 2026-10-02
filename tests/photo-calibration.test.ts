import assert from "node:assert/strict";
import test from "node:test";
import {
  customerPhotoCalibrationFromProofPayload,
  UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION,
} from "../src/lib/designer/photo-calibration.ts";

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
