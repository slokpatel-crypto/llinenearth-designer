import { NextResponse } from "next/server";
import { customerPhotoCalibrationFromProofPayload } from "@/lib/designer/photo-calibration";
import { UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION } from "@/lib/designer/photo-calibration-types";
import { loadLatestPhase1ProofRecord } from "@/lib/designer/phase1-proof-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  const latest=await loadLatestPhase1ProofRecord();
  const calibration=latest
    ? customerPhotoCalibrationFromProofPayload(latest.payload)
    : UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION;

  return NextResponse.json(calibration,{
    headers:{
      "cache-control":"no-store",
      "x-content-type-options":"nosniff",
    },
  });
}
