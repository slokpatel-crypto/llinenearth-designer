import type { MeasurementProfile } from "@/lib/measurements";
import {
  evaluateDesignerCombo, type DesignerContext, type DesignerFabric, type DesignerRecommendation,
  type DesignerStyle, type OccasionTier,
} from "@/lib/designer/engine";
import { assessFitConstruction, type FitConstructionAssessment } from "@/lib/designer/fit-construction";
import { evaluateLinenEarthBrandLanguage, type BrandLanguageEvaluation } from "@/lib/designer/brand-language";

export type OutfitSearchMode = "Safe" | "Elevated" | "Statement";

export type OutfitSearchAnchor =
  | { garment:"shirt"; fabricId:string }
  | { garment:"pant"; fabricId:string }
  | null;

export type OutfitSearchResult = {
  mode: OutfitSearchMode;
  score: number;
  rank: number;
  recommendation: DesignerRecommendation;
  fitConstruction?: FitConstructionAssessment;
  brandLanguage: BrandLanguageEvaluation;
  rationale: string;
  evidence: {
    hardFlags: number;
    mediumFlags: number;
    unknowns: number;
    materialVerifiedRatio: number;
  };
};

export type OutfitSearchInput = {
  shirts: DesignerFabric[];
  pants: DesignerFabric[];
  occasion: OccasionTier;
  style: DesignerStyle;
  context: DesignerContext;
  measurements?: MeasurementProfile | null;
  anchor?: OutfitSearchAnchor;
  maxPairs?: number;
};

type Candidate = Omit<OutfitSearchResult,"mode"|"score"|"rank"|"rationale"> & {
  shirtProminence:number;
  pantProminence:number;
  toneContrast:boolean;
};

function prominence(fabric:DesignerFabric) {
  if(fabric.patternScale==="Bold") return 3;
  if(fabric.patternScale==="Medium-Bold") return 2.5;
  if(fabric.patternScale==="Medium") return 1.5;
  if(fabric.patternScale==="Fine") return .75;
  return 0;
}

function pairCandidates(input:OutfitSearchInput) {
  const shirts = input.anchor?.garment==="shirt"
    ? input.shirts.filter((item)=>item.id===input.anchor?.fabricId)
    : input.shirts;
  const pants = input.anchor?.garment==="pant"
    ? input.pants.filter((item)=>item.id===input.anchor?.fabricId)
    : input.pants;

  const pairs:Array<[DesignerFabric,DesignerFabric]>=[];
  for(const shirt of shirts) {
    for(const pant of pants) {
      pairs.push([shirt,pant]);
      if(pairs.length >= (input.maxPairs ?? 1400)) return pairs;
    }
  }
  return pairs;
}

function evaluate(input:OutfitSearchInput,shirt:DesignerFabric,pant:DesignerFabric):Candidate|null {
  const recommendation=evaluateDesignerCombo(shirt,pant,input.occasion,input.style,undefined,input.context);
  const hardFlags=recommendation.rules.filter((rule)=>rule.status==="flag"&&rule.severity==="High").length;
  if(hardFlags>0 || recommendation.formality.match===false) return null;

  const fitConstruction=input.measurements
    ? assessFitConstruction(input.measurements,recommendation.style,{climate:input.context.climate,shirtFabric:shirt,trouserFabric:pant})
    : undefined;
  if(fitConstruction?.checks.some((item)=>item.severity==="warning")) return null;

  const brandLanguage=evaluateLinenEarthBrandLanguage(shirt,pant,recommendation.style,input.occasion,input.context);
  const mediumFlags=recommendation.rules.filter((rule)=>rule.status==="flag"&&rule.severity==="Medium").length;
  const unknowns=recommendation.rules.filter((rule)=>rule.status==="unknown").length;
  const materialVerifiedRatio=recommendation.materialEvidence.total
    ? recommendation.materialEvidence.verified/recommendation.materialEvidence.total : 0;

  return {
    recommendation,fitConstruction,brandLanguage,
    evidence:{hardFlags,mediumFlags,unknowns,materialVerifiedRatio},
    shirtProminence:prominence(shirt),
    pantProminence:prominence(pant),
    toneContrast:Boolean(shirt.tone&&pant.tone&&shirt.tone!==pant.tone),
  };
}

function modeContext(mode:OutfitSearchMode,context:DesignerContext):DesignerContext {
  return {
    climate:context.climate,
    intention:mode==="Safe"?"Understated":mode==="Statement"?"Expressive":"Balanced",
  };
}

function scoreCandidate(candidate:Candidate,mode:OutfitSearchMode,input:OutfitSearchInput) {
  const r=candidate.recommendation;
  const fit=candidate.fitConstruction?.fitScore ?? 70;
  const material=candidate.evidence.materialVerifiedRatio*100;
  const brand=evaluateLinenEarthBrandLanguage(r.shirt,r.pant,r.style,input.occasion,modeContext(mode,input.context)).score;
  let score=r.designFitScore*.40+r.confidenceScore*.14+fit*.20+brand*.18+material*.08;

  score -= candidate.evidence.mediumFlags*8;
  score -= candidate.evidence.unknowns*(mode==="Safe"?2.4:1.4);

  const totalProminence=candidate.shirtProminence+candidate.pantProminence;
  const oneHero=(candidate.shirtProminence>=1.5)!==(candidate.pantProminence>=1.5);

  if(mode==="Safe") {
    score += totalProminence<=1.5?10:-Math.max(0,totalProminence-1.5)*5;
    score += r.status==="preliminary"?4:-5;
    score += candidate.evidence.materialVerifiedRatio*.0; // verification is already weighted above.
  } else if(mode==="Elevated") {
    score += oneHero?8:0;
    score += candidate.toneContrast?4:1;
    if(totalProminence>4) score -= 8;
  } else {
    score += oneHero?12:0;
    score += candidate.toneContrast?6:0;
    score += Math.min(8,totalProminence*2.2);
    if(candidate.shirtProminence>=2&&candidate.pantProminence>=2) score -= 12;
  }

  return Math.max(0,Math.min(100,Math.round(score*10)/10));
}

function rationale(candidate:Candidate,mode:OutfitSearchMode) {
  const r=candidate.recommendation;
  const fit=candidate.fitConstruction?.fitScore;
  const brand=candidate.brandLanguage;
  if(mode==="Safe") {
    return `${r.shirt.name} with ${r.pant.name} keeps the pattern load controlled and prioritizes confidence, fit compatibility and a quieter Linen Earth read.`;
  }
  if(mode==="Elevated") {
    return `${r.shirt.name} with ${r.pant.name} adds controlled contrast or one stronger design note while keeping construction and fit within the accepted range.`;
  }
  return `${r.shirt.name} with ${r.pant.name} creates the strongest controlled focal point in this search without allowing a hard fit, construction or formality conflict.${fit!=null?` Fit read: ${fit}/100.`:""}${brand.cautions[0]?` Review: ${brand.cautions[0]}`:""}`;
}

function diversify(
  ranked:Array<{candidate:Candidate;score:number}>,
  usedPairs:Set<string>,
  usedShirts:Set<string>,
  usedPants:Set<string>,
  anchor:OutfitSearchAnchor|undefined,
) {
  let fallback:typeof ranked[number]|undefined;
  for(const item of ranked) {
    const r=item.candidate.recommendation;
    const key=`${r.shirt.id}::${r.pant.id}`;
    if(usedPairs.has(key)) continue;
    fallback ??= item;
    const shirtRepeated=usedShirts.has(r.shirt.id);
    const pantRepeated=usedPants.has(r.pant.id);
    const anchorAllowsShirt=anchor?.garment==="shirt";
    const anchorAllowsPant=anchor?.garment==="pant";
    if((shirtRepeated&&!anchorAllowsShirt)||(pantRepeated&&!anchorAllowsPant)) continue;
    return item;
  }
  return fallback;
}

export function searchDesignerOutfits(input:OutfitSearchInput):OutfitSearchResult[] {
  const candidates=pairCandidates(input).map(([shirt,pant])=>evaluate(input,shirt,pant)).filter((item):item is Candidate=>Boolean(item));
  const modes:OutfitSearchMode[]=["Safe","Elevated","Statement"];
  const usedPairs=new Set<string>();
  const usedShirts=new Set<string>();
  const usedPants=new Set<string>();
  const results:OutfitSearchResult[]=[];

  for(const mode of modes) {
    const ranked=candidates
      .map((candidate)=>({candidate,score:scoreCandidate(candidate,mode,input)}))
      .sort((a,b)=>b.score-a.score || b.candidate.recommendation.designFitScore-a.candidate.recommendation.designFitScore);

    const chosen=diversify(ranked,usedPairs,usedShirts,usedPants,input.anchor);
    if(!chosen) continue;
    const r=chosen.candidate.recommendation;
    usedPairs.add(`${r.shirt.id}::${r.pant.id}`);
    usedShirts.add(r.shirt.id);
    usedPants.add(r.pant.id);
    results.push({
      mode,score:chosen.score,rank:results.length+1,
      recommendation:r,
      fitConstruction:chosen.candidate.fitConstruction,
      brandLanguage:evaluateLinenEarthBrandLanguage(r.shirt,r.pant,r.style,input.occasion,modeContext(mode,input.context)),
      rationale:rationale(chosen.candidate,mode),
      evidence:chosen.candidate.evidence,
    });
  }

  return results;
}
