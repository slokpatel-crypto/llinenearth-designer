import { PHASE1_PROOF_EVIDENCE_VERSION, PHASE1_PROOF_PHOTO_COORDINATE_SYSTEM } from "./proof-scale.ts";

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
