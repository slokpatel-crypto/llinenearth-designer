import type { MeasurementProfile } from "@/lib/measurements";
import type { TailorObservationProfile } from "@/lib/designer/tailor-observations";
import type { DesignerFabricIntelligence } from "@/lib/fabric-intelligence-types";
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
import { assessBlockStrategy, type DesignerBlockStrategy } from "@/lib/designer/block-strategy";
import { evaluateLinenEarthBrandLanguage, type BrandLanguageEvaluation } from "@/lib/designer/brand-language";
import { casebookSignalFor, type DesignerCasebook, type DesignerCasebookSignal } from "@/lib/designer/casebook";
import { fitOutcomeProportionFromMeasurements, fitOutcomeSignalFor, type FitOutcomeBook, type FitOutcomeSignal } from "@/lib/designer/fit-outcomes";

import { colorFamilyPairSignal, optionIdForLabel } from "@/lib/vocab";
import { FABRIC_INTELLIGENCE_WEIGHTS as FIW } from "@/lib/designer/weights";

export type DesignerSearchScope = "keep_shirt" | "keep_trouser" | "open";
export type DesignerSearchTier = "Safe" | "Elevated" | "Statement";

export type DesignerSearchPreference = {
  wantedTokens:string[];
  avoidTokens:string[];
  preferredPattern?:"plain"|"stripe"|"check"|"print";
  preferredTier?:DesignerSearchTier;
  strictOccasionFit?:boolean;
};

export type DesignerDecisionDimension = {
  id: "compatibility" | "fit" | "block" | "brand" | "material" | "novelty" | "learning";
  label: string;
  score: number;
  weight: number;
  status: "strong" | "review" | "weak";
  evidence: string;
};

export type DesignerDecisionRead = {
  version: "designer-decision-v4";
  overall: number;
  certainty: number;
  risk: "low" | "moderate" | "high";
  dimensions: DesignerDecisionDimension[];
  dominantStrengths: string[];
  uncertainties: string[];
};

export type DesignerSearchResult = {
  id: string;
  tier: DesignerSearchTier;
  shirt: DesignerFabric;
  pant: DesignerFabric;
  style: DesignerStyle;
  recommendation: DesignerRecommendation;
  fitConstruction: FitConstructionAssessment;
  brandLanguage: BrandLanguageEvaluation;
  blockStrategy: DesignerBlockStrategy;
  casebookSignal: DesignerCasebookSignal;
  fitOutcomeSignal: FitOutcomeSignal;
  decision: DesignerDecisionRead;
  searchScore: number;
  noveltyScore: number;
  reasons: string[];
  tradeoffs: string[];
  comparison: string[];
  fitAdaptation?: string;
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
  observations?: TailorObservationProfile | null;
  scope?: DesignerSearchScope;
  casebook?: DesignerCasebook | null;
  fitOutcomes?: FitOutcomeBook | null;
  preference?: DesignerSearchPreference | null;
  fabricIntelligence?: Record<string,DesignerFabricIntelligence> | null;
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
          ? pick("trouser",/pleated/i,base.trouser)
          : occasion==="Smart-Casual"
            ? pick("trouser",/cropped|ankle/i,base.trouser)
            : pick("trouser",/jean[- ]?cut/i,base.trouser),
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

function fitAdaptedStyle(
  style:DesignerStyle,
  measurements?:MeasurementProfile|null,
  observations?:TailorObservationProfile|null,
) {
  const first=assessBlockStrategy(measurements,style,observations);
  const patch=first.suggestedPatch;
  if(!patch || !Object.keys(patch).length) return {style,reason:""};

  const next={...style};
  const changed:string[]=[];
  for(const [key,value] of Object.entries(patch) as Array<[keyof DesignerStyle,string]>) {
    if(!value || !DESIGNER_STYLE_CHOICES[key].includes(value) || next[key]===value) continue;
    next[key]=value;
    changed.push(key==="shirtFit" ? `shirt fit → ${value}` : key==="trouser" ? `trouser → ${value}` : `${String(key)} → ${value}`);
  }
  return {
    style:next,
    reason:changed.length ? `Fit-aware adjustment: ${changed.join("; ")} based on saved measurements/tailor observations.` : "",
  };
}

function occasionPreferredShirts(shirts:DesignerFabric[],occasion:OccasionTier) {
  const filtered=shirts.filter((shirt)=>{
    const text=searchableFabric(shirt);
    if(occasion==="Formal") {
      if(/linen print|printed linen blend|botanical|floral|leaf|abstract|chevron|mosaic/.test(text)) return false;
      return /formal shirting/.test(text) || (/linen plain/.test(text) && /blue|grey|gray|offwhite|black|stresa|boulder/.test(text));
    }
    if(occasion==="Semi-Formal") {
      return /formal shirting|linen plain/.test(text) && !/jute feel|saffron|dijon|light green/.test(text);
    }
    if(occasion==="Casual") {
      return /linen plain|linen print|printed linen blend/.test(text) && !/formal shirting/.test(text);
    }
    return /linen plain|linen print|printed linen blend|formal shirting/.test(text);
  });
  return filtered.length>=3 ? filtered : shirts;
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

function searchableFabric(fabric:DesignerFabric) {
  return [
    fabric.name,fabric.line,fabric.colorFamily,fabric.tone,fabric.patternType,
    fabric.weave,fabric.texture,fabric.fiberContent,...(fabric.bestSeason || []),
  ].filter(Boolean).join(" ").toLowerCase();
}

const OCCASION_INTELLIGENCE_IDS:Record<OccasionTier,ReadonlySet<string>>={
  Formal:new Set(["boardroom_business_formal","black_tie_evening","cocktail_evening","wedding","reception"]),
  "Semi-Formal":new Set(["office_business","interview","wedding","reception","festive","summer_event"]),
  "Smart-Casual":new Set(["smart_casual_dinner","date","brunch","travel","summer_event"]),
  Casual:new Set(["weekend_casual","resort_holiday","travel","brunch"]),
};

function intelOccasionMatch(intel:DesignerFabricIntelligence,occasion:OccasionTier) {
  const allowed=OCCASION_INTELLIGENCE_IDS[occasion];
  return intel.bestOccasions.some((id)=>allowed.has(id));
}

function patternSupportScore(primary:DesignerFabricIntelligence,companion:DesignerFabricIntelligence) {
  const strategy=new Set(primary.pairing.goodPatternStrategy);
  const w=FIW.patternStrategy;
  let score=0;
  if(strategy.has("solid_support") && companion.patternFamily==="solid") score+=w.solidSupport;
  if(strategy.has("single_hero_pattern") && companion.statementLevel<=2) score+=w.singleHero;
  if(strategy.has("tonal_low_contrast") && companion.patternContrast==="low") score+=w.tonalLowContrast;
  if(strategy.has("fine_scale_only") && companion.patternScale==="fine") score+=w.fineScale;
  if(strategy.has("no_competing_pattern") && companion.patternFamily!=="solid") score+=w.noCompeting;
  return score;
}

function fabricIntelligenceAlignment(
  tier:DesignerSearchTier,
  occasion:OccasionTier,
  style:DesignerStyle,
  shirt:DesignerFabric,
  pant:DesignerFabric,
  map?:Record<string,DesignerFabricIntelligence>|null,
  context?:DesignerContext,
) {
  if(!map) return 0;
  const shirtIntel=map[shirt.id];
  const pantIntel=map[pant.id];
  if(!shirtIntel && !pantIntel) return 0;

  const targetFormality:Record<OccasionTier,number>={
    Casual:FIW.targetFormality.Casual,
    "Smart-Casual":FIW.targetFormality.SmartCasual,
    "Semi-Formal":FIW.targetFormality.SemiFormal,
    Formal:FIW.targetFormality.Formal,
  };
  const targetStatement:Record<DesignerSearchTier,number>={
    Safe:FIW.targetStatement.Safe,
    Elevated:FIW.targetStatement.Elevated,
    Statement:FIW.targetStatement.Statement,
  };
  const trustWeight=(value:DesignerFabricIntelligence|undefined)=>{
    if(!value) return 0;
    if(value.trust==="reviewed") return FIW.trust.reviewed;
    if(value.trust==="high-confidence") return FIW.trust.highConfidence;
    return FIW.trust.provisional;
  };

  let score=0;
  for(const intel of [shirtIntel,pantIntel]) {
    if(!intel) continue;
    const w=trustWeight(intel);
    const formalityFit=1-Math.min(1,Math.abs(intel.formality-targetFormality[occasion])/FIW.formality.range);
    const statementFit=1-Math.min(1,Math.abs(intel.statementLevel-targetStatement[tier])/FIW.statement.range);
    score+=(formalityFit*FIW.formality.scale-FIW.formality.base)*w;
    score+=(statementFit*FIW.statement.scale-FIW.statement.base)*w;
    if(intelOccasionMatch(intel,occasion)) score+=FIW.occasionMatch*w;
  }

  if(shirtIntel) {
    const w=trustWeight(shirtIntel);
    if(shirtIntel.bestGarments.some((value)=>value==="shirt"||value==="overshirt")) score+=FIW.garmentRole*w;
    const collarId=optionIdForLabel("collar",style.collar);
    const cuffId=optionIdForLabel("cuff",style.cuff);
    const fitId=optionIdForLabel("shirtFit",style.shirtFit);
    if(collarId && shirtIntel.recommendedConstruction.collars.includes(collarId)) score+=FIW.recommended.collar*w;
    if(cuffId && shirtIntel.recommendedConstruction.cuffs.includes(cuffId)) score+=FIW.recommended.cuff*w;
    if(fitId && shirtIntel.recommendedConstruction.shirtFits.includes(fitId)) score+=FIW.recommended.shirtFit*w;
    if(pantIntel?.colorFamily) {
      const colorSignal=colorFamilyPairSignal(shirtIntel.pairing.goodColorFamilies,shirtIntel.pairing.avoidColorFamilies,pantIntel.colorFamily);
      if(colorSignal>0) score+=FIW.colorPair.shirtGood*w;
      if(colorSignal<0) score+=FIW.colorPair.shirtAvoid*w;
    }
  }

  if(pantIntel) {
    const w=trustWeight(pantIntel);
    if(pantIntel.bestGarments.some((value)=>value==="trouser"||value==="chino"||value==="suit")) score+=FIW.garmentRole*w;
    const trouserId=optionIdForLabel("trouser",style.trouser);
    if(trouserId && pantIntel.recommendedConstruction.trouserDirections.includes(trouserId)) score+=FIW.recommended.trouser*w;
    if(shirtIntel?.colorFamily) {
      const colorSignal=colorFamilyPairSignal(pantIntel.pairing.goodColorFamilies,pantIntel.pairing.avoidColorFamilies,shirtIntel.colorFamily);
      if(colorSignal>0) score+=FIW.colorPair.pantGood*w;
      if(colorSignal<0) score+=FIW.colorPair.pantAvoid*w;
    }
  }

  if(shirtIntel && pantIntel) {
    const pairWeight=Math.min(trustWeight(shirtIntel),trustWeight(pantIntel));
    if(shirtIntel.statementLevel>=4 && pantIntel.statementLevel>=4) score+=FIW.statementPair.bothHigh*pairWeight;
    if(Math.max(shirtIntel.statementLevel,pantIntel.statementLevel)>=4 && Math.min(shirtIntel.statementLevel,pantIntel.statementLevel)<=2) score+=FIW.statementPair.heroQuiet*pairWeight;

    const bothPatterned=shirtIntel.patternFamily!=="solid" && pantIntel.patternFamily!=="solid";
    const bothHighContrast=shirtIntel.patternContrast==="high" && pantIntel.patternContrast==="high";
    const bothBold=shirtIntel.patternScale==="bold" && pantIntel.patternScale==="bold";
    if(bothPatterned && (bothHighContrast || bothBold)) score+=FIW.patternPair.bothStrong*pairWeight;
    if(shirtIntel.patternFamily!=="solid" && pantIntel.patternFamily==="solid") score+=FIW.patternPair.shirtHeroSolidPant*pairWeight;
    if(shirtIntel.patternFamily==="solid" && pantIntel.patternFamily!=="solid") score+=FIW.patternPair.solidShirtPantHero*pairWeight;

    score+=patternSupportScore(shirtIntel,pantIntel)*pairWeight;
    score+=patternSupportScore(pantIntel,shirtIntel)*pairWeight;

    if(shirtIntel.sheen==="high" && pantIntel.sheen==="high") score+=FIW.sheen.bothHigh*pairWeight;
    if(shirtIntel.visualWeight==="heavy-looking" && pantIntel.visualWeight==="light-looking") score+=FIW.visualWeight.heavyShirtLightPant*pairWeight;
    if(shirtIntel.visualWeight==="light-looking" && pantIntel.visualWeight==="heavy-looking") score+=FIW.visualWeight.lightShirtHeavyPant*pairWeight;
  }

  if(context?.climate && context.climate!=="Not specified") {
    const climate=context.climate.toLowerCase();
    for(const intel of [shirtIntel,pantIntel]) {
      if(!intel) continue;
      const w=trustWeight(intel);
      const tags=new Set(intel.climateVisualFit);
      if(climate.includes("hot") && (tags.has("hot_humid")||tags.has("hot_dry")||tags.has("warm"))) score+=FIW.climate.hotMatch*w;
      if(climate.includes("cool") && tags.has("cool")) score+=FIW.climate.coolMatch*w;
      if(climate.includes("air-conditioned") && (tags.has("air_conditioned")||tags.has("all_season"))) score+=FIW.climate.airConditionedMatch*w;
    }
  }

  return Math.max(FIW.clamp.min,Math.min(FIW.clamp.max,score));
}

function preferenceAlignment(
  tier:DesignerSearchTier,
  shirt:DesignerFabric,
  pant:DesignerFabric,
  preference?:DesignerSearchPreference|null,
) {
  if(!preference) return 0;
  const hay=`${searchableFabric(shirt)} ${searchableFabric(pant)}`;
  let score=0;
  for(const token of preference.wantedTokens.slice(0,5)) if(hay.includes(token.toLowerCase())) score+=4;
  for(const token of preference.avoidTokens.slice(0,5)) if(hay.includes(token.toLowerCase())) score-=9;

  const patterns=`${shirt.patternType} ${pant.patternType}`.toLowerCase();
  if(preference.preferredPattern==="plain" && /solid|plain/.test(patterns)) score+=7;
  if(preference.preferredPattern==="stripe" && /stripe/.test(patterns)) score+=7;
  if(preference.preferredPattern==="check" && /check|windowpane|gingham/.test(patterns)) score+=7;
  if(preference.preferredPattern==="print" && /print|floral|geometric/.test(patterns)) score+=7;
  if(preference.preferredTier===tier) score+=8;
  return Math.max(-24,Math.min(20,score));
}

function occasionFabricAlignment(
  occasion:OccasionTier,
  shirt:DesignerFabric,
  pant:DesignerFabric,
) {
  const shirtText=searchableFabric(shirt);
  const pantText=searchableFabric(pant);
  const combined=`${shirtText} ${pantText}`;
  let score=0;

  if(occasion==="Formal") {
    if(/formal shirting/.test(shirtText)) score+=24;
    if(/pin stripe|fine stripe|solid|plain/.test(shirtText)) score+=10;
    if(/botanical|floral|leaf|abstract|chevron|mosaic|printed linen blend|linen print/.test(shirtText)) score-=34;
    if(shirt.tone==="Dark" || shirt.tone==="Medium") score+=4;
    if(pant.tone==="Dark" || /charcoal|dark grey|slate|platinum/.test(pantText)) score+=7;
  } else if(occasion==="Semi-Formal") {
    if(/formal shirting/.test(shirtText)) score+=13;
    if(/solid|plain|pin stripe|fine stripe|windowpane|micro check/.test(shirtText)) score+=7;
    if(/botanical|floral|abstract|chevron|mosaic/.test(shirtText)) score-=16;
    if(/charcoal|grey|gray|navy|blue|taupe|beige|platinum/.test(pantText)) score+=4;
  } else if(occasion==="Smart-Casual") {
    if(/linen plain|linen print|printed linen blend/.test(shirtText)) score+=10;
    if(/formal shirting/.test(shirtText)) score-=5;
    if(/stripe|check|print|solid|plain/.test(shirtText)) score+=4;
    if(/cream|beige|taupe|blue|rose|orchid/.test(pantText)) score+=3;
  } else {
    if(/linen plain|linen print|printed linen blend/.test(shirtText)) score+=18;
    if(/formal shirting/.test(shirtText)) score-=18;
    if(/botanical|floral|leaf|abstract|chevron|mosaic|print/.test(shirtText)) score+=8;
    if(/light|cream|beige|taupe|blue|rose|orchid/.test(combined)) score+=4;
  }
  return Math.max(-36,Math.min(36,score));
}

function occasionFabricReason(
  occasion:OccasionTier,
  shirt:DesignerFabric,
) {
  const text=searchableFabric(shirt);
  if(occasion==="Formal" && /formal shirting/.test(text)) return "Occasion match: formal shirting is prioritized for a cleaner formal read.";
  if(occasion==="Formal" && /solid|plain|pin stripe|fine stripe/.test(text)) return "Occasion match: restrained shirt pattern supports the formal brief.";
  if(occasion==="Casual" && /linen plain|linen print|printed linen blend/.test(text)) return "Occasion match: relaxed Linen Earth shirting is prioritized for the casual brief.";
  if(occasion==="Smart-Casual" && /linen plain|linen print|printed linen blend/.test(text)) return "Occasion match: the cloth keeps the look relaxed while still considered.";
  if(occasion==="Semi-Formal" && /formal shirting/.test(text)) return "Occasion match: the shirt sits comfortably in a semi-formal direction.";
  return "";
}

function preferenceReason(
  tier:DesignerSearchTier,
  shirt:DesignerFabric,
  pant:DesignerFabric,
  preference?:DesignerSearchPreference|null,
) {
  if(!preference) return "";
  const hay=`${searchableFabric(shirt)} ${searchableFabric(pant)}`;
  const matched=preference.wantedTokens.filter((token)=>hay.includes(token.toLowerCase())).slice(0,3);
  const parts:string[]=[];
  if(matched.length) parts.push(`matches your ${matched.join(", ")} colour direction`);
  if(preference.preferredPattern) parts.push(`leans toward ${preference.preferredPattern} cloth`);
  if(preference.preferredTier===tier) parts.push(`matches the requested ${tier.toLowerCase()} energy`);
  return parts.length ? `Brief match: ${parts.join("; ")}.` : "";
}

function evidenceScore(recommendation:DesignerRecommendation) {
  const total=recommendation.materialEvidence.total || 1;
  return recommendation.materialEvidence.verified/total*100;
}

function hardBlocked(recommendation:DesignerRecommendation,fit:FitConstructionAssessment) {
  // Occasion-band mismatch remains visible as a review/ranking signal rather
  // than deleting an entire Safe/Elevated/Statement tier. Hard construction
  // conflicts and measurement fit warnings still remove a candidate.
  return recommendation.rules.some((item)=>item.status==="flag"&&item.severity==="High")
    || fit.checks.some((item)=>item.severity==="warning");
}

function clampScore(value:number) {
  return Math.max(0,Math.min(100,value));
}

function decisionStatus(score:number):DesignerDecisionDimension["status"] {
  return score>=82 ? "strong" : score>=65 ? "review" : "weak";
}

function buildDecisionRead(
  tier:DesignerSearchTier,
  recommendation:DesignerRecommendation,
  fit:FitConstructionAssessment,
  brand:BrandLanguageEvaluation,
  block:DesignerBlockStrategy,
  novelty:number,
  casebookSignal:DesignerCasebookSignal,
  fitOutcomeSignal:FitOutcomeSignal,
):DesignerDecisionRead {
  const target=TARGET_NOVELTY[tier];
  const noveltyAlignment=clampScore(100-Math.abs(novelty-target)*1.5);
  const material=clampScore(evidenceScore(recommendation));
  const learned=clampScore(
    50+
    Math.max(-6,Math.min(6,casebookSignal.score))*5+
    Math.max(-4,Math.min(4,fitOutcomeSignal.score))*7
  );

  const raw=[
    {
      id:"compatibility" as const,label:"Rule fit",score:recommendation.designFitScore,weight:.28,
      evidence:"Occasion, colour, pattern, construction and fabric compatibility rules.",
    },
    {
      id:"fit" as const,label:"Fit + construction",score:fit.fitScore,weight:.18,
      evidence:"Measurement-aware ease, proportion and construction checks.",
    },
    {
      id:"block" as const,label:"Block strategy",score:block.score,weight:.10,
      evidence:"Starting shirt and trouser block suitability for the recorded proportions.",
    },
    {
      id:"brand" as const,label:"Linen Earth",score:brand.score,weight:.14,
      evidence:"Soft brand-language alignment; never overrides hard fit or cloth constraints.",
    },
    {
      id:"material" as const,label:"Cloth evidence",score:material,weight:.10,
      evidence:"Share of physical fabric facts verified for the two selected cloths.",
    },
    {
      id:"novelty" as const,label:"Novelty control",score:noveltyAlignment,weight:.12,
      evidence:`How closely the visual energy matches the ${tier.toLowerCase()} direction.`,
    },
    {
      id:"learning" as const,label:"Reviewed evidence",score:learned,weight:.08,
      evidence:"Operator casebook and reviewed first-fit outcomes; neutral while evidence is sparse.",
    },
  ];

  const dimensions:DesignerDecisionDimension[]=raw.map((item)=>({
    ...item,score:Math.round(clampScore(item.score)*10)/10,status:decisionStatus(item.score),
  }));
  const weighted=dimensions.reduce((sum,item)=>sum+item.score*item.weight,0);
  const learningCoverage=clampScore((casebookSignal.evidence+fitOutcomeSignal.evidence)*8);
  const certainty=clampScore(
    recommendation.confidenceScore*.70+
    material*.20+
    learningCoverage*.10
  );
  // Uncertainty can lower a ranking slightly, but never overwhelms the hard
  // construction and fit rules that already decide whether a candidate enters search.
  const uncertaintyPenalty=Math.max(0,65-certainty)*.12;
  const overall=Math.round(clampScore(weighted-uncertaintyPenalty)*10)/10;

  const sorted=[...dimensions].sort((a,b)=>b.score-a.score);
  const dominantStrengths=sorted.filter((item)=>item.status==="strong").slice(0,2)
    .map((item)=>`${item.label} ${Math.round(item.score)}/100`);
  const uncertainties:string[]=[];
  if(material<55) uncertainties.push("Physical cloth evidence is still incomplete; verify GSM, drape, opacity and available metres.");
  if(recommendation.confidenceScore<70) uncertainties.push("Several Designer rules still depend on unverified or approximate inputs.");
  if(casebookSignal.evidence<3 && fitOutcomeSignal.evidence<3) uncertainties.push("Reviewed operator and first-fit evidence is still too sparse to materially influence this direction.");
  if(fit.fitScore<78) uncertainties.push("Measurement-aware fit/construction still needs review.");
  if(block.score<75) uncertainties.push("The starting block needs more adjustment than the stronger alternatives.");
  if(brand.score<70) uncertainties.push("The direction sits outside the current Linen Earth taste language, though hard rules still take priority.");

  const risk:DesignerDecisionRead["risk"] =
    certainty<50 || material<20 || recommendation.designFitScore<70 || fit.fitScore<70 ? "high"
      : certainty<72 || uncertainties.length>=2 ? "moderate" : "low";

  return {
    version:"designer-decision-v4",
    overall,
    certainty:Math.round(certainty*10)/10,
    risk,
    dimensions,
    dominantStrengths,
    uncertainties:uncertainties.slice(0,3),
  };
}

function reasonsFor(
  tier:DesignerSearchTier,
  scope:DesignerSearchScope,
  recommendation:DesignerRecommendation,
  fit:FitConstructionAssessment,
  brand:BrandLanguageEvaluation,
  block:DesignerBlockStrategy,
  novelty:number,
  casebookSignal?:DesignerCasebookSignal,
  fitOutcomeSignal?:FitOutcomeSignal,
) {
  const reasons:string[]=[];
  if(scope==="keep_shirt") reasons.push(`Keeps the selected ${recommendation.shirt.name} shirting and searches for a stronger companion trouser.`);
  if(scope==="keep_trouser") reasons.push(`Keeps the selected ${recommendation.pant.name} trouser cloth and searches for a stronger companion shirt.`);
  if(scope==="open") reasons.push("Allows both fabrics to change so the Designer can search the catalogue more broadly.");

  if(tier==="Safe") reasons.push("Prioritizes confidence, restrained pattern load and a controlled silhouette.");
  if(tier==="Elevated") reasons.push("Balances familiarity with a more considered colour, texture or tailoring relationship.");
  if(tier==="Statement") reasons.push("Uses one controlled source of novelty while preserving the hard fit and construction rules.");

  if(fit.fitScore>=85) reasons.push("The saved measurements support this cut with a strong provisional fit/construction score.");
  if(block.score>=85) reasons.push(`The starting-block strategy is strong for the recorded proportions: ${block.shirtBlock} + ${block.trouserBlock}.`);
  if(brand.score>=82 && brand.strengths[0]) reasons.push(brand.strengths[0]);
  if(novelty>=65 && tier==="Statement") reasons.push("The visual interest comes from proportion, pattern or contrast rather than stacking several loud ideas.");
  if(casebookSignal && casebookSignal.evidence>=3 && casebookSignal.score>=2) reasons.push(`Operator-reviewed casebook supports this direction: ${casebookSignal.summary}`);
  if(fitOutcomeSignal && fitOutcomeSignal.evidence>=3 && fitOutcomeSignal.score>=1.5) reasons.push(`Reviewed first-fit outcomes support this cut: ${fitOutcomeSignal.summary}`);
  return reasons.slice(0,4);
}

function tradeoffsFor(
  recommendation:DesignerRecommendation,
  fit:FitConstructionAssessment,
  brand:BrandLanguageEvaluation,
  block:DesignerBlockStrategy,
) {
  const tradeoffs=[
    ...fit.checks.filter((item)=>item.severity==="review").map((item)=>item.message),
    ...block.adjustments.filter((item)=>item.severity!=="info").map((item)=>item.message),
    ...recommendation.rules.filter((item)=>item.status==="unknown"&&item.severity!=="Low").map((item)=>item.explanation),
    ...brand.cautions,
  ];
  return [...new Set(tradeoffs)].slice(0,3);
}

function currentMetrics(input:DesignerSearchInput,tier:DesignerSearchTier) {
  const baseStyle=styleForTier(tier,input.occasion,input.chosenStyle);
  const style=fitAdaptedStyle(baseStyle,input.measurements,input.observations).style;
  const recommendation=evaluateDesignerCombo(input.currentShirt,input.currentPant,input.occasion,style,undefined,input.context);
  const fit=assessFitConstruction(input.measurements,style,{climate:input.context.climate,shirtFabric:input.currentShirt,trouserFabric:input.currentPant,observations:input.observations});
  const brand=evaluateLinenEarthBrandLanguage(input.currentShirt,input.currentPant,style,input.occasion,input.context);
  const block=assessBlockStrategy(input.measurements,style,input.observations);
  return { recommendation,fit,brand,block,novelty:noveltyScore(input.currentShirt,input.currentPant,style) };
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
  if(candidate.blockStrategy.score>=current.block.score+6) {
    notes.push(`Stronger starting-block strategy: ${candidate.blockStrategy.score}/100 vs ${current.block.score}/100.`);
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
    ...current.block.adjustments.filter((item)=>item.severity==="warning"||item.severity==="review").map((item)=>item.message),
  ];
  if(currentProblems[0]) notes.push(`The current direction still needs attention here: ${currentProblems[0]}`);
  return notes.slice(0,3);
}

function signaturesDiffer(a:RankedCandidate,b:RankedCandidate) {
  if(a.shirt.id!==b.shirt.id || a.pant.id!==b.pant.id) return true;
  return JSON.stringify(a.style)!==JSON.stringify(b.style);
}

function fabricPairDiffers(a:RankedCandidate,b:RankedCandidate) {
  return a.shirt.id!==b.shirt.id || a.pant.id!==b.pant.id;
}

export function searchDesignerCatalogue(input:DesignerSearchInput):DesignerSearchResult[] {
  const scope=input.scope || "keep_shirt";
  const openShirts=input.preference?.strictOccasionFit ? occasionPreferredShirts(input.shirts,input.occasion) : input.shirts;
  const shirts=scope==="keep_shirt" ? [input.currentShirt] : openShirts;
  const pants=scope==="keep_trouser" ? [input.currentPant] : input.pants;
  const tiers:DesignerSearchTier[]=["Safe","Elevated","Statement"];
  const rankedByTier=new Map<DesignerSearchTier,RankedCandidate[]>();

  for(const tier of tiers) {
    const baseStyle=styleForTier(tier,input.occasion,input.chosenStyle);
    const adapted=fitAdaptedStyle(baseStyle,input.measurements,input.observations);
    const style=adapted.style;
    const ranked:RankedCandidate[]=[];
    for(const shirt of shirts) {
      for(const pant of pants) {
        const recommendation=evaluateDesignerCombo(shirt,pant,input.occasion,style,undefined,input.context);
        const fit=assessFitConstruction(input.measurements,style,{climate:input.context.climate,shirtFabric:shirt,trouserFabric:pant,observations:input.observations});
        if(hardBlocked(recommendation,fit)) continue;
        const brand=evaluateLinenEarthBrandLanguage(shirt,pant,style,input.occasion,input.context);
        const block=assessBlockStrategy(input.measurements,style,input.observations);
        const novelty=noveltyScore(shirt,pant,style);
        const casebookSignal=casebookSignalFor(recommendation,input.casebook);
        const fitOutcomeSignal=fitOutcomeSignalFor({
          occasion:input.occasion,
          style,
          proportion:fitOutcomeProportionFromMeasurements(input.measurements),
        },input.fitOutcomes);
        const decision=buildDecisionRead(tier,recommendation,fit,brand,block,novelty,casebookSignal,fitOutcomeSignal);
        const briefScore=preferenceAlignment(tier,shirt,pant,input.preference);
        const occasionScore=occasionFabricAlignment(input.occasion,shirt,pant);
        const intelligenceScore=fabricIntelligenceAlignment(tier,input.occasion,style,shirt,pant,input.fabricIntelligence,input.context);
        const briefReason=preferenceReason(tier,shirt,pant,input.preference);
        const occasionReason=occasionFabricReason(input.occasion,shirt);
        ranked.push({
          id:`${tier.toLowerCase()}:${shirt.id}:${pant.id}`,
          tier,shirt,pant,style,recommendation,fitConstruction:fit,brandLanguage:brand,blockStrategy:block,casebookSignal,fitOutcomeSignal,decision,
          searchScore:clampScore(decision.overall+briefScore+occasionScore+intelligenceScore),
          noveltyScore:novelty,
          reasons:[...(adapted.reason?[adapted.reason]:[]),...reasonsFor(tier,scope,recommendation,fit,brand,block,novelty,casebookSignal,fitOutcomeSignal),...(occasionReason?[occasionReason]:[]),...(briefReason?[briefReason]:[])].slice(0,4),
          ...(adapted.reason ? {fitAdaptation:adapted.reason} : {}),
          tradeoffs:[
            ...tradeoffsFor(recommendation,fit,brand,block),
            ...(casebookSignal.evidence>=3 && casebookSignal.score<=-2 ? [`Operator-reviewed casebook caution: ${casebookSignal.summary}`] : []),
            ...(fitOutcomeSignal.evidence>=3 && fitOutcomeSignal.score<=-1.5 ? [`Reviewed first-fit caution: ${fitOutcomeSignal.summary}`] : []),
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
    // Prefer genuinely different fabric pairs across the three directions.
    // A style-only variation is a fallback, not the default.
    const candidate=ranked.find((item)=>chosen.every((picked)=>fabricPairDiffers(item,picked)))
      || ranked.find((item)=>chosen.every((picked)=>signaturesDiffer(item,picked)))
      || ranked[0];
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
    const blockIssues=current.block.adjustments.filter((item)=>item.severity!=="info").map((item)=>item.message);
    const unknowns=current.recommendation.rules.filter((item)=>item.status==="unknown"&&item.severity!=="Low").map((item)=>item.explanation);
    return {
      tier,
      acceptable:!hardBlocked(current.recommendation,current.fit),
      reasons:[...blockers,...fitIssues,...blockIssues,...unknowns,...current.brand.cautions].filter((value,index,all)=>all.indexOf(value)===index).slice(0,5),
    };
  });
}
