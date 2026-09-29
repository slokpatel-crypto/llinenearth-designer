import { FABRIC_STOCK, fabricProfileFromStock, type FabricColorway } from "@/lib/fabric-stock";
import { generateDesignerDirections, type DesignCandidate } from "@/lib/designer-engine";
import { finalizeVersion, initialVersion, type DesignVersion } from "@/lib/refinement-engine";
import type { ContextProfile, DesignerBrief } from "@/lib/designer-types";
import type { DesignerFabricIntelligence } from "@/lib/fabric-intelligence-types";
import { colorFamilyPairSignal } from "@/lib/vocab";
import {
  DESIGNER_PANTS, DESIGNER_SHIRTS, DESIGNER_STYLE_CHOICES, designerFabricFromStock, designerStyleForOccasion, evaluateDesignerCombo,
  type DesignerClimate, type DesignerContext, type DesignerIntention, type DesignerStyle, type OccasionTier,
} from "@/lib/designer/engine";

export type StyleDirectorAnswers = {
  occasion: "Wedding" | "Work" | "Date" | "Celebration" | "Travel" | "Everyday";
  mood: "Quiet" | "Sharp" | "Relaxed" | "Statement";
  time: "Day" | "Evening";
  climate: "Hot" | "Indoor" | "Mixed";
  garment: "shirt" | "trouser" | "suit" | "blazer";
  colorDirection: "Light" | "Earthy" | "Blue" | "Dark" | "Surprise me";
};

export type StyleDirectorRealModelSpec = {
  shirtId: string;
  shirtName: string;
  shirtFabric: ReturnType<typeof designerFabricFromStock>;
  pantId: string;
  pantName: string;
  pantFabric: ReturnType<typeof designerFabricFromStock>;
  occasion: OccasionTier;
  climate: DesignerClimate;
  intention: DesignerIntention;
  style: DesignerStyle;
  reason: string;
  status: "preliminary" | "needs_review";
  confidenceScore: number;
  designFitScore: number;
};

export type StyleDirectorLook = {
  id: string;
  title: string;
  strapline: string;
  fabric: FabricColorway;
  candidate: DesignCandidate;
  brief: DesignerBrief;
  version: DesignVersion;
  why: string[];
  realModel?: StyleDirectorRealModelSpec;
};

function contextFromAnswers(a: StyleDirectorAnswers): ContextProfile {
  const occasionMap: Record<StyleDirectorAnswers["occasion"], string> = {
    Wedding: "Wedding / Reception",
    Work: "Business",
    Date: "Dinner / Social",
    Celebration: "Festive / Celebration",
    Travel: "Resort / Travel",
    Everyday: "Smart Casual",
  };
  const venue = a.occasion === "Wedding" ? "Hotel / Banquet"
    : a.occasion === "Travel" ? "Resort / Outdoor"
    : a.occasion === "Work" ? "Office / Boardroom"
    : a.occasion === "Date" ? "Restaurant / City"
    : "Indoor / City";
  const formality = a.mood === "Relaxed" ? "Relaxed"
    : a.occasion === "Wedding" || a.occasion === "Work" ? "Formal"
    : "Smart";
  const aesthetic = a.mood === "Quiet" ? "Quiet Luxury"
    : a.mood === "Sharp" ? "Modern Classic"
    : a.mood === "Statement" ? "Italian-Inspired"
    : "Minimal";
  return {
    occasion: occasionMap[a.occasion],
    venue,
    time: a.time,
    environment: a.climate === "Hot" ? "Hot / Outdoor"
      : a.climate === "Indoor" ? "Air-conditioned / Indoor"
      : "Mixed climate",
    formality,
    impression: a.mood === "Statement" ? "Memorable and directional"
      : a.mood === "Sharp" ? "Polished and confident"
      : a.mood === "Quiet" ? "Understated and expensive"
      : "Easy and approachable",
    fit: a.mood === "Relaxed" ? "Relaxed tailored" : "Tailored",
    aesthetic,
  };
}

function colorScore(fabric: FabricColorway, direction: StyleDirectorAnswers["colorDirection"]) {
  const name = fabric.colorName.toLowerCase();
  const hex = fabric.hex.replace("#", "");
  const r = Number.parseInt(hex.slice(0,2),16);
  const g = Number.parseInt(hex.slice(2,4),16);
  const b = Number.parseInt(hex.slice(4,6),16);
  const lightness = (Math.max(r,g,b) + Math.min(r,g,b)) / 2;
  if (direction === "Surprise me") return 10;
  if (direction === "Light") return lightness > 155 ? 32 : 0;
  if (direction === "Dark") return lightness < 120 ? 32 : 0;
  if (direction === "Blue") return /blue|slate|chambray|sky|denim/.test(name) ? 38 : b > r + 10 ? 18 : 0;
  return /beige|taupe|cream|khakhi|brown|oak|sand|jute|saffron/.test(name) ? 38 : (r > b && g > b ? 10 : 0);
}

function intelligenceTrustWeight(value:DesignerFabricIntelligence|undefined) {
  if(!value) return 0;
  if(value.trust==="reviewed") return 1;
  if(value.trust==="high-confidence") return .72;
  return .28;
}

function directorIntelligenceScore(
  a:StyleDirectorAnswers,
  fabric:FabricColorway,
  map?:Record<string,DesignerFabricIntelligence>|null,
) {
  const intel=map?.[fabric.id];
  if(!intel) return 0;
  const w=intelligenceTrustWeight(intel);
  const targetFormality:Record<StyleDirectorAnswers["occasion"],number>={
    Wedding:4.4,
    Work:4,
    Date:2.8,
    Celebration:3.5,
    Travel:1.8,
    Everyday:2.3,
  };
  const targetStatement:Record<StyleDirectorAnswers["mood"],number>={
    Quiet:1.5,
    Sharp:2.8,
    Relaxed:2.1,
    Statement:4.4,
  };
  let score=0;
  score+=(1-Math.min(1,Math.abs(intel.formality-targetFormality[a.occasion])/3.5))*14*w;
  score+=(1-Math.min(1,Math.abs(intel.statementLevel-targetStatement[a.mood])/4))*10*w;

  if(a.garment==="shirt" && (intel.bestGarments.includes("shirt")||intel.bestGarments.includes("overshirt"))) score+=7*w;
  if(a.garment==="trouser" && (intel.bestGarments.includes("trouser")||intel.bestGarments.includes("chino")||intel.bestGarments.includes("suit"))) score+=7*w;
  if(a.garment==="suit" && intel.bestGarments.includes("suit")) score+=7*w;
  if(a.garment==="blazer" && (intel.bestGarments.includes("blazer")||intel.bestGarments.includes("jacket")||intel.bestGarments.includes("suit"))) score+=7*w;

  const climate=new Set(intel.climateVisualFit);
  if(a.climate==="Hot" && (climate.has("hot_humid")||climate.has("hot_dry")||climate.has("warm"))) score+=5*w;
  if(a.climate==="Indoor" && (climate.has("air_conditioned")||climate.has("all_season"))) score+=3*w;

  if(a.colorDirection==="Light" && (intel.depth==="very-light"||intel.depth==="light")) score+=5*w;
  if(a.colorDirection==="Dark" && (intel.depth==="deep"||intel.depth==="very-deep")) score+=5*w;
  if(a.colorDirection==="Blue" && intel.colorFamily==="blue_family") score+=6*w;
  if(a.colorDirection==="Earthy" && ["neutral_warm","brown_family","green_family","orange_family"].includes(intel.colorFamily||"")) score+=6*w;

  return Math.max(-10,Math.min(32,score));
}

function directorPairIntelligenceScore(
  shirtId:string,
  pantId:string,
  occasion:OccasionTier,
  map?:Record<string,DesignerFabricIntelligence>|null,
) {
  const shirt=map?.[shirtId];
  const pant=map?.[pantId];
  if(!shirt && !pant) return 0;
  const target:Record<OccasionTier,number>={Casual:1.7,"Smart-Casual":2.7,"Semi-Formal":3.7,Formal:4.6};
  let score=0;
  for(const intel of [shirt,pant]) {
    if(!intel) continue;
    const w=intelligenceTrustWeight(intel);
    score+=(1-Math.min(1,Math.abs(intel.formality-target[occasion])/3.5))*8*w;
  }
  if(shirt && pant) {
    const pairWeight=Math.min(intelligenceTrustWeight(shirt),intelligenceTrustWeight(pant));
    const pantColor=pant.colorFamily;
    const shirtColor=shirt.colorFamily;
    const shirtPairSignal=colorFamilyPairSignal(shirt.pairing.goodColorFamilies,shirt.pairing.avoidColorFamilies,pantColor);
    const pantPairSignal=colorFamilyPairSignal(pant.pairing.goodColorFamilies,pant.pairing.avoidColorFamilies,shirtColor);
    if(shirtPairSignal>0) score+=5*pairWeight;
    if(shirtPairSignal<0) score-=8*pairWeight;
    if(pantPairSignal>0) score+=4*pairWeight;
    if(pantPairSignal<0) score-=7*pairWeight;
    if(shirt.statementLevel>=4 && pant.statementLevel>=4) score-=6*pairWeight;
  }
  return Math.max(-16,Math.min(18,score));
}

function rankFabric(a: StyleDirectorAnswers, fabric: FabricColorway, intelligence?:Record<string,DesignerFabricIntelligence>|null) {
  let score = 0;
  if (fabric.suitableFor.includes(a.garment)) score += 100;
  score += colorScore(fabric, a.colorDirection);
  if (a.occasion === "Wedding" && /suiting|formal/i.test(fabric.line)) score += 24;
  if (a.occasion === "Travel" && /plain|print/i.test(fabric.line)) score += 16;
  if (a.mood === "Statement" && /print|orchid|rose|pink|maroon/i.test(`${fabric.line} ${fabric.colorName}`)) score += 20;
  if (a.mood === "Quiet" && /plain|cream|taupe|grey|gray|beige/i.test(`${fabric.line} ${fabric.colorName}`)) score += 18;
  if (a.time === "Evening" && /dark|charcoal|black|maroon|slate/i.test(fabric.colorName)) score += 16;
  score += directorIntelligenceScore(a,fabric,intelligence);
  return score;
}

function chooseFabrics(
  a:StyleDirectorAnswers,
  stock:FabricColorway[]=FABRIC_STOCK,
  intelligence?:Record<string,DesignerFabricIntelligence>|null,
) {
  const eligible=stock.filter((f)=>f.inStock&&f.suitableFor.includes(a.garment));
  return [...eligible].sort((x,y)=>rankFabric(a,y,intelligence)-rankFabric(a,x,intelligence)).slice(0,3);
}

function realModelOccasion(a: StyleDirectorAnswers): OccasionTier {
  if (a.occasion === "Wedding") return "Formal";
  if (a.occasion === "Work" || a.occasion === "Celebration") return "Semi-Formal";
  if (a.occasion === "Travel") return "Casual";
  return "Smart-Casual";
}

function realModelContext(a: StyleDirectorAnswers): DesignerContext {
  const climate: DesignerClimate = a.climate === "Hot" ? "Hot / humid"
    : a.climate === "Indoor" ? "Air-conditioned" : "Not specified";
  const intention: DesignerIntention = a.mood === "Quiet" ? "Understated"
    : a.mood === "Statement" ? "Expressive" : "Balanced";
  return { climate, intention };
}

function pickStyleChoice<K extends keyof DesignerStyle>(key: K, matcher: RegExp, fallback: DesignerStyle[K]) {
  return (DESIGNER_STYLE_CHOICES[key].find((value) => matcher.test(value)) || fallback) as DesignerStyle[K];
}

function styleForDirectorCandidate(a: StyleDirectorAnswers, candidate: DesignCandidate): DesignerStyle {
  const occasion = realModelOccasion(a);
  const style = designerStyleForOccasion(occasion);
  const shirt = candidate.garments.shirt.toLowerCase();
  const trouser = candidate.garments.trouser.toLowerCase();

  if (shirt.includes("spread")) {
    style.collar = pickStyleChoice("collar", /spread/i, style.collar);
    style.shirtWear = "Tucked";
  } else if (shirt.includes("button-down") || shirt.includes("oxford")) {
    style.collar = pickStyleChoice("collar", /button[- ]?down/i, style.collar);
    style.shirtWear = occasion === "Formal" || occasion === "Semi-Formal" ? "Tucked" : "Untucked";
  } else if (shirt.includes("camp")) {
    style.collar = pickStyleChoice("collar", /camp|cuban/i, style.collar);
    style.shirtWear = "Untucked";
  } else if (shirt.includes("band")) {
    style.collar = pickStyleChoice("collar", /band|mandarin/i, style.collar);
  }

  if (trouser.includes("wide")) {
    style.trouser = pickStyleChoice("trouser", /wide|relaxed drape/i, style.trouser);
    style.break = pickStyleChoice("break", /full break|no break/i, style.break);
  } else if (trouser.includes("pleat")) {
    style.trouser = pickStyleChoice("trouser", /pleated/i, style.trouser);
    style.break = pickStyleChoice("break", /slight break/i, style.break);
  } else if (trouser.includes("flat-front") || trouser.includes("flat front")) {
    style.trouser = pickStyleChoice("trouser", /flat[- ]?front|formal trouser/i, style.trouser);
  } else if (trouser.includes("drawstring")) {
    style.waistband = pickStyleChoice("waistband", /drawstring|elastic/i, style.waistband);
    style.trouser = pickStyleChoice("trouser", /wide|relaxed|pleated/i, style.trouser);
  }

  if (occasion === "Formal" || occasion === "Semi-Formal") {
    style.shirtWear = "Tucked";
    style.rise = pickStyleChoice("rise", /mid rise|high rise/i, style.rise);
  }
  return style;
}

function buildRealModelSpec(
  a: StyleDirectorAnswers, fabric: FabricColorway, candidate: DesignCandidate,
  shirts = DESIGNER_SHIRTS, pants = DESIGNER_PANTS,
  intelligence?:Record<string,DesignerFabricIntelligence>|null,
): StyleDirectorRealModelSpec | undefined {
  if (a.garment !== "shirt" && a.garment !== "trouser") return undefined;
  const occasion = realModelOccasion(a);
  const context = realModelContext(a);
  const style = styleForDirectorCandidate(a, candidate);
  const hero = (a.garment === "shirt" ? shirts : pants).find((item) => item.id === fabric.id);
  if (!hero) return undefined;

  const options = a.garment === "shirt" ? pants : shirts;
  const ranked = options.map((other) => {
    const shirt = a.garment === "shirt" ? hero : other;
    const pant = a.garment === "trouser" ? hero : other;
    const recommendation = evaluateDesignerCombo(shirt, pant, occasion, style, undefined, context);
    const hardFlags = recommendation.rules.filter((rule) => rule.status === "flag" && rule.severity === "High").length;
    const mediumFlags = recommendation.rules.filter((rule) => rule.status === "flag" && rule.severity === "Medium").length;
    const score = recommendation.designFitScore + recommendation.confidenceScore * .35 - hardFlags * 45 - mediumFlags * 12
      - (recommendation.status === "needs_review" ? 8 : 0)
      + directorPairIntelligenceScore(shirt.id,pant.id,occasion,intelligence);
    return { recommendation, score };
  }).sort((x,y) => y.score - x.score || y.recommendation.designFitScore - x.recommendation.designFitScore);

  const best = ranked[0]?.recommendation;
  if (!best) return undefined;
  return {
    shirtId: best.shirt.id,
    shirtName: best.shirt.name,
    shirtFabric: best.shirt,
    pantId: best.pant.id,
    pantName: best.pant.name,
    pantFabric: best.pant,
    occasion,
    climate: context.climate,
    intention: context.intention,
    style: best.style,
    reason: best.shortReason,
    status: best.status,
    confidenceScore: best.confidenceScore,
    designFitScore: best.designFitScore,
  };
}

function nameFor(index: number, candidate: DesignCandidate) {
  const labels = ["Director's Pick", "Easy Win", "Push It"];
  return `${labels[index] || candidate.tier} · ${candidate.name}`;
}

export function createStyleDirectorLooks(
  answers:StyleDirectorAnswers,
  stock:FabricColorway[]=FABRIC_STOCK,
  intelligence?:Record<string,DesignerFabricIntelligence>|null,
):StyleDirectorLook[] {
  const context = contextFromAnswers(answers);
  const calibrated = stock.filter((fabric) => fabric.inStock).map(designerFabricFromStock);
  const calibratedShirts = calibrated.filter((fabric) => fabric.allowedGarments.includes("shirt"));
  const calibratedPants = calibrated.filter((fabric) => fabric.allowedGarments.includes("pant"));
  return chooseFabrics(answers,stock,intelligence).map((fabric,index)=>{
    const brief: DesignerBrief = {
      fabric: {
        profile: fabricProfileFromStock(fabric),
        source: "stock",
        stockId: fabric.id,
        swatchImageUrl: fabric.swatchImageUrl,
        materialOverride: fabric.family,
        toneOverride: fabric.colorName,
      },
      context,
    };
    const candidates = generateDesignerDirections(brief);
    const candidate = candidates[Math.min(index, candidates.length - 1)] ?? candidates[0];
    const version = finalizeVersion(initialVersion(candidate));
    return {
      id: `${fabric.id}-${candidate.id}`,
      title: nameFor(index, candidate),
      strapline: index === 0 ? "Best balance of fabric, occasion and personality."
        : index === 1 ? "The safest way to look considered without trying too hard."
        : "The option with more visual energy and attitude.",
      fabric,
      candidate,
      brief,
      version,
      why: [
        `${fabric.colorName} ${fabric.line} fits the direction you chose.`,
        candidate.reasons[0] || "The fabric and silhouette support the occasion.",
        candidate.tradeoff,
      ],
      realModel: buildRealModelSpec(answers,fabric,candidate,calibratedShirts,calibratedPants,intelligence),
    };
  });
}
