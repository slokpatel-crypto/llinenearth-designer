import type {
  DesignerContext, DesignerFabric, DesignerStyle, OccasionTier,
} from "@/lib/designer/engine";

export type LinenEarthBrandMode = "Quiet" | "Balanced" | "Statement";

export type BrandLanguageEvaluation = {
  version: "linen-earth-brand-language-provisional-1";
  score: number;
  mode: LinenEarthBrandMode;
  strengths: string[];
  cautions: string[];
  principles: string[];
};

const NEUTRAL_FAMILIES = new Set(["Neutral","Earth-tone","Earth","Brown","Beige","Grey","Gray","Navy"]);
const VIVID_FAMILIES = new Set(["Jewel-tone","Bright","Vivid"]);

function prominent(scale:DesignerFabric["patternScale"]) {
  return scale === "Bold" || scale === "Medium-Bold";
}

function restrained(scale:DesignerFabric["patternScale"]) {
  return scale === "None" || scale === "Fine";
}

function neutral(fabric:DesignerFabric) {
  return Boolean(fabric.colorFamily && NEUTRAL_FAMILIES.has(fabric.colorFamily));
}

function vivid(fabric:DesignerFabric) {
  return Boolean(fabric.colorFamily && VIVID_FAMILIES.has(fabric.colorFamily));
}

function sameFamily(a:DesignerFabric,b:DesignerFabric) {
  return Boolean(a.colorFamily && b.colorFamily && a.colorFamily === b.colorFamily);
}

function modeFromContext(context:DesignerContext):LinenEarthBrandMode {
  if(context.intention === "Understated") return "Quiet";
  if(context.intention === "Expressive") return "Statement";
  return "Balanced";
}

export function evaluateLinenEarthBrandLanguage(
  shirt:DesignerFabric,
  pant:DesignerFabric,
  style:DesignerStyle,
  occasion:OccasionTier,
  context:DesignerContext,
):BrandLanguageEvaluation {
  let score=70;
  const strengths:string[]=[];
  const cautions:string[]=[];
  const mode=modeFromContext(context);

  const shirtProminent=prominent(shirt.patternScale);
  const pantProminent=prominent(pant.patternScale);
  const shirtRestrained=restrained(shirt.patternScale);
  const pantRestrained=restrained(pant.patternScale);

  if(neutral(shirt)||neutral(pant)) {
    score += 8;
    strengths.push("A neutral or earth-led anchor keeps the outfit composed.");
  }

  if(sameFamily(shirt,pant)) {
    score += mode==="Statement" ? 3 : 7;
    strengths.push("The palette stays tonally connected rather than visually fragmented.");
  }

  if(shirt.tone && pant.tone && shirt.tone !== pant.tone) {
    score += 4;
    strengths.push("The value contrast gives the outfit hierarchy without requiring loud colour.");
  }

  if(shirtProminent && pantRestrained || pantProminent && shirtRestrained) {
    score += mode==="Statement" ? 10 : 6;
    strengths.push("One garment carries the visual interest while the other supports it.");
  }

  if(shirtProminent && pantProminent) {
    score -= 18;
    cautions.push("Two prominent motifs compete for attention; Linen Earth should keep one clear visual hero.");
  }

  if(vivid(shirt)&&vivid(pant)) {
    score -= 14;
    cautions.push("Two vivid colour families read louder than the brand's usual controlled-contrast direction.");
  }

  if(occasion==="Semi-Formal"||occasion==="Formal") {
    if(style.shirtWear==="Tucked") {
      score += 5;
      strengths.push("The tucked waistline keeps the tailored direction clean.");
    } else {
      score -= 8;
      cautions.push("The untucked shirt weakens the composed waistline expected in this dressier direction.");
    }

    if(style.trouser==="Pleated Trouser"||style.trouser==="Formal Trouser (Flat-front)") {
      score += 4;
      strengths.push("The trouser construction supports a refined tailored silhouette.");
    }
  }

  if(mode==="Quiet") {
    if(shirtProminent||pantProminent) {
      score -= 6;
      cautions.push("The selected pattern load is stronger than the requested understated mood.");
    } else score += 5;
  }

  if(mode==="Statement") {
    if((shirtProminent||pantProminent) && !(shirtProminent&&pantProminent)) {
      score += 6;
      strengths.push("The statement comes from one controlled focal point rather than several competing ideas.");
    }
    if(!shirtProminent&&!pantProminent&&!vivid(shirt)&&!vivid(pant)) {
      cautions.push("This direction is very restrained for an expressive brief; use cut, texture or contrast before adding more pattern.");
      score -= 3;
    }
  }

  if(context.climate==="Hot / humid") {
    if(style.shirtFit==="Slim Fit") {
      score -= 5;
      cautions.push("A very close shirt fit can fight the breathable, easy character expected in hot-weather Linen Earth styling.");
    } else {
      score += 3;
      strengths.push("The shirt proportion leaves room for a lighter, more breathable warm-weather impression.");
    }
  }

  if(style.collarFinish==="Self-fabric") {
    score += 2;
  } else if(occasion==="Casual") {
    score -= 4;
    cautions.push("A contrast collar reads more formal and deliberate than this casual direction needs.");
  }

  score=Math.max(0,Math.min(100,Math.round(score)));

  return {
    version:"linen-earth-brand-language-provisional-1",
    score,
    mode,
    strengths:strengths.slice(0,4),
    cautions:cautions.slice(0,4),
    principles:[
      "Keep one visual hero and let the supporting garment stay quieter.",
      "Prefer controlled contrast, tonal relationships and natural-looking palette architecture over noise.",
      "Use tailoring proportion, texture and cloth character before adding more decoration.",
      "Brand taste is a soft ranking signal and never overrides fit, construction or verified material conflicts.",
    ],
  };
}
