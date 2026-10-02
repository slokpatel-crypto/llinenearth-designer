export type CustomerPhotoCalibration={
  verified:boolean;
  photoPxPerMm:number|null;
  scaleCoordinateSystem:"photo-1024x1536-fixture"|null;
  proofVersion:"linen-earth-phase1-proof-v4"|null;
};

export const UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION:CustomerPhotoCalibration={
  verified:false,
  photoPxPerMm:null,
  scaleCoordinateSystem:null,
  proofVersion:null,
};
