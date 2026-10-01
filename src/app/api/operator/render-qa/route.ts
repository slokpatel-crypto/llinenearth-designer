import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import {
  latestRenderCreditCap,
  listRenderIdentityReviews,
  listRenderOutcomes,
  listRenderPatternCalibrations,
  recordRenderCreditCap,
  recordRenderIdentityReview,
  recordRenderPatternCalibration,
  reviewRenderOutcome,
} from "@/lib/designer/render-outcomes";
import { summarizeApprovedPatternCalibrationCoverage, summarizeRenderOutcomes, summarizeRenderPatternCalibrations } from "@/lib/designer/render-outcome-metrics";
import { evaluateRenderCreditCap, summarizeCrossViewIdentity } from "@/lib/designer/render-release-evidence";
import { DESIGNER_PANTS, DESIGNER_SHIRTS } from "@/lib/designer/engine";
import { enrichDesignerFabricsWithIntelligence } from "@/lib/fabric-intelligence-server";

export const runtime="nodejs";

const BASE_RENDER_FABRICS=[...DESIGNER_SHIRTS,...DESIGNER_PANTS];
const BASE_RENDER_FABRIC_BY_ID=new Map(BASE_RENDER_FABRICS.map((fabric)=>[fabric.id,fabric]));

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  const [outcomes,calibrations,identityReviews,creditCap]=await Promise.all([
    listRenderOutcomes(300),
    listRenderPatternCalibrations(300),
    listRenderIdentityReviews(300),
    latestRenderCreditCap(),
  ]);
  const summary=summarizeRenderOutcomes(outcomes);
  const patternedFabricIds=new Set(
    BASE_RENDER_FABRICS
      .filter((fabric)=>String(fabric.patternType||"").toLowerCase()!=="solid")
      .map((fabric)=>fabric.id),
  );
  const involvedIds=[...new Set(outcomes.flatMap((row)=>[row.shirt_id,row.pant_id]).filter(Boolean))];
  const involvedBase=involvedIds.flatMap((id)=>{
    const fabric=BASE_RENDER_FABRIC_BY_ID.get(id);
    return fabric?[fabric]:[];
  });
  const enriched=involvedBase.length
    ? await enrichDesignerFabricsWithIntelligence(involvedBase)
    : {fabrics:[]};
  const patternEvidenceByFabric=Object.fromEntries(enriched.fabrics.map((fabric)=>{
    const repeatMm=Number(fabric.renderScale?.repeatMm);
    const verified=Boolean(
      fabric.patternScaleVerified===true &&
      fabric.renderScale?.physicalScaleStatus!=="unknown" &&
      Number.isFinite(repeatMm) &&
      repeatMm>0
    );
    return [fabric.id,{
      patternType:fabric.patternType,
      patterned:String(fabric.patternType||"").toLowerCase()!=="solid",
      verified,
      repeatMm:verified?repeatMm:null,
    }];
  }));
  const expectedRepeatByFabric=new Map<string,number>(
    Object.entries(patternEvidenceByFabric)
      .flatMap(([fabricId,evidence])=>evidence.verified&&evidence.repeatMm ? [[fabricId,evidence.repeatMm] as [string,number]] : []),
  );
  const patternCoverageSummary=summarizeApprovedPatternCalibrationCoverage(
    outcomes,
    calibrations,
    patternedFabricIds,
    expectedRepeatByFabric,
  );
  return NextResponse.json({
    outcomes,
    calibrations,
    identityReviews,
    creditCap,
    summary,
    patternSummary:summarizeRenderPatternCalibrations(calibrations),
    patternCoverageSummary,
    patternEvidenceByFabric,
    identitySummary:summarizeCrossViewIdentity(outcomes,identityReviews),
    creditCapSummary:evaluateRenderCreditCap(summary.creditsPerApproved,creditCap?Number(creditCap.credits_per_approved_cap):null),
  },{headers:{"cache-control":"private, no-store"}});
}

export async function POST(request:Request){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const action=String(body.action||"review");

    if(action==="credit_cap"){
      const cap=Number(body.cap);
      const reviewer=String(body.reviewer||"").trim();
      if(!Number.isFinite(cap)||cap<=0||cap>100000||!reviewer) {
        return NextResponse.json({error:"A valid owner-approved credit cap and reviewer are required."},{status:400});
      }
      const eventId=await recordRenderCreditCap({cap,reviewer,note:String(body.note||"")});
      return NextResponse.json({eventId});
    }

    if(action==="identity_review"){
      const conceptId=String(body.conceptId||"").trim();
      const status=String(body.status||"");
      const reviewer=String(body.reviewer||"").trim();
      if(!conceptId||!["pass","fail"].includes(status)||!reviewer) {
        return NextResponse.json({error:"Concept, identity decision and reviewer are required."},{status:400});
      }
      const reviewId=await recordRenderIdentityReview({
        conceptId,
        status:status as "pass"|"fail",
        reviewer,
        note:String(body.note||""),
      });
      return NextResponse.json({reviewId});
    }

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
      const observedRepeatMm=Number(body.observedRepeatMm);
      const axisStatus=String(body.axisStatus||"");
      if(!["shirt","trouser"].includes(garment)||!Number.isFinite(observedRepeatMm)||observedRepeatMm<=0||!["match","mismatch","not_applicable"].includes(axisStatus)) {
        return NextResponse.json({error:"Valid observed pattern calibration values are required."},{status:400});
      }

      const outcomes=await listRenderOutcomes(1000);
      const outcome=outcomes.find((row)=>row.outcome_id===outcomeId);
      if(!outcome) return NextResponse.json({error:"Render outcome was not found."},{status:404});
      const fabricId=garment==="shirt"?outcome.shirt_id:outcome.pant_id;
      const baseFabric=BASE_RENDER_FABRIC_BY_ID.get(fabricId);
      if(!baseFabric) return NextResponse.json({error:"The render fabric is not in the current catalogue."},{status:409});
      if(String(baseFabric.patternType||"").toLowerCase()==="solid") {
        return NextResponse.json({error:"Solid fabric does not require physical repeat calibration."},{status:409});
      }

      const enriched=await enrichDesignerFabricsWithIntelligence([baseFabric]);
      const verifiedFabric=enriched.fabrics[0];
      const expectedRepeatMm=Number(verifiedFabric?.renderScale?.repeatMm);
      const hasReviewedRepeat=Boolean(
        verifiedFabric?.patternScaleVerified===true &&
        verifiedFabric?.renderScale?.physicalScaleStatus!=="unknown" &&
        Number.isFinite(expectedRepeatMm) &&
        expectedRepeatMm>0
      );
      if(!hasReviewedRepeat) {
        return NextResponse.json({
          error:"Reviewed physical repeat evidence is required in Fabric Analyzer before final-render pattern calibration.",
          fabricId,
        },{status:409});
      }

      const calibrationId=await recordRenderPatternCalibration({
        outcomeId,
        garment:garment as "shirt"|"trouser",
        expectedRepeatMm,
        observedRepeatMm,
        axisStatus:axisStatus as "match"|"mismatch"|"not_applicable",
        note:String(body.note||""),
      });
      return NextResponse.json({calibrationId,expectedRepeatMm,fabricId});
    }

    return NextResponse.json({error:"Unsupported render QA action."},{status:400});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Render review failed."},{status:409});
  }
}
