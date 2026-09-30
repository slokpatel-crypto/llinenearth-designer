import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FABRIC_STOCK } from "@/lib/fabric-stock";
import { loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { loadDesignerFabricIntelligence } from "@/lib/fabric-intelligence-server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const jar = await cookies();
  const valid = await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if (!valid) return NextResponse.json({error:"Unauthorized."},{status:401});

  const cloud = getSupabaseAdminConfig();
  const metadata = await loadDesignerFabricMetadata();
  const intelligence = await loadDesignerFabricIntelligence(FABRIC_STOCK.map((fabric)=>fabric.id));

  const fabrics = FABRIC_STOCK.map((fabric)=>{
    const verified=metadata[fabric.id] || {fabricId:fabric.id,availability:"unknown" as const};
    const analyzed=intelligence[fabric.id];
    const patterned=!/^(solid|plain)$/i.test(String(fabric.pattern||"").trim());
    const inactive=verified.availability==="unavailable";
    const evidence={
      availabilityVerified:verified.availability!=="unknown",
      analyzerReviewed:Boolean(analyzed && ["approved","corrected"].includes(analyzed.reviewStatus)),
      imageQualityScore:analyzed?.measuredEvidence.imageQualityScore ?? null,
      physicalScaleStatus:analyzed?.measuredEvidence.patternPhysicalScale ?? null,
      physicalScaleVerified:!patterned || Boolean(analyzed?.measuredEvidence.patternPhysicalScale && analyzed.measuredEvidence.patternPhysicalScale!=="unknown"),
      gsmVerified:verified.weightGsm!=null || analyzed?.verifiedPhysical.gsm!=null,
      drapeVerified:Boolean(verified.drape || analyzed?.verifiedPhysical.drape),
      fiberVerified:Boolean(analyzed?.verifiedPhysical.fiberContent),
      formalityVerified:verified.formalityScore!=null,
      patterned,
    };
    const gaps:string[]=[];
    if(!inactive) {
      if(!evidence.availabilityVerified) gaps.push("availability");
      if(!evidence.analyzerReviewed) gaps.push("analyzer review");
      if(!evidence.physicalScaleVerified) gaps.push("pattern scale");
      if(!evidence.gsmVerified) gaps.push("GSM");
      if(!evidence.drapeVerified) gaps.push("drape");
      if(!evidence.fiberVerified) gaps.push("fibre");
      if(!evidence.formalityVerified) gaps.push("formality");
    }
    const priority=inactive ? 0
      : (evidence.availabilityVerified?0:4)
      +(evidence.physicalScaleVerified?0:4)
      +(evidence.analyzerReviewed?0:2)
      +(evidence.gsmVerified?0:2)
      +(evidence.drapeVerified?0:2)
      +(evidence.formalityVerified?0:2)
      +(evidence.fiberVerified?0:1);
    return {
}

/* legacy map body removed */
      id:fabric.id,
      colorName:fabric.colorName,
      line:fabric.line,
      family:fabric.family,
      pattern:fabric.pattern,
      suitableFor:fabric.suitableFor,
      swatchImageUrl:fabric.swatchImageUrl,
      yarnCountLea:fabric.yarnCountLea || [],
      metadata:metadata[fabric.id] || {
        fabricId:fabric.id,
        availability:"unknown",
      },
    })),
  });
}
