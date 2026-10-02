import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { evaluateRecordedPhase1ProofEvidence } from "@/lib/designer/proof-scale";

export const runtime="nodejs";

type Row={at:string;payload?:Record<string,unknown>};

export async function GET(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }

  const cloud=getSupabaseAdminConfig();
  if(!cloud) return NextResponse.json({configured:false,latest:null},{headers:{"cache-control":"private, no-store"}});

  try{
    const params=new URLSearchParams({
      select:"at,payload",
      type:"eq.operator_note",
      source:"eq.operator",
      order:"at.desc",
      limit:"300",
    });
    const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
      cache:"no-store",
    });
    if(!response.ok) return NextResponse.json({configured:true,latest:null},{headers:{"cache-control":"private, no-store"}});
    const rows=await response.json() as Row[];
    for(const row of rows){
      const payload=row.payload||{};
      if(String(payload.subtype||"")!=="roadmap_phase1_proof") continue;
      const evidence=evaluateRecordedPhase1ProofEvidence(payload);

      return NextResponse.json({
        configured:true,
        latest:{
          at:row.at,
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
    return NextResponse.json({configured:true,latest:null},{headers:{"cache-control":"private, no-store"}});
  }catch{
    return NextResponse.json({configured:true,latest:null},{headers:{"cache-control":"private, no-store"}});
  }
}
