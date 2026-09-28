import type { MeasurementProfile } from "@/lib/measurements";
import {
  DESIGNER_STYLE_CHOICES,
  designerStyleForOccasion,
  evaluateDesignerCombo,
  type DesignerContext,
  type DesignerFabric,
  type DesignerRecommendation,
  type DesignerStyle,
  type OccasionTier,
} from "@/lib/designer/engine";
import { assessFitConstruction, type FitConstructionAssessment } from "@/lib/designer/fit-construction";
import { evaluateLinenEarthBrandLanguage, type BrandLanguageEvaluation } from "@/lib/designer/brand-language";
import { casebookSignalFor, type DesignerCasebook, type DesignerCasebookSignal } from "@/lib/designer/casebook";

export type DesignerSearchScope = "keep_shirt" | "keep_trouser" | "open";
export type DesignerSearchTier = "Safe" | "Elevated" | "Statement";

export type DesignerSearchResult = {
  id: string;
  tier: DesignerSearchTier;
  shirt: DesignerFabric;
  pant: DesignerFabric;
  style: DesignerStyle;
  recommendation: DesignerRecommendation;
  fitConstruction: FitConstructionAssessment;
  brandLanguage: BrandLanguageEvaluation;
  casebookSignal: DesignerCasebookSignal;
  searchScore: number;
  noveltyScore: number;
  reasons: string[];
  tradeoffs: string[];
  comparison: string[];
};

export type DesignerSearchInput = {
  shirts: DesignerFabric[];
  pants: DesignerFabric[];
  currentShirt: DesignerFabric;
  currentPant: DesignerFabric;
  occasion: OccasionTier;
  chosenStyle: DesignerStyle;
  context: DesignerContext;
  measurements?: MeasurementProfile | null;
  scope?: DesignerSearchScope;
  casebook?: DesignerCasebook | null;
};

type RankedCandidate = Omit<DesignerSearchResult,"comparison">;

const TARGET_NOVELTY: Record<DesignerSearchTier,number> = {
  Safe: 18,
  Elevated: 48,
  Statement: 76,
};

function pick<K extends keyof DesignerStyle>(
  key: K,
  matcher: RegExp,
  fallback: DesignerStyle[K],
): DesignerStyle[K] {
  return (DESIGNER_STYLE_CHOICES[key].find((value)=>matcher.test(value)) || fallback) as DesignerStyle[K];
}

function styleForTier(
  tier: DesignerSearchTier,
  occasion: OccasionTier,
  chosen: DesignerStyle,
): DesignerStyle {
  const base=designerStyleForOccasion(occasion);
  if(tier==="Elevated") {
    return { ...base, ...chosen, collarFinish:"Self-fabric" };
  }

  if(tier==="Safe") {
    return {
      ...base,
      collarFinish:"Self-fabric",
      shirtFit:pick("shirtFit",/regular|classic/i,base.shirtFit),
      collar:occasion==="Formal"
        ? pick("collar",/spread/i,base.collar)
        : pick("collar",/point|button[- ]?down/i,base.collar),
      trouser:occasion==="Formal"
        ? pick("trouser",/formal.*flat|flat[- ]?front/i,base.trouser)
        : occasion==="Semi-Formal"
          ? pick("trouser",/pleated|formal.*flat|flat[- ]?front/i,base.trouser)
          : pick("trouser",/formal.*flat|flat[- ]?front|cropped/i,base.trouser),
      shirtWear:occasion==="Formal"||occasion==="Semi-Formal"?"Tucked":base.shirtWear,
    };
  }

  if(occasion==="Formal") {
    return {
      ...base,
      collar:pick("collar",/cutaway|spread/i,base.collar),
      cuff:pick("cuff",/french|double/i,base.cuff),
      shirtFit:pick("shirtFit",/regular|classic/i,base.shirtFit),
      trouser:pick("trouser",/pleated/i,base.trouser),
      rise:pick("rise",/high rise/i,base.rise),
      waistband:pick("waistband",/side[- ]?adjuster/i,base.waistband),
      break:pick("break",/slight break/i,base.break),
      shirtWear:"Tucked",
      collarFinish:"Self-fabric",
    };
  }

  if(occasion==="Semi-Formal") {
    return {
      ...base,
      collar:pick("collar",/spread|point/i,base.collar),
      cuff:pick("cuff",/2-button|barrel/i,base.cuff),
      shirtFit:pick("shirtFit",/regular|classic/i,base.shirtFit),
      trouser:pick("trouser",/pleated/i,base.trouser),
      waistband:pick("waistband",/side[- ]?adjuster|belt loops/i,base.waistband),
      shirtWear:"Tucked",
      collarFinish:"Self-fabric",
    };
  }

  return {
    ...base,
    collar:pick("collar",/button[- ]?down|point/i,base.collar),
    cuff:pick("cuff",/1-button|barrel/i,base.cuff),
    shirtFit:pick("shirtFit",/relaxed/i,base.shirtFit),
    trouser:pick("trouser",/wide|relaxed drape/i,base.trouser),
    rise:pick("rise",/mid rise/i,base.rise),
    waistband:pick("waistband",/belt loops/i,base.waistband),
    break:pick("break",/no break/i,base.break),
    collarFinish:"Self-fabric",
  };
}

function prominent(fabric:DesignerFabric) {
  return fabric.patternScale==="Bold" || fabric.patternScale==="Medium-Bold";
}

function neutral(fabric:DesignerFabric) {
  return /neutral|earth|brown|beige|grey|gray|navy/i.test(fabric.colorFamily || "");
}

function noveltyScore(shirt:DesignerFabric,pant:DesignerFabric,style:DesignerStyle) {
  let score=18;
  if(prominent(shirt)||prominent(pant)) score+=22;
  if(prominent(shirt)&&prominent(pant)) score+=14;
  if(shirt.colorFamily && pant.colorFamily && shirt.colorFamily!==pant.colorFamily) score+=10;
  if(shirt.tone && pant.tone && shirt.tone!==pant.tone) score+=7;
  if(!neutral(shirt)&&!neutral(pant)) score+=8;
  if(/relaxed|wide/i.test(style.trouser)) score+=12;
  if(/relaxed/i.test(style.shirtFit)) score+=8;
  if(/cutaway/i.test(style.collar)) score+=6;
  if(style.collarFinish!=="Self-fabric") score+=8;
  return Math.max(0,Math.min(100,score));
}

function evidenceScore(recommendation:DesignerRecommendation) {
  const total=recommendation.materialEvidence.total || 1;
  return recommendation.materialEvidence.verified/total*100;
}

function hardBlocked(recommendation:DesignerRecommendation,fit:FitConstructionAssessment) {
  return recommendation.formality.match===false
    || recommendation.rules.some((item)=>item.status==="flag"&&item.severity==="High")
    || fit.checks.some((item)=>item.severity==="warning");
}

function candidateScore(
  tier:DesignerSearchTier,
  recommendation:DesignerRecommendation,
  fit:FitConstructionAssessment,
  brand:BrandLanguageEvaluation,
  novelty:number,
  casebookScore=0,
) {
  const target=TARGET_NOVELTY[tier];
  const noveltyAlignment=Math.max(0,100-Math.abs(novelty-target)*1.5);
  const material=evidenceScore(recommendation);
  const confidenceWeight=tier==="Safe" ? .22 : .16;
  const noveltyWeight=tier==="Statement" ? .15 : .10;
  const designWeight=tier==="Safe" ? .27 : .31;
  const score=
    recommendation.designFitScore*designWeight+
    recommendation.confidenceScore*confidenceWeight+
    fit.fitScore*.18+
    brand.score*.17+
    material*.06+
    noveltyAlignment*noveltyWeight+
    Math.max(-6,Math.min(6,casebookScore));
  return Math.round(score*10)/10;
}

function reasonsFor(
  tier:DesignerSearchTier,
  scope:DesignerSearchScope,
  recommendation:DesignerRecommendation,
  fit:FitConstructionAssessment,
  brand:BrandLanguageEvaluation,
  novelty:number,
  casebookSignal?:DesignerCasebookSignal,
) {
  const reasons:string[]=[];
  if(scope==="keep_shirt") reasons.push(`Keeps the selected ${recommendation.shirt.name} shirting and searches for a stronger companion trouser.`);
  if(scope==="keep_trouser") reasons.push(`Keeps the selected ${recommendation.pant.name} trouser cloth and searches for a stronger companion shirt.`);
  if(scope==="open") reasons.push("Allows both fabrics to change so the Designer can search the catalogue more broadly.");

  if(tier==="Safe") reasons.push("Prioritizes confidence, restrained pattern load and a controlled silhouette.");
  if(tier==="Elevated") reasons.push("Balances familiarity with a more considered colour, texture or tailoring relationship.");
  if(tier==="Statement") reasons.push("Uses one controlled source of novelty while preserving the hard fit and construction rules.");

  if(fit.fitScore>=85) reasons.push("The saved measurements support this cut with a strong provisional fit/construction score.");
  if(brand.score>=82 && brand.strengths[0]) reasons.push(brand.strengths[0]);
  if(novelty>=65 && tier==="Statement") reasons.push("The visual interest comes from proportion, pattern or contrast rather than stacking several loud ideas.");
  if(casebookSignal && casebookSignal.evidence>=3 && casebookSignal.score>=2) reasons.push(`Operator-reviewed casebook supports this direction: ${casebookSignal.summary}`);
  return reasons.slice(0,4);
}

function tradeoffsFor(
  recommendation:DesignerRecommendation,
  fit:FitConstructionAssessment,
  brand:BrandLanguageEvaluation,
) {
  const tradeoffs=[
    ...fit.checks.filter((item)=>item.severity==="review").map((item)=>item.message),
    ...recommendation.rules.filter((item)=>item.status==="unknown"&&item.severity!=="Low").map((item)=>item.explanation),
    ...brand.cautions,
  ];
  return [...new Set(tradeoffs)].slice(0,3);
}

function currentMetrics(input:DesignerSearchInput,tier:DesignerSearchTier) {
  const style=styleForTier(tier,input.occasion,input.chosenStyle);
  const recommendation=evaluateDesignerCombo(input.currentShirt,input.currentPant,input.occasion,style,undefined,input.context);
  const fit=assessFitConstruction(input.measurements,style,{climate:input.context.climate,shirtFabric:input.currentShirt,trouserFabric:input.currentPant});
  const brand=evaluateLinenEarthBrandLanguage(input.currentShirt,input.currentPant,style,input.occasion,input.context);
  return { recommendation,fit,brand,novelty:noveltyScore(input.currentShirt,input.currentPant,style) };
}

function comparisonFor(candidate:RankedCandidate,input:DesignerSearchInput) {
  const current=currentMetrics(input,candidate.tier);
  const notes:string[]=[];
  const samePair=candidate.shirt.id===input.currentShirt.id&&candidate.pant.id===input.currentPant.id;
  if(samePair) return ["Your current fabric pair already earns this direction; the main difference is the cut treatment."];

  if(candidate.recommendation.designFitScore>=current.recommendation.designFitScore+5) {
    notes.push(`Stronger rule fit: ${candidate.recommendation.designFitScore}/100 vs ${current.recommendation.designFitScore}/100 for the current pair.`);
  }
  if(candidate.fitConstruction.fitScore>=current.fit.fitScore+5) {
    notes.push(`Better measurement-aware cut fit: ${candidate.fitConstruction.fitScore}/100 vs ${current.fit.fitScore}/100.`);
  }
  if(candidate.brandLanguage.score>=current.brand.score+6) {
    notes.push(`Closer to Linen Earth design language: ${candidate.brandLanguage.score}/100 vs ${current.brand.score}/100.`);
  }
  const candidateEvidence=evidenceScore(candidate.recommendation);
  const currentEvidence=evidenceScore(current.recommendation);
  if(candidateEvidence>=currentEvidence+10) {
    notes.push("More of the material decision is supported by verified cloth metadata.");
  }
  if(!notes.length) {
    notes.push("This is not simply 'better'; it offers a clearer version of this tier while keeping the hard constraints intact.");
  }
  const currentProblems=[
    ...current.recommendation.rules.filter((item)=>item.status==="flag").map((item)=>item.explanation),
    ...current.fit.checks.filter((item)=>item.severity==="warning"||item.severity==="review").map((item)=>item.message),
  ];
  if(currentProblems[0]) notes.push(`The current direction still needs attention here: ${currentProblems[0]}`);
  return notes.slice(0,3);
}

function signaturesDiffer(a:RankedCandidate,b:RankedCandidate) {
  if(a.shirt.id!==b.shirt.id || a.pant.id!==b.pant.id) return true;
  return JSON.stringify(a.style)!==JSON.stringify(b.style);
}

export function searchDesignerCatalogue(input:DesignerSearchInput):DesignerSearchResult[] {
  const scope=input.scope || "keep_shirt";
  const shirts=scope==="keep_shirt" ? [input.currentShirt] : input.shirts;
  const pants=scope==="keep_trouser" ? [input.currentPant] : input.pants;
  const tiers:DesignerSearchTier[]=["Safe","Elevated","Statement"];
  const rankedByTier=new Map<DesignerSearchTier,RankedCandidate[]>();

  for(const tier of tiers) {
    const style=styleForTier(tier,input.occasion,input.chosenStyle);
    const ranked:RankedCandidate[]=[];
    for(const shirt of shirts) {
      for(const pant of pants) {
        const recommendation=evaluateDesignerCombo(shirt,pant,input.occasion,style,undefined,input.context);
        const fit=assessFitConstruction(input.measurements,style,{climate:input.context.climate,shirtFabric:shirt,trouserFabric:pant});
        if(hardBlocked(recommendation,fit)) continue;
        const brand=evaluateLinenEarthBrandLanguage(shirt,pant,style,input.occasion,input.context);
        const novelty=noveltyScore(shirt,pant,style);
        const casebookSignal=casebookSignalFor(recommendation,input.casebook);
        ranked.push({
          id:`${tier.toLowerCase()}:${shirt.id}:${pant.id}`,
          tier,shirt,pant,style,recommendation,fitConstruction:fit,brandLanguage:brand,casebookSignal,
          searchScore:candidateScore(tier,recommendation,fit,brand,novelty,casebookSignal.score),
          noveltyScore:novelty,
          reasons:reasonsFor(tier,scope,recommendation,fit,brand,novelty,casebookSignal),
          tradeoffs:[
            ...tradeoffsFor(recommendation,fit,brand),
            ...(casebookSignal.evidence>=3 && casebookSignal.score<=-2 ? [`Operator-reviewed casebook caution: ${casebookSignal.summary}`] : []),
          ].slice(0,3),
        });
      }
    }
    ranked.sort((a,b)=>b.searchScore-a.searchScore
      || b.recommendation.confidenceScore-a.recommendation.confidenceScore
      || b.brandLanguage.score-a.brandLanguage.score);
    rankedByTier.set(tier,ranked);
  }

  const chosen:RankedCandidate[]=[];
  for(const tier of tiers) {
    const ranked=rankedByTier.get(tier) || [];
    const candidate=ranked.find((item)=>chosen.every((picked)=>signaturesDiffer(item,picked))) || ranked[0];
    if(candidate) chosen.push(candidate);
  }

  return chosen.map((candidate)=>({
    ...candidate,
    comparison:comparisonFor(candidate,input),
  }));
}

export function explainWhyNotCurrentPair(input:DesignerSearchInput) {
  const tiers:DesignerSearchTier[]=["Safe","Elevated","Statement"];
  return tiers.map((tier)=>{
    const current=currentMetrics(input,tier);
    const blockers=current.recommendation.rules.filter((item)=>item.status==="flag").map((item)=>item.explanation);
    const fitIssues=current.fit.checks.filter((item)=>item.severity!=="info").map((item)=>item.message);
    const unknowns=current.recommendation.rules.filter((item)=>item.status==="unknown"&&item.severity!=="Low").map((item)=>item.explanation);
    return {
      tier,
      acceptable:!hardBlocked(current.recommendation,current.fit),
      reasons:[...blockers,...fitIssues,...unknowns,...current.brand.cautions].filter((value,index,all)=>all.indexOf(value)===index).slice(0,5),
    };
  });
}
