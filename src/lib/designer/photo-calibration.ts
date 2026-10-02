import {
  PHASE1_PROOF_EVIDENCE_VERSION,
  PHASE1_PROOF_PHOTO_COORDINATE_SYSTEM,
  evaluateRecordedPhase1ProofEvidence,
} from "./proof-scale.ts";

export type CustomerPhotoCalibration={
  verified:boolean;
  photoPxPerMm:number|null;
  scaleCoordinateSystem:typeof PHASE1_PROOF_PHOTO_COORDINATE_SYSTEM|null;
  proofVersion:typeof PHASE1_PROOF_EVIDENCE_VERSION|null;
};

export const UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION:CustomerPhotoCalibration={
  verified:false,
  photoPxPerMm:null,
  scaleCoordinateSystem:null,
  proofVersion:null,
};

export function customerPhotoCalibrationFromProofPayload(payload:unknown):CustomerPhotoCalibration{
  if(!payload||typeof payload!=="object"||Array.isArray(payload)){
    return UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION;
  }
  const evidence=evaluateRecordedPhase1ProofEvidence(payload as Record<string,unknown>);
  const photoPxPerMm=Number(evidence.photoPxPerMm);
  const verified=
    evidence.version===PHASE1_PROOF_EVIDENCE_VERSION
    && evidence.coreAccepted===true
    && evidence.scaleGatePass===true
    && evidence.physicalEvidenceReady===true
    && evidence.boundaryReady===true
    && evidence.scaleCoordinateSystem===PHASE1_PROOF_PHOTO_COORDINATE_SYSTEM
    && Number.isFinite(photoPxPerMm)
    && photoPxPerMm>0;

  if(!verified) return UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION;

  return {
    verified:true,
    photoPxPerMm,
    scaleCoordinateSystem:PHASE1_PROOF_PHOTO_COORDINATE_SYSTEM,
    proofVersion:PHASE1_PROOF_EVIDENCE_VERSION,
  };
}
