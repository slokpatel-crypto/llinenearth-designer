import "server-only";
import type { DesignerFabric } from "@/lib/designer/engine";
import type { DesignerFabricIntelligence } from "@/lib/fabric-intelligence-types";
import { loadFabricAnalysesForFabricIds, type BoundFabricAnalysis } from "@/lib/fabric-analyzer-store";

function clamp01(value:unknown) {
  const n=Number(value);
  return Number.isFinite(n) ? Math.max(0,Math.min(1,n)) : 0;
}

function toIntelligence(row:BoundFabricAnalysis):DesignerFabricIntelligence|null {
  const profile=row.profile;
  if(!profile || profile.version!=="fabric-analyzer-v3" || row.review_status==="rejected") return null;
  const confidence={
    color:clamp01(profile.confidence?.color),
    pattern:clamp01(profile.confidence?.pattern),
    texture:clamp01(profile.confidence?.texture),
    styling:clamp01(profile.confidence?.styling),
  };
  const average=(confidence.color+confidence.pattern+confidence.texture+confidence.styling)/4;
  const reviewed=row.review_status==="approved" || row.review_status==="corrected";
  const hasReferences=Boolean(profile.references?.sourceIds?.length || profile.references?.materialTerms?.length || profile.references?.patternTerms?.length);
  const trust:DesignerFabricIntelligence["trust"]=reviewed
    ? "reviewed"
    : average>=.78 && hasReferences ? "high-confidence" : "provisional";

  return {
    profileId:row.id,
    analyzerVersion:row.analyzer_version,
    reviewStatus:row.review_status,
    trust,
    colorFamily:String(profile.observed.colorFamily||"").slice(0,80),
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
    confidence,
    references:{
      materialTerms:profile.references.materialTerms.slice(0,8),
      patternTerms:profile.references.patternTerms.slice(0,8),
      colorTerms:profile.references.colorTerms.slice(0,8),
      sourceIds:profile.references.sourceIds.slice(0,10),
    },
  };
}

export async function attachFabricIntelligence<T extends DesignerFabric>(fabrics:T[]):Promise<T[]> {
  if(!fabrics.length) return fabrics;
  const rows=await loadFabricAnalysesForFabricIds(fabrics.map((fabric)=>fabric.id),{includeUnreviewed:true});
  if(!rows.length) return fabrics;
  const byId=new Map<string,DesignerFabricIntelligence>();
  for(const row of rows) {
    const intelligence=toIntelligence(row);
    if(intelligence) byId.set(row.fabric_id,intelligence);
  }
  return fabrics.map((fabric)=>{
    const intelligence=byId.get(fabric.id);
    return intelligence ? {...fabric,intelligence} : fabric;
  }) as T[];
}
