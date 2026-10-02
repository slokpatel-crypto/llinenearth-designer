import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig } from "@/lib/supabase-admin";
import { loadLatestPhase1ProofRecord } from "@/lib/designer/phase1-proof-server";

export const runtime="nodejs";

export async function GET(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }

  if(!getSupabaseAdminConfig()){
    return NextResponse.json({configured:false,latest:null},{headers:{"cache-control":"private, no-store"}});
  }

  const latestRecord=await loadLatestPhase1ProofRecord();
  if(!latestRecord){
    return NextResponse.json({configured:true,latest:null},{headers:{"cache-control":"private, no-store"}});
  }

  const {at,payload,evidence}=latestRecord;
  return NextResponse.json({
    configured:true,
    latest:{
      at,
      version:evidence.version,
      status:evidence.coreAccepted?"accepted":"review",
      coreAccepted:evidence.coreAccepted,
      fabricId:String(payload.fabricId||""),
      fabricName:String(payload.fabricName||""),
      pattern:String(payload.pattern||""),
      repeatMm:evidence.repeatMm,
      photoReferenceMm:evidence.photoReferenceMm,
      photoReferencePx:evidence.photoReferencePx,
      photoPxPerMm:evidence.photoPxPerMm,
      scaleCoordinateSystem:evidence.scaleCoordinateSystem,
      physicalEvidenceReady:evidence.physicalEvidenceReady,
      physicalEvidenceNote:evidence.physicalEvidenceNote,
      measuredPreviewRepeatPx:evidence.measuredPreviewRepeatPx,
      scaleErrorPct:evidence.scaleErrorPct,
      scaleGatePass:evidence.scaleGatePass,
      realModelSamples:evidence.realModelSamples,
      realModelP95Ms:evidence.realModelP95Ms,
      realismRatings:evidence.realism.ratings,
      uniqueRealismViewers:evidence.realism.uniqueViewers,
      strongRatings:evidence.realism.strongRatings,
      realismPass:evidence.realism.ready,
      boundaryChecks:evidence.boundaryChecks,
      boundaryReady:evidence.boundaryReady,
      note:evidence.acceptance.reasons.join(" ").slice(0,700),
    },
  },{headers:{"cache-control":"private, no-store"}});
}
