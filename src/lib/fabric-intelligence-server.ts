import "server-only";
import type { DesignerFabricIntelligence } from "@/lib/fabric-intelligence-types";
import type { DesignerFabric } from "@/lib/designer/engine";
import { applyVerifiedPhysicalFabricEvidence } from "@/lib/fabric-intelligence-evidence";
import { adaptFabricProfileToV4 } from "@/lib/fabric-intelligence-adapter";
import { loadFabricAnalysesForFabricIds, type BoundFabricAnalysis } from "@/lib/fabric-analyzer-store";

function clamp01(value:unknown) {
  const n=Number(value);
  return Number.isFinite(n) ? Math.max(0,Math.min(1,n)) : 0;
}

function toIntelligence(row:BoundFabricAnalysis):DesignerFabricIntelligence|null {
  if(row.review_status==="rejected") return null;
  const profile=adaptFabricProfileToV4(row.profile);
  if(!profile) return null;
  const confidence={
    color:clamp01(profile.confidence.color),
    pattern:clamp01(profile.confidence.pattern),
    texture:clamp01(profile.confidence.texture),
    styling:clamp01(profile.confidence.styling),
  };
  const average=(confidence.color+confidence.pattern+confidence.texture+confidence.styling)/4;
  const reviewed=row.review_status==="approved" || row.review_status==="corrected";
  const hasReferences=Boolean(profile.references.sourceIds.length || profile.references.materialTerms.length || profile.references.patternTerms.length);
  const imageQualityScore=profile.imageQuality?.score ?? profile.measured?.imageQuality.score ?? null;
  const measuredAgreement=Boolean(
    profile.measured
    && imageQualityScore!==null
    && imageQualityScore>=75
    && profile.reviewNeeded.every((item)=>!/Measured\/model .* disagreement/i.test(item))
  );
  const trust:DesignerFabricIntelligence["trust"]=reviewed
    ? "reviewed"
    : average>=.82 && measuredAgreement && hasReferences && profile.reviewNeeded.length===0 ? "high-confidence" : "provisional";

  return {
    profileId:row.id,
    analyzerVersion:row.analyzer_version,
    reviewStatus:row.review_status,
    trust,
    measuredEvidence:{
      imageQualityScore,
      colorDeltaE:profile.measured?.colour.deltaE ?? null,
      measuredHex:profile.measured?.colour.hex ?? null,
      patternContrastDeltaE:profile.measured?.pattern.contrastDeltaE ?? null,
      patternOrientation:profile.measured?.pattern.orientation ?? null,
      patternPhysicalScale:profile.measured?.pattern.physicalScaleStatus ?? null,
      repeatMm:profile.measured?.pattern.repeatMm ?? null,
      stripeWidthMm:profile.measured?.pattern.stripeWidthMm ?? null,
      contentSha256:profile.measured?.contentSha256 ?? null,
    },
    verifiedPhysical:{...profile.verifiedPhysical},
    colorFamily:profile.observed.colorFamily,
    undertone:profile.observed.undertone,
    depth:profile.observed.depth,
    saturation:profile.observed.saturation,
    patternFamily:profile.observed.patternFamily,
    patternScale:profile.observed.patternScale,
    patternDensity:profile.observed.patternDensity,
    patternContrast:profile.observed.patternContrast,
    visibleTexture:profile.observed.visibleTexture.slice(0,10),
    weaveAppearance:profile.observed.weaveAppearance.slice(0,8),
    sheen:profile.observed.sheen,
    visualWeight:profile.observed.visualWeight,
    personality:profile.inferredStyle.personality.slice(0,8),
    formality:profile.inferredStyle.formality,
    statementLevel:profile.inferredStyle.statementLevel,
    bestGarments:profile.inferredStyle.bestGarments.slice(0,10),
    bestOccasions:profile.inferredStyle.bestOccasions.slice(0,10),
    climateVisualFit:profile.inferredStyle.climateVisualFit.slice(0,8),
    recommendedConstruction:{
      collars:profile.inferredStyle.recommendedConstruction.collars.slice(0,8),
      cuffs:profile.inferredStyle.recommendedConstruction.cuffs.slice(0,8),
      shirtFits:profile.inferredStyle.recommendedConstruction.shirtFits.slice(0,6),
      trouserDirections:profile.inferredStyle.recommendedConstruction.trouserDirections.slice(0,8),
    },
    pairing:{
      goodColorFamilies:profile.inferredStyle.pairing.goodColorFamilies.slice(0,10),
      avoidColorFamilies:profile.inferredStyle.pairing.avoidColorFamilies.slice(0,8),
      goodPatternStrategy:profile.inferredStyle.pairing.goodPatternStrategy.slice(0,8),
    },
    reviewNeeded:profile.reviewNeeded.slice(0,30),
    confidence,
    references:{
      materialTerms:profile.references.materialTerms.slice(0,8),
      patternTerms:profile.references.patternTerms.slice(0,8),
      colorTerms:profile.references.colorTerms.slice(0,8),
      sourceIds:profile.references.sourceIds.slice(0,10),
    },
  };
}

export async function loadDesignerFabricIntelligence(
  fabricIds:string[],
):Promise<Record<string,DesignerFabricIntelligence>> {
  if(!fabricIds.length) return {};
  const rows=await loadFabricAnalysesForFabricIds(fabricIds,{includeUnreviewed:true});
  const out:Record<string,DesignerFabricIntelligence>={};
  for(const row of rows) {
    const intelligence=toIntelligence(row);
    if(intelligence) out[row.fabric_id]=intelligence;
  }
  return out;
}


export async function enrichDesignerFabricsWithIntelligence(
  fabrics:DesignerFabric[],
):Promise<{
  fabrics:DesignerFabric[];
  intelligence:Record<string,DesignerFabricIntelligence>;
}> {
  const intelligence=await loadDesignerFabricIntelligence(fabrics.map((fabric)=>fabric.id));
  return {
    fabrics:fabrics.map((fabric)=>applyVerifiedPhysicalFabricEvidence(fabric,intelligence[fabric.id])),
    intelligence,
  };
}
