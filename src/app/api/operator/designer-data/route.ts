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
    const manualPhysicalProvenance=Boolean(verified.physicalEvidence);
    const analyzerReviewed=Boolean(analyzed && ["approved","corrected"].includes(analyzed.reviewStatus));
    const analyzerPhysicalProvenance=Boolean(
      analyzed
      && (
        String(analyzed.verifiedPhysical.sourceUrl||"").trim()
        || String(analyzed.verifiedPhysical.evidenceNote||"").trim().length>=8
      )
    );
    const physicalField=(field:string)=>Boolean(
      analyzerReviewed
      && analyzerPhysicalProvenance
      && ["declared","reviewed"].includes(String(analyzed?.fieldProvenance?.[field]||""))
    );
    const evidence={
      availabilityVerified:verified.availability!=="unknown",
      analyzerReviewed,
      imageQualityScore:analyzed?.measuredEvidence.imageQualityScore ?? null,
      physicalScaleStatus:analyzed?.measuredEvidence.patternPhysicalScale ?? null,
      physicalScaleVerified:!patterned || Boolean(
        analyzed?.measuredEvidence.patternPhysicalScale
        && analyzed.measuredEvidence.patternPhysicalScale!=="unknown"
        && physicalField("measured.pattern.physicalScale")
      ),
      gsmVerified:Boolean(
        (manualPhysicalProvenance && verified.weightGsm!=null)
        || (physicalField("verifiedPhysical.gsm") && analyzed?.verifiedPhysical.gsm!=null)
      ),
      drapeVerified:Boolean(
        (manualPhysicalProvenance && verified.drape)
        || (physicalField("verifiedPhysical.drape") && analyzed?.verifiedPhysical.drape)
      ),
      fiberVerified:Boolean(physicalField("verifiedPhysical.fiberContent") && analyzed?.verifiedPhysical.fiberContent),
      manualPhysicalProvenance,
      analyzerPhysicalProvenance,
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
      if((verified.weightGsm!=null||Boolean(verified.drape))&&!manualPhysicalProvenance) gaps.push("physical provenance");
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
      id:fabric.id,
      colorName:fabric.colorName,
      line:fabric.line,
      family:fabric.family,
      pattern:fabric.pattern,
      suitableFor:fabric.suitableFor,
      swatchImageUrl:fabric.swatchImageUrl,
      yarnCountLea:fabric.yarnCountLea || [],
      metadata:verified,
      evidence:{...evidence,gaps,priority},
    };
  });

  const active=fabrics.filter((fabric)=>fabric.metadata.availability!=="unavailable");
  const coverage={
    total:fabrics.length,
    activeCandidates:active.length,
    priorityFabrics:active.filter((fabric)=>fabric.evidence.priority>=6).length,
    availability:active.filter((fabric)=>fabric.evidence.availabilityVerified).length,
    analyzerReviewed:active.filter((fabric)=>fabric.evidence.analyzerReviewed).length,
    physicalScale:active.filter((fabric)=>fabric.evidence.physicalScaleVerified).length,
    gsm:active.filter((fabric)=>fabric.evidence.gsmVerified).length,
    drape:active.filter((fabric)=>fabric.evidence.drapeVerified).length,
    fiber:active.filter((fabric)=>fabric.evidence.fiberVerified).length,
    formality:active.filter((fabric)=>fabric.evidence.formalityVerified).length,
  };

  return NextResponse.json({
    configured:Boolean(cloud),
    coverage,
    fabrics,
  });
}
