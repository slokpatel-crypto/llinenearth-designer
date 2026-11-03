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
import type { FabricMeasuredData, FabricImageQuality } from "./fabric-measurement-types.ts";

export type FabricFieldProvenance="measured"|"modelJudged"|"declared"|"reviewed";

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
  verifiedPhysical:{
    gsm:number|null;
    drape:"Fluid"|"Balanced"|"Structured"|null;
    fiberContent:string|null;
    structure?:number|null;
    breathability?:number|null;
    wrinkleResistance?:number|null;
    stretch?:number|null;
    sourceUrl:string|null;
    evidenceNote:string|null;
  };
  measured:FabricMeasuredData|null;
  imageQuality:FabricImageQuality|null;
  renderAssets:{
    tileUrl:string|null;
    placeholderUrl:string|null;
    tileWidthPx:number|null;
    tileHeightPx:number|null;
    repeatDetected:boolean;
    renderAssetVersion:string|null;
    scaleApproximate:boolean;
  };
  captureSet:Array<{
    role:"flat"|"macro"|"fold";
    imageUrl:string;
    contentSha256:string|null;
  }>;
  provenanceByField:Record<string,FabricFieldProvenance>;
  reviewNeeded:string[];
  summary:string;
};

function obj(value:unknown):Record<string,unknown> {
  return value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
}
function isRecord(value:unknown):value is Record<string,unknown> {
  return value!==null && typeof value==="object" && !Array.isArray(value);
}
function validatedImageQuality(value:unknown):FabricImageQuality|null {
  if(!isRecord(value)) return null;
  // A string or array-coerced "100" must not unlock a high-confidence
  // material match. Keep unknown and legacy incomplete evidence provisional.
  if(typeof value.score!=="number" || !Number.isFinite(value.score)
    || value.score<0 || value.score>100) return null;
  return value as FabricImageQuality;
}
function validatedMeasuredData(value:unknown):FabricMeasuredData|null {
  if(!isRecord(value) || !isRecord(value.colour)
    || !isRecord(value.pattern) || !validatedImageQuality(value.imageQuality)) return null;
  const colour=value.colour;
  const pattern=value.pattern;
  // The downstream projection reads these nested fields without structural
  // checks. Do not promote a malformed blob to a typed measured swatch.
  if(typeof colour.hex!=="string" || !/^#[0-9a-f]{6}$/i.test(colour.hex)
    || typeof colour.deltaE!=="number" || !Number.isFinite(colour.deltaE)
    || colour.deltaE<0) return null;
  if(typeof pattern.orientation!=="string"
    || !["none","vertical","horizontal","grid","uncertain"].includes(pattern.orientation)
    || typeof pattern.physicalScaleStatus!=="string"
    || !["unknown","declared_repeat","declared_swatch_width"].includes(pattern.physicalScaleStatus)) return null;
  for(const key of ["repeatMm","stripeWidthMm","contrastDeltaE"] as const) {
    const val=pattern[key];
    if(val!==null && val!==undefined &&
      (typeof val!=="number" || !Number.isFinite(val) || val<0)) return null;
  }
  return value as FabricMeasuredData;
}
function str(value:unknown,limit=180,rejectOverlength=false) {
  // Untrusted profile values must remain literal strings. Supplier evidence
  // must also retain its exact bounded value: never truncate an inspection
  // receipt, composition or URL into a different, apparently valid proof.
  if(typeof value!=="string") return "";
  // Supplier/inspection evidence is a literal receipt, not a display field.
  // Check its raw length before trimming; otherwise an oversized padded
  // document or composition can be shortened into apparently valid proof.
  if(rejectOverlength && value.length>limit) return "";
  const literal=value.trim();
  return rejectOverlength && literal.length>limit ? "" : literal.slice(0,limit);
}
function arr(value:unknown,limit=12) {
  return Array.isArray(value) ? value.map((item)=>str(item)).filter(Boolean).slice(0,limit) : [];
}
function num(value:unknown,min:number,max:number,fallback:number) {
  // Persisted JSON has no TypeScript runtime contract: strings, arrays and
  // booleans must not be cast into apparent Analyzer confidence. An invalid
  // out-of-range number is unknown, not perfect confidence after clamping.
  return typeof value==="number" && Number.isFinite(value)
    && value>=min && value<=max ? value : fallback;
}
function ordinal(value:unknown,fallback:1|2|3|4|5):1|2|3|4|5 {
  return typeof value==="number" && Number.isInteger(value)
    && value>=1 && value<=5 ? value as 1|2|3|4|5 : fallback;
}

function tilePixelDimension(value:unknown):number|null {
  // Render metadata comes from persisted JSON, not trusted image metadata.
  // Blank strings, arrays, booleans, negative or fractional values are not pixels.
  return typeof value==="number" && Number.isSafeInteger(value)
    && value>0 && value<=32768 ? value : null;
}
function enumValue<T extends string>(value:unknown,allowed:readonly T[],fallback:T):T {
  // String(["stripe"]) === "stripe", but an array is not a classifier label.
  return typeof value==="string" && (allowed as readonly string[]).includes(value)
    ? value as T : fallback;
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
      formality:ordinal(inferred.formality,3),
      statementLevel:ordinal(inferred.statementLevel,2),
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
    verifiedPhysical:{
      gsm:typeof obj(root.verifiedPhysical).gsm === "number" && Number.isFinite(obj(root.verifiedPhysical).gsm)
        && Number(obj(root.verifiedPhysical).gsm) >= 20 && Number(obj(root.verifiedPhysical).gsm) <= 1000
        ? Number(obj(root.verifiedPhysical).gsm) : null,
      drape:typeof obj(root.verifiedPhysical).drape==="string"
        && ["Fluid","Balanced","Structured"].includes(obj(root.verifiedPhysical).drape as string)
        ? obj(root.verifiedPhysical).drape as "Fluid"|"Balanced"|"Structured" : null,
      fiberContent:typeof obj(root.verifiedPhysical).fiberContent==="string"
        ? str(obj(root.verifiedPhysical).fiberContent,220,true)||null : null,
      structure:typeof obj(root.verifiedPhysical).structure === "number" && Number.isFinite(obj(root.verifiedPhysical).structure)
        && Number(obj(root.verifiedPhysical).structure) >= 0 && Number(obj(root.verifiedPhysical).structure) <= 1
        ? Number(obj(root.verifiedPhysical).structure) : null,
      breathability:typeof obj(root.verifiedPhysical).breathability === "number" && Number.isFinite(obj(root.verifiedPhysical).breathability)
        && Number(obj(root.verifiedPhysical).breathability) >= 0 && Number(obj(root.verifiedPhysical).breathability) <= 1
        ? Number(obj(root.verifiedPhysical).breathability) : null,
      wrinkleResistance:typeof obj(root.verifiedPhysical).wrinkleResistance === "number" && Number.isFinite(obj(root.verifiedPhysical).wrinkleResistance)
        && Number(obj(root.verifiedPhysical).wrinkleResistance) >= 0 && Number(obj(root.verifiedPhysical).wrinkleResistance) <= 1
        ? Number(obj(root.verifiedPhysical).wrinkleResistance) : null,
      stretch:typeof obj(root.verifiedPhysical).stretch === "number" && Number.isFinite(obj(root.verifiedPhysical).stretch)
        && Number(obj(root.verifiedPhysical).stretch) >= 0 && Number(obj(root.verifiedPhysical).stretch) <= 1
        ? Number(obj(root.verifiedPhysical).stretch) : null,
      sourceUrl:typeof obj(root.verifiedPhysical).sourceUrl==="string"
        ? str(obj(root.verifiedPhysical).sourceUrl,1800,true)||null : null,
      evidenceNote:str(obj(root.verifiedPhysical).evidenceNote,500,true)||null,
    },
    measured:validatedMeasuredData(root.measured),
    imageQuality:validatedImageQuality(root.imageQuality),
    renderAssets:{
      tileUrl:str(obj(root.renderAssets).tileUrl,1800)||null,
      placeholderUrl:str(obj(root.renderAssets).placeholderUrl,1800)||null,
      tileWidthPx:tilePixelDimension(obj(root.renderAssets).tileWidthPx),
      tileHeightPx:tilePixelDimension(obj(root.renderAssets).tileHeightPx),
      repeatDetected:obj(root.renderAssets).repeatDetected===true,
      renderAssetVersion:str(obj(root.renderAssets).renderAssetVersion,80)||null,
      scaleApproximate:obj(root.renderAssets).scaleApproximate!==false,
    },
    captureSet:Array.isArray(root.captureSet)
      ? root.captureSet.slice(0,3).map((item)=>{
        const value=obj(item);
        const role=enumValue(value.role,["flat","macro","fold"] as const,"flat");
        return {role,imageUrl:str(value.imageUrl,1800),contentSha256:str(value.contentSha256,100)||null};
      }).filter((item)=>item.imageUrl)
      : [],
    provenanceByField:Object.fromEntries(
      Object.entries(obj(root.provenanceByField))
        .filter(([,value])=>typeof value==="string"
          && ["measured","modelJudged","declared","reviewed"].includes(value))
        .map(([key,value])=>[key,String(value) as FabricFieldProvenance]),
    ),
    reviewNeeded:[...new Set([...(Array.isArray(root.reviewNeeded)?arr(root.reviewNeeded,30):[]),...reviewNeeded])],
    summary:str(root.summary,700),
  };
}
