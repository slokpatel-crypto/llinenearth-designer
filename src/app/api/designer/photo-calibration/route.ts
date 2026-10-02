import { NextResponse } from "next/server";
import { customerPhotoCalibrationFromProofPayload, UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION } from "@/lib/designer/photo-calibration";
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
      "cache-control":"public, max-age=0, s-maxage=60, stale-while-revalidate=120",
      "x-content-type-options":"nosniff",
    },
  });
}
