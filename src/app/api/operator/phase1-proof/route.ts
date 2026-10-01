import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { passesScaleGate, phase1ProofAcceptance, scaleErrorPct, summarizeIndependentRealism, type RealismAssessment } from "@/lib/designer/proof-scale";

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
      const repeatMm=Number(payload.repeatMm);
      const measuredPreviewRepeatPx=Number(payload.measuredPreviewRepeatPx);
      const photoPxPerMm=Number(payload.photoPxPerMm);
      const scaleInputsValid=
        String(payload.scaleCoordinateSystem||"")==="photo-1024x1536"&&
        Number.isFinite(repeatMm)&&repeatMm>0&&
        Number.isFinite(measuredPreviewRepeatPx)&&measuredPreviewRepeatPx>0&&
        Number.isFinite(photoPxPerMm)&&photoPxPerMm>0;
      const computedScaleGate=scaleInputsValid
        ? passesScaleGate(measuredPreviewRepeatPx,repeatMm,photoPxPerMm)
        : false;
      const computedScaleError=scaleInputsValid
        ? scaleErrorPct(measuredPreviewRepeatPx,repeatMm,photoPxPerMm)
        : null;

      const assessments:Array<RealismAssessment>=Array.isArray(payload.realismAssessments)
        ? payload.realismAssessments.flatMap((item)=>{
            if(!item||typeof item!=="object") return [];
            const value=item as Record<string,unknown>;
            return [{
              viewerId:String(value.viewerId||"").slice(0,80),
              rating:Number(value.rating),
              recordedAt:String(value.recordedAt||"").slice(0,80),
            }];
          })
        : [];
      const realism=summarizeIndependentRealism(assessments);
      const realModelSamples=Math.max(0,Math.floor(Number(payload.realModelSamples)||0));
      const realModelP95Ms=Number.isFinite(Number(payload.realModelP95Ms))?Number(payload.realModelP95Ms):null;
      const acceptance=phase1ProofAcceptance({
        repeatMm:scaleInputsValid?repeatMm:null,
        scaleGatePass:computedScaleGate,
        realModelSamples,
        realModelP95Ms,
        realismRatings:realism.ratings,
      });

      return NextResponse.json({
        configured:true,
        latest:{
          at:row.at,
          status:acceptance.accepted?"accepted":"review",
          fabricId:String(payload.fabricId||""),
          fabricName:String(payload.fabricName||""),
          pattern:String(payload.pattern||""),
          repeatMm:scaleInputsValid?repeatMm:null,
          photoPxPerMm:scaleInputsValid?photoPxPerMm:null,
          scaleCoordinateSystem:scaleInputsValid?"photo-1024x1536":null,
          measuredPreviewRepeatPx:scaleInputsValid?measuredPreviewRepeatPx:null,
          scaleErrorPct:computedScaleError,
          scaleGatePass:computedScaleGate,
          realModelSamples,
          realModelP95Ms,
          realismRatings:realism.ratings,
          uniqueRealismViewers:realism.uniqueViewers,
          strongRatings:realism.strongRatings,
          realismPass:realism.ready,
          note:acceptance.reasons.join(" ").slice(0,700),
        },
      },{headers:{"cache-control":"private, no-store"}});
    }
    return NextResponse.json({configured:true,latest:null},{headers:{"cache-control":"private, no-store"}});
  }catch{
    return NextResponse.json({configured:true,latest:null},{headers:{"cache-control":"private, no-store"}});
  }
}
