import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { listRenderOutcomes, listRenderPatternCalibrations, recordRenderPatternCalibration, reviewRenderOutcome } from "@/lib/designer/render-outcomes";
import { summarizeRenderOutcomes, summarizeRenderPatternCalibrations } from "@/lib/designer/render-outcome-metrics";

export const runtime="nodejs";

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  const [outcomes,calibrations]=await Promise.all([listRenderOutcomes(300),listRenderPatternCalibrations(300)]);
  return NextResponse.json({
    outcomes,
    calibrations,
    summary:summarizeRenderOutcomes(outcomes),
    patternSummary:summarizeRenderPatternCalibrations(calibrations),
  },{headers:{"cache-control":"private, no-store"}});
}

export async function POST(request:Request){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const action=String(body.action||"review");
    const outcomeId=String(body.outcomeId||"").trim();
    if(!outcomeId) return NextResponse.json({error:"Render outcome is required."},{status:400});

    if(action==="review"){
      const status=String(body.status||"");
      if(!["approved","rejected"].includes(status)) {
        return NextResponse.json({error:"Review status is required."},{status:400});
      }
      const updated=await reviewRenderOutcome({
        outcomeId,
        status:status as "approved"|"rejected",
        note:String(body.note||""),
      });
      return NextResponse.json({updated:Boolean(updated)});
    }

    if(action==="pattern_calibration"){
      const garment=String(body.garment||"");
      const expectedRepeatMm=Number(body.expectedRepeatMm);
      const observedRepeatMm=Number(body.observedRepeatMm);
      const axisStatus=String(body.axisStatus||"");
      if(!["shirt","trouser"].includes(garment)||!Number.isFinite(expectedRepeatMm)||expectedRepeatMm<=0||!Number.isFinite(observedRepeatMm)||observedRepeatMm<=0||!["match","mismatch","not_applicable"].includes(axisStatus)) {
        return NextResponse.json({error:"Valid pattern calibration values are required."},{status:400});
      }
      const calibrationId=await recordRenderPatternCalibration({
        outcomeId,
        garment:garment as "shirt"|"trouser",
        expectedRepeatMm,
        observedRepeatMm,
        axisStatus:axisStatus as "match"|"mismatch"|"not_applicable",
        note:String(body.note||""),
      });
      return NextResponse.json({calibrationId});
    }

    return NextResponse.json({error:"Unsupported render QA action."},{status:400});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Render review failed."},{status:409});
  }
}
