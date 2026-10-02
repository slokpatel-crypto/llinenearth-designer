"use client";

import {
  UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION,
  type CustomerPhotoCalibration,
} from "@/lib/designer/photo-calibration-types";

let customerPhotoCalibrationRequest:Promise<CustomerPhotoCalibration>|null=null;

export function customerPhotoCalibrationIdentity(value:CustomerPhotoCalibration) {
  const pxPerMm=Number(value.photoPxPerMm);
  if(
    value.verified!==true ||
    !Number.isFinite(pxPerMm) ||
    pxPerMm<=0 ||
    !value.scaleCoordinateSystem ||
    !value.proofVersion
  ) return "unverified";
  return `${value.proofVersion}:${value.scaleCoordinateSystem}:${pxPerMm.toFixed(6)}`;
}

export function fetchCustomerPhotoCalibration(){
  if(customerPhotoCalibrationRequest) return customerPhotoCalibrationRequest;
  customerPhotoCalibrationRequest=fetch("/api/designer/photo-calibration",{cache:"no-store"})
    .then(async(response)=>{
      if(!response.ok) return UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION;
      const payload=await response.json() as CustomerPhotoCalibration;
      return payload?.verified===true
        && Number.isFinite(Number(payload.photoPxPerMm))
        && Number(payload.photoPxPerMm)>0
        && payload.scaleCoordinateSystem==="photo-1024x1536-fixture"
        && payload.proofVersion==="linen-earth-phase1-proof-v4"
        ? payload
        : UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION;
    })
    .catch(()=>UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION)
    .finally(()=>{customerPhotoCalibrationRequest=null;});
  return customerPhotoCalibrationRequest;
}
