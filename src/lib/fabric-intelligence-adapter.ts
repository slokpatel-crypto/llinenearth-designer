import {
  colorFamilies,
  garmentUses,
  occasions,
  climateTags,
  collarOptions,
  cuffOptions,
  shirtFitOptions,
  trouserDirectionOptions,
  patternStrategies,
  normalizeArray,
  normalizeToken,
  type ColorFamilyId,
  type GarmentUseId,
  type OccasionId,
  type ClimateTagId,
  type CollarOptionId,
  type CuffOptionId,
  type ShirtFitOptionId,
  type TrouserDirectionId,
  type PatternStrategyId,
} from "./vocab/index.ts";

export type FabricAnalyzerProfileV4 = {
  version:"fabric-analyzer-v4";
  observed:{
    dominantColor:string;
    colorFamily:ColorFamilyId|null;
    undertone:"warm"|"cool"|"neutral"|"uncertain";
    depth:"very-light"|"light"|"mid"|"deep"|"very-deep";
    saturation:"muted"|"soft"|"medium"|"rich"|"vivid";
    secondaryColors:string[];
    patternFamily:"solid"|"stripe"|"check"|"dot"|"botanical"|"floral"|"geometric"|"paisley"|"abstract"|"melange"|"textured"|"other";
    patternScale:"none"|"fine"|"medium"|"bold";
    patternDensity:"none"|"sparse"|"balanced"|"dense";
    patternContrast:"low"|"medium"|"high";
    orientation:"none"|"vertical"|"horizontal"|"grid"|"all-over"|"directional"|"uncertain";
    visibleTexture:string[];
    weaveAppearance:string[];
    sheen:"matte"|"low"|"medium"|"high"|"uncertain";
    visualWeight:"light-looking"|"medium-looking"|"heavy-looking"|"uncertain";
  };
  inferredStyle:{
    personality:string[];
    formality:1|2|3|4|5;
    statementLevel:1|2|3|4|5;
    bestGarments:GarmentUseId[];
    bestOccasions:OccasionId[];
    climateVisualFit:ClimateTagId[];
    recommendedConstruction:{
      collars:CollarOptionId[];
      cuffs:CuffOptionId[];
      shirtFits:ShirtFitOptionId[];
      trouserDirections:TrouserDirectionId[];
    };
    pairing:{
      goodColorFamilies:ColorFamilyId[];
      avoidColorFamilies:ColorFamilyId[];
      goodPatternStrategy:PatternStrategyId[];
    };
  };
  confidence:{
    color:number;
    pattern:number;
    texture:number;
    styling:number;
  };
  evidence:{
    verifiedFacts:string[];
    visualObservations:string[];
    uncertainClaims:string[];
  };
  references:{
    materialTerms:string[];
    patternTerms:string[];
    colorTerms:string[];
    sourceIds:string[];
  };
  reviewNeeded:string[];
  summary:string;
};

function obj(value:unknown):Record<string,unknown> {
  return value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
}
function str(value:unknown,limit=180) {
  return String(value??"").trim().slice(0,limit);
}
function arr(value:unknown,limit=12) {
  return Array.isArray(value) ? value.map((item)=>str(item)).filter(Boolean).slice(0,limit) : [];
}
function num(value:unknown,min:number,max:number,fallback:number) {
  const n=Number(value);
  return Number.isFinite(n) ? Math.max(min,Math.min(max,n)) : fallback;
}
function enumValue<T extends string>(value:unknown,allowed:readonly T[],fallback:T):T {
  const raw=String(value??"");
  return (allowed as readonly string[]).includes(raw) ? raw as T : fallback;
}

export function adaptFabricProfileToV4(input:unknown):FabricAnalyzerProfileV4|null {
  const root=obj(input);
  if(!["fabric-analyzer-v3","fabric-analyzer-v4"].includes(String(root.version||""))) return null;
  const observed=obj(root.observed);
  const inferred=obj(root.inferredStyle);
  const recommended=obj(inferred.recommendedConstruction);
  const pairing=obj(inferred.pairing);
  const confidence=obj(root.confidence);
  const evidence=obj(root.evidence);
  const references=obj(root.references);

  const reviewNeeded:string[]=[];
  const color=normalizeToken(observed.colorFamily,colorFamilies); reviewNeeded.push(...color.reviewNeeded);
  const garments=normalizeArray(inferred.bestGarments,garmentUses); reviewNeeded.push(...garments.reviewNeeded);
  const occasionIds=normalizeArray(inferred.bestOccasions,occasions); reviewNeeded.push(...occasionIds.reviewNeeded);
  const climate=normalizeArray(inferred.climateVisualFit,climateTags); reviewNeeded.push(...climate.reviewNeeded);
  const collars=normalizeArray(recommended.collars,collarOptions); reviewNeeded.push(...collars.reviewNeeded);
  const cuffs=normalizeArray(recommended.cuffs,cuffOptions); reviewNeeded.push(...cuffs.reviewNeeded);
  const fits=normalizeArray(recommended.shirtFits,shirtFitOptions); reviewNeeded.push(...fits.reviewNeeded);
  const trousers=normalizeArray(recommended.trouserDirections,trouserDirectionOptions); reviewNeeded.push(...trousers.reviewNeeded);
  const goodColors=normalizeArray(pairing.goodColorFamilies,colorFamilies); reviewNeeded.push(...goodColors.reviewNeeded);
  const avoidColors=normalizeArray(pairing.avoidColorFamilies,colorFamilies); reviewNeeded.push(...avoidColors.reviewNeeded);
  const strategies=normalizeArray(pairing.goodPatternStrategy,patternStrategies); reviewNeeded.push(...strategies.reviewNeeded);

  return {
    version:"fabric-analyzer-v4",
    observed:{
      dominantColor:str(observed.dominantColor,80),
      colorFamily:color.value,
      undertone:enumValue(observed.undertone,["warm","cool","neutral","uncertain"] as const,"uncertain"),
      depth:enumValue(observed.depth,["very-light","light","mid","deep","very-deep"] as const,"mid"),
      saturation:enumValue(observed.saturation,["muted","soft","medium","rich","vivid"] as const,"medium"),
      secondaryColors:arr(observed.secondaryColors,8),
      patternFamily:enumValue(observed.patternFamily,["solid","stripe","check","dot","botanical","floral","geometric","paisley","abstract","melange","textured","other"] as const,"other"),
      patternScale:enumValue(observed.patternScale,["none","fine","medium","bold"] as const,"medium"),
      patternDensity:enumValue(observed.patternDensity,["none","sparse","balanced","dense"] as const,"balanced"),
      patternContrast:enumValue(observed.patternContrast,["low","medium","high"] as const,"medium"),
      orientation:enumValue(observed.orientation,["none","vertical","horizontal","grid","all-over","directional","uncertain"] as const,"uncertain"),
      visibleTexture:arr(observed.visibleTexture,10),
      weaveAppearance:arr(observed.weaveAppearance,8),
      sheen:enumValue(observed.sheen,["matte","low","medium","high","uncertain"] as const,"uncertain"),
      visualWeight:enumValue(observed.visualWeight,["light-looking","medium-looking","heavy-looking","uncertain"] as const,"uncertain"),
    },
    inferredStyle:{
      personality:arr(inferred.personality,8),
      formality:Math.round(num(inferred.formality,1,5,3)) as 1|2|3|4|5,
      statementLevel:Math.round(num(inferred.statementLevel,1,5,2)) as 1|2|3|4|5,
      bestGarments:garments.values,
      bestOccasions:occasionIds.values,
      climateVisualFit:climate.values,
      recommendedConstruction:{
        collars:collars.values,
        cuffs:cuffs.values,
        shirtFits:fits.values,
        trouserDirections:trousers.values,
      },
      pairing:{
        goodColorFamilies:goodColors.values,
        avoidColorFamilies:avoidColors.values,
        goodPatternStrategy:strategies.values,
      },
    },
    confidence:{
      color:num(confidence.color,0,1,0),
      pattern:num(confidence.pattern,0,1,0),
      texture:num(confidence.texture,0,1,0),
      styling:num(confidence.styling,0,1,0),
    },
    evidence:{
      verifiedFacts:arr(evidence.verifiedFacts,12),
      visualObservations:arr(evidence.visualObservations,16),
      uncertainClaims:arr(evidence.uncertainClaims,12),
    },
    references:{
      materialTerms:arr(references.materialTerms,8),
      patternTerms:arr(references.patternTerms,8),
      colorTerms:arr(references.colorTerms,8),
      sourceIds:arr(references.sourceIds,10),
    },
    reviewNeeded:[...new Set([...(Array.isArray(root.reviewNeeded)?arr(root.reviewNeeded,30):[]),...reviewNeeded])],
    summary:str(root.summary,700),
  };
}
