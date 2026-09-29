import "server-only";
import {
  FABRIC_ANALYZER_EVIDENCE_RULES,
} from "@/lib/fabric-analyzer-taxonomy";
import {
  FABRIC_REFERENCE_COUNTS,
  FABRIC_REFERENCE_INDEX_VERSION,
  REAL_MENSWEAR_MATERIAL_TERMS,
  REAL_MENSWEAR_PATTERN_TERMS,
  STANDARD_COLOR_REFERENCE_TERMS,
} from "@/lib/fabric-analyzer-reference-index";
import {
  REAL_MENSWEAR_FABRIC_EXAMPLES,
  REAL_MENSWEAR_FABRIC_EXAMPLE_COUNT,
} from "@/lib/fabric-analyzer-real-examples";
import { FABRIC_REFERENCE_PROVENANCE } from "@/lib/fabric-analyzer-provenance-map";
import {
  isTrustedFabricReferenceImageUrl,
  resolveFabricReferencePage,
} from "@/lib/fabric-reference-page";
import {
  loadFabricAnalyzerLearningHints,
  loadStoredFabricAnalysis,
  storeFabricAnalysis,
} from "@/lib/fabric-analyzer-store";

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
} from "@/lib/vocab";
import {
  adaptFabricProfileToV4,
  type FabricAnalyzerProfileV4,
} from "@/lib/fabric-intelligence-adapter";
import { measureFabricImageBytes } from "@/lib/fabric-measurement-server";
import type { FabricMeasuredData } from "@/lib/fabric-measurement-types";

export type FabricAnalyzerContext = {
  fabricId?:string;
  imageUrl:string;
  sourcePageUrl?:string;
  sourceId?:string;
  declaredMaterial?:string;
  declaredFabricType?:string;
  supplierColorName?:string;
  supplierPatternName?:string;
  notes?:string;
  // Physical scale is owner/supplier data. The Analyzer never infers mm from pixels.
  swatchRealWidthMm?:number;
  repeatRealMm?:number;
  // Internal server-generated evidence used for content fingerprinting and to
  // avoid fetching/measuring the same image twice in one analysis run.
  contentSha256?:string;
  perceptualHash?:string;
  measured?:FabricMeasuredData;
};

export type FabricAnalyzerProfile = FabricAnalyzerProfileV4;

const ALLOWED_HOSTS=[
  /^https:\/\/[^/]+\.vercel-storage\.com\//i,
  /^https:\/\/(cdn|media)\.fashn\.ai\//i,
  /^https:\/\/images\.unsplash\.com\//i,
];

function safeImageUrl(value:string,sourcePageUrl?:string) {
  const url=value.trim();
  const builtIn=url.length<=1800 && ALLOWED_HOSTS.some((pattern)=>pattern.test(url));
  const official=url.length<=1800 && isTrustedFabricReferenceImageUrl(url,sourcePageUrl);
  if(!url || (!builtIn && !official)) {
    throw new Error("Fabric Analyzer only accepts trusted HTTPS image sources.");
  }
  return url;
}

async function prepareFabricMeasurement(input:FabricAnalyzerContext):Promise<FabricAnalyzerContext> {
  if(input.measured && input.contentSha256) return input;
  const url=safeImageUrl(input.imageUrl,input.sourcePageUrl);
  const response=await fetch(url,{
    headers:{accept:"image/avif,image/webp,image/png,image/jpeg,*/*;q=.5"},
    cache:"no-store",
    signal:AbortSignal.timeout(12_000),
  });
  if(!response.ok) throw new Error(`Fabric image could not be fetched for measurement (${response.status}).`);
  const announced=Number(response.headers.get("content-length")||0);
  if(announced>12_000_000) throw new Error("Fabric image is too large for Analyzer measurement.");
  const buffer=new Uint8Array(await response.arrayBuffer());
  if(buffer.byteLength>12_000_000) throw new Error("Fabric image is too large for Analyzer measurement.");
  const measured=await measureFabricImageBytes(buffer,{
    swatchRealWidthMm:Number.isFinite(input.swatchRealWidthMm)?input.swatchRealWidthMm:undefined,
    repeatRealMm:Number.isFinite(input.repeatRealMm)?input.repeatRealMm:undefined,
  });
  if(measured.imageQuality.score<40) {
    const issues=measured.imageQuality.issues.join(", ") || "image_quality_low";
    throw new Error(`Retake the fabric photo before analysis: ${issues}. Use a flat, sharp, evenly lit swatch image that fills the frame.`);
  }
  return {
    ...input,
    contentSha256:measured.contentSha256,
    perceptualHash:measured.perceptualHash,
    measured,
  };
}

function measuredPatternContrast(value:number|null):FabricAnalyzerProfile["observed"]["patternContrast"] {
  if(value===null) return "medium";
  return value<10?"low":value<28?"medium":"high";
}

function gatewayToken() {
  return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || "";
}

function outputText(payload:unknown) {
  if(!payload || typeof payload!=="object") return "";
  const value=payload as Record<string,unknown>;
  if(typeof value.output_text==="string") return value.output_text;
  const output=Array.isArray(value.output)?value.output:[];
  for(const item of output) {
    if(!item || typeof item!=="object") continue;
    const content=Array.isArray((item as Record<string,unknown>).content)?(item as Record<string,unknown>).content as unknown[]:[];
    for(const part of content) {
      if(!part || typeof part!=="object") continue;
      const p=part as Record<string,unknown>;
      if(typeof p.text==="string") return p.text;
    }
  }
  return "";
}

const schema={
  type:"object",
  properties:{
    version:{type:"string",enum:["fabric-analyzer-v4"]},
    observed:{
      type:"object",
      properties:{
        dominantColor:{type:"string",maxLength:80},
        colorFamily:{type:"string",enum:colorFamilies.map((item)=>item.id)},
        undertone:{type:"string",enum:["warm","cool","neutral","uncertain"]},
        depth:{type:"string",enum:["very-light","light","mid","deep","very-deep"]},
        saturation:{type:"string",enum:["muted","soft","medium","rich","vivid"]},
        secondaryColors:{type:"array",items:{type:"string",maxLength:60},maxItems:8},
        patternFamily:{type:"string",enum:["solid","stripe","check","dot","botanical","floral","geometric","paisley","abstract","melange","textured","other"]},
        patternScale:{type:"string",enum:["none","fine","medium","bold"]},
        patternDensity:{type:"string",enum:["none","sparse","balanced","dense"]},
        patternContrast:{type:"string",enum:["low","medium","high"]},
        orientation:{type:"string",enum:["none","vertical","horizontal","grid","all-over","directional","uncertain"]},
        visibleTexture:{type:"array",items:{type:"string",maxLength:80},maxItems:10},
        weaveAppearance:{type:"array",items:{type:"string",maxLength:80},maxItems:8},
        sheen:{type:"string",enum:["matte","low","medium","high","uncertain"]},
        visualWeight:{type:"string",enum:["light-looking","medium-looking","heavy-looking","uncertain"]},
      },
      required:["dominantColor","colorFamily","undertone","depth","saturation","secondaryColors","patternFamily","patternScale","patternDensity","patternContrast","orientation","visibleTexture","weaveAppearance","sheen","visualWeight"],
      additionalProperties:false,
    },
    inferredStyle:{
      type:"object",
      properties:{
        personality:{type:"array",items:{type:"string",maxLength:60},maxItems:8},
        formality:{type:"integer",minimum:1,maximum:5},
        statementLevel:{type:"integer",minimum:1,maximum:5},
        bestGarments:{type:"array",items:{type:"string",enum:garmentUses.map((item)=>item.id)},maxItems:10},
        bestOccasions:{type:"array",items:{type:"string",enum:occasions.map((item)=>item.id)},maxItems:10},
        climateVisualFit:{type:"array",items:{type:"string",enum:climateTags.map((item)=>item.id)},maxItems:8},
        recommendedConstruction:{
          type:"object",
          properties:{
            collars:{type:"array",items:{type:"string",enum:collarOptions.map((item)=>item.id)},maxItems:8},
            cuffs:{type:"array",items:{type:"string",enum:cuffOptions.map((item)=>item.id)},maxItems:8},
            shirtFits:{type:"array",items:{type:"string",enum:shirtFitOptions.map((item)=>item.id)},maxItems:6},
            trouserDirections:{type:"array",items:{type:"string",enum:trouserDirectionOptions.map((item)=>item.id)},maxItems:8},
          },
          required:["collars","cuffs","shirtFits","trouserDirections"],
          additionalProperties:false,
        },
        pairing:{
          type:"object",
          properties:{
            goodColorFamilies:{type:"array",items:{type:"string",enum:colorFamilies.map((item)=>item.id)},maxItems:10},
            avoidColorFamilies:{type:"array",items:{type:"string",enum:colorFamilies.map((item)=>item.id)},maxItems:8},
            goodPatternStrategy:{type:"array",items:{type:"string",enum:patternStrategies.map((item)=>item.id)},maxItems:8},
          },
          required:["goodColorFamilies","avoidColorFamilies","goodPatternStrategy"],
          additionalProperties:false,
        },
      },
      required:["personality","formality","statementLevel","bestGarments","bestOccasions","climateVisualFit","recommendedConstruction","pairing"],
      additionalProperties:false,
    },
    confidence:{
      type:"object",
      properties:{
        color:{type:"number",minimum:0,maximum:1},
        pattern:{type:"number",minimum:0,maximum:1},
        texture:{type:"number",minimum:0,maximum:1},
        styling:{type:"number",minimum:0,maximum:1},
      },
      required:["color","pattern","texture","styling"],
      additionalProperties:false,
    },
    evidence:{
      type:"object",
      properties:{
        verifiedFacts:{type:"array",items:{type:"string",maxLength:180},maxItems:12},
        visualObservations:{type:"array",items:{type:"string",maxLength:180},maxItems:16},
        uncertainClaims:{type:"array",items:{type:"string",maxLength:180},maxItems:12},
      },
      required:["verifiedFacts","visualObservations","uncertainClaims"],
      additionalProperties:false,
    },
    references:{
      type:"object",
      properties:{
        materialTerms:{type:"array",items:{type:"string",maxLength:100},maxItems:8},
        patternTerms:{type:"array",items:{type:"string",maxLength:100},maxItems:8},
        colorTerms:{type:"array",items:{type:"string",maxLength:100},maxItems:8},
        sourceIds:{type:"array",items:{type:"string",maxLength:80},maxItems:10},
      },
      required:["materialTerms","patternTerms","colorTerms","sourceIds"],
      additionalProperties:false,
    },
    summary:{type:"string",maxLength:700},
  },
  required:["version","observed","inferredStyle","confidence","evidence","references","summary"],
  additionalProperties:false,
};

function safeText(value:unknown,limit:number) {
  return String(value??"").replace(/\s+/g," ").trim().slice(0,limit);
}


const materialReferenceSet=new Set<string>(REAL_MENSWEAR_MATERIAL_TERMS.map((value)=>value.toLowerCase()));
const patternReferenceSet=new Set<string>(REAL_MENSWEAR_PATTERN_TERMS.map((value)=>value.toLowerCase()));
const colorReferenceSet=new Set<string>(STANDARD_COLOR_REFERENCE_TERMS.map((value)=>value.toLowerCase()));

function retainKnown(values:string[],known:Set<string>) {
  return [...new Set(values.filter((value)=>known.has(value.toLowerCase())))].slice(0,8);
}

function sourceIdsForReferences(materialTerms:string[],patternTerms:string[],colorTerms:string[]) {
  const materialSet=new Set(materialTerms.map((value)=>value.toLowerCase()));
  const patternSet=new Set(patternTerms.map((value)=>value.toLowerCase()));
  const colorSet=new Set(colorTerms.map((value)=>value.toLowerCase()));
  const ids:string[]=[];
  for(const item of FABRIC_REFERENCE_PROVENANCE.materials) if(materialSet.has(item.term.toLowerCase())) ids.push(item.source_id);
  for(const item of FABRIC_REFERENCE_PROVENANCE.patterns) if(patternSet.has(item.term.toLowerCase())) ids.push(item.source_id);
  for(const item of FABRIC_REFERENCE_PROVENANCE.colors) if(colorSet.has(item.term.toLowerCase())) ids.push(item.source_id);
  return [...new Set(ids)].slice(0,10);
}

function validatedProfile(profile:FabricAnalyzerProfile):FabricAnalyzerProfile {
  const materialTerms=retainKnown(profile.references.materialTerms,materialReferenceSet);
  const patternTerms=retainKnown(profile.references.patternTerms,patternReferenceSet);
  const colorTerms=retainKnown(profile.references.colorTerms,colorReferenceSet);
  return {
    ...profile,
    references:{
      materialTerms,
      patternTerms,
      colorTerms,
      sourceIds:sourceIdsForReferences(materialTerms,patternTerms,colorTerms),
    },
  };
}

function fabricAnalyzerModelId() {
  return process.env.LINEN_FABRIC_ANALYZER_MODEL || "openai/gpt-5.4";
}

function referenceExampleScore(example:(typeof REAL_MENSWEAR_FABRIC_EXAMPLES)[number],input:FabricAnalyzerContext,measured:FabricMeasuredData) {
  const query=[
    input.declaredMaterial,input.declaredFabricType,input.supplierColorName,input.supplierPatternName,input.notes,
    measured.colour.mappedColorFamily,measured.pattern.orientation,measured.pattern.scale,
  ].filter(Boolean).join(" ").toLowerCase();
  const hay=[
    example.manufacturer,example.product_name,example.composition,example.color_name,
    example.pattern_name,example.construction_name,...(example.usage_tags||[]),
  ].filter(Boolean).join(" ").toLowerCase();
  const tokens=query.split(/[^a-z0-9]+/).filter((token)=>token.length>=4);
  return tokens.reduce((score,token)=>score+(hay.includes(token)?1:0),0);
}

function relevantReferenceExamples(input:FabricAnalyzerContext,measured:FabricMeasuredData) {
  return [...REAL_MENSWEAR_FABRIC_EXAMPLES]
    .map((example)=>({example,score:referenceExampleScore(example,input,measured)}))
    .sort((a,b)=>b.score-a.score || a.example.id.localeCompare(b.example.id))
    .slice(0,8)
    .map(({example})=>example);
}

function referenceTermsFromExamples(examples:ReturnType<typeof relevantReferenceExamples>) {
  const materials=new Set<string>(),patterns=new Set<string>(),colors=new Set<string>();
  const materialTerms=REAL_MENSWEAR_MATERIAL_TERMS.map((term)=>term.toLowerCase());
  const patternTerms=REAL_MENSWEAR_PATTERN_TERMS.map((term)=>term.toLowerCase());
  const colorTerms=STANDARD_COLOR_REFERENCE_TERMS.map((term)=>term.toLowerCase());
  for(const example of examples) {
    const hay=[example.composition,example.construction_name,example.product_name].filter(Boolean).join(" ").toLowerCase();
    for(let i=0;i<materialTerms.length;i++) if(hay.includes(materialTerms[i])) materials.add(REAL_MENSWEAR_MATERIAL_TERMS[i]);
    const patternHay=[example.pattern_name,example.construction_name,example.product_name].filter(Boolean).join(" ").toLowerCase();
    for(let i=0;i<patternTerms.length;i++) if(patternHay.includes(patternTerms[i])) patterns.add(REAL_MENSWEAR_PATTERN_TERMS[i]);
    const colorHay=String(example.color_name||"").toLowerCase();
    for(let i=0;i<colorTerms.length;i++) if(colorHay.includes(colorTerms[i])) colors.add(STANDARD_COLOR_REFERENCE_TERMS[i]);
  }
  return {
    materials:[...materials].slice(0,30),
    patterns:[...patterns].slice(0,30),
    colors:[...colors].slice(0,30),
  };
}

export async function analyzeMenswearFabric(rawInput:FabricAnalyzerContext):Promise<FabricAnalyzerProfile> {
  const token=gatewayToken();
  if(!token) throw new Error("AI Gateway is not configured for Fabric Analyzer.");

  const input=await prepareFabricMeasurement(rawInput);
  const measured=input.measured;
  if(!measured) throw new Error("Measured Fabric Analyzer evidence is unavailable.");

  const declared=[
    input.sourceId ? `Approved reference source ID: ${safeText(input.sourceId,80)}.` : "",
    input.sourcePageUrl ? `Approved source page: ${safeText(input.sourcePageUrl,500)}.` : "",
    input.declaredMaterial ? `Declared material: ${safeText(input.declaredMaterial,120)}.` : "",
    input.declaredFabricType ? `Declared fabric type: ${safeText(input.declaredFabricType,120)}.` : "",
    input.supplierColorName ? `Supplier color name: ${safeText(input.supplierColorName,120)}.` : "",
    input.supplierPatternName ? `Supplier pattern name: ${safeText(input.supplierPatternName,120)}.` : "",
    Number.isFinite(input.swatchRealWidthMm) ? `Owner/supplier-declared photographed swatch width: ${input.swatchRealWidthMm} mm.` : "",
    Number.isFinite(input.repeatRealMm) ? `Owner/supplier-declared pattern repeat: ${input.repeatRealMm} mm.` : "",
    input.notes ? `Additional context: ${safeText(input.notes,500)}.` : "",
  ].filter(Boolean).join(" ");

  const learningHints=await loadFabricAnalyzerLearningHints();
  const learnedGuidance=learningHints.length
    ? learningHints.map((hint)=>`${hint.field_path} => ${safeText(JSON.stringify(hint.corrected_value),160)} (${hint.samples} reviewed corrections)`).join("\n")
    : "No reviewed correction pattern has reached the learning threshold yet.";

  const examples=relevantReferenceExamples(input,measured);
  const terms=referenceTermsFromExamples(examples);
  const measuredLine=[
    `colour=${measured.colour.hex}`,
    `LAB=${measured.colour.lab.l.toFixed(1)},${measured.colour.lab.a.toFixed(1)},${measured.colour.lab.b.toFixed(1)}`,
    `mappedColorFamily=${measured.colour.mappedColorFamily}`,
    `colorAnchorDeltaE=${measured.colour.deltaE}`,
    `patternOrientation=${measured.pattern.orientation}`,
    `repeatPeriodPx=${measured.pattern.repeatPeriodPx??"none"}`,
    `stripeWidthPx=${measured.pattern.stripeWidthPx??"none"}`,
    `repeatMm=${measured.pattern.repeatMm??"unknown"}`,
    `stripeWidthMm=${measured.pattern.stripeWidthMm??"unknown"}`,
    `patternContrastDeltaE=${measured.pattern.contrastDeltaE??"unknown"}`,
    `patternDensity=${measured.pattern.density}`,
    `patternScale=${measured.pattern.scale}`,
    `physicalScaleStatus=${measured.pattern.physicalScaleStatus}`,
    `imageQuality=${measured.imageQuality.score}/100`,
  ].join("; ");

  const prompt=`You are the private Fabric Analyzer for a premium menswear Designer engine.
Analyze the supplied fabric image and produce a structured styling profile.

Evidence rules:
1. Code-measured colour/pattern numbers below are authoritative for numeric/measurable fields. Do not override measured colour family, pattern scale, density, contrast or orientation with visual guesswork.
2. Use vision for pattern family, weave/texture appearance, style personality, garment use and occasion fit.
3. Separate VERIFIED declared facts from visual observations.
4. Never claim exact fibre composition, GSM, thread count, Lea, shrinkage, breathability, stretch, softness, hand-feel or physical drape from pixels.
5. Texture/weave descriptions must be appearance language such as "slub-looking" or "twill-like".
6. Real-world millimetres exist only when physicalScaleStatus is declared_repeat or declared_swatch_width.
7. Strong fabrics normally need quieter supporting garments. Return calibrated confidence and uncertainty.
8. Internal analysis only; no marketing copy.

Measured code evidence:
${measuredLine}

Closed output IDs:
Color families: ${colorFamilies.map((item)=>item.id).join(", ")}.
Garment uses: ${garmentUses.map((item)=>item.id).join(", ")}.
Occasions: ${occasions.map((item)=>item.id).join(", ")}.
Climate tags: ${climateTags.map((item)=>item.id).join(", ")}.
Designer collars: ${collarOptions.map((item)=>`${item.id}=${item.label}`).join("; ")}.
Designer cuffs: ${cuffOptions.map((item)=>`${item.id}=${item.label}`).join("; ")}.
Designer shirt fits: ${shirtFitOptions.map((item)=>`${item.id}=${item.label}`).join("; ")}.
Designer trouser directions: ${trouserDirectionOptions.map((item)=>`${item.id}=${item.label}`).join("; ")}.
Pattern strategies: ${patternStrategies.map((item)=>item.id).join(", ")}.
Evidence discipline: ${FABRIC_ANALYZER_EVIDENCE_RULES.join(" ")}

Retrieved real-reference subset from ${FABRIC_REFERENCE_INDEX_VERSION} (${FABRIC_REFERENCE_COUNTS.materials} material terms, ${FABRIC_REFERENCE_COUNTS.patterns} pattern terms, ${FABRIC_REFERENCE_COUNTS.colors} colour terms, ${REAL_MENSWEAR_FABRIC_EXAMPLE_COUNT} total real examples):
Candidate material terms: ${terms.materials.join(", ") || "none"}.
Candidate pattern terms: ${terms.patterns.join(", ") || "none"}.
Candidate colour terms: ${terms.colors.join(", ") || "none"}.
Top relevant real-fabric anchors:
${examples.map((example)=>[
  example.id,example.manufacturer,example.product_name,
  example.composition ? `composition=${example.composition}` : "",
  example.color_name ? `color=${example.color_name}` : "",
  example.pattern_name ? `pattern=${example.pattern_name}` : "",
  example.construction_name ? `construction=${example.construction_name}` : "",
  example.usage_tags?.length ? `use=${example.usage_tags.join("/")}` : "",
  `source=${example.source_id}`,
].filter(Boolean).join(" | ")).join("\n")}

Reference constraints:
- References are vocabulary/role anchors only. Never transfer composition, GSM, physical drape or provenance from a similar-looking reference.
- references.materialTerms/patternTerms/colorTerms may use only terms in the retrieved candidate lists above.
- The backend derives source IDs from provenance; do not guess them.
- Do not identify an uploaded fabric as a specific branded mill product unless explicitly declared.

Reviewed correction learning:
${learnedGuidance}

Learning constraints:
- Aggregate corrections refine classification only when current evidence is similar.
- Explicit supplier/owner facts outrank learned hints.
- Weak/conflicting evidence lowers confidence; it never justifies invention.

Known verified/declared context:
${declared || "No verified context supplied beyond the measured image evidence."}

Menswear scale:
Formality 1=relaxed/resort/casual, 2=casual/smart-casual, 3=smart-casual/semi-formal, 4=business/formal, 5=ceremonial/evening.
Statement 1=quiet base, 5=dominant hero fabric.`;

  const response=await fetch("https://ai-gateway.vercel.sh/v1/responses",{
    method:"POST",
    headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
    body:JSON.stringify({
      model:fabricAnalyzerModelId(),
      input:[{
        role:"user",
        content:[
          {type:"input_text",text:prompt},
          {type:"input_image",image_url:safeImageUrl(input.imageUrl,input.sourcePageUrl),detail:"high"},
        ],
      }],
      text:{format:{type:"json_schema",name:"linen_fabric_analyzer",strict:true,schema}},
    }),
    cache:"no-store",
    signal:AbortSignal.timeout(25_000),
  });

  if(!response.ok) throw new Error(`Fabric Analyzer failed with status ${response.status}.`);
  const raw=await response.json() as unknown;
  const text=outputText(raw);
  if(!text) throw new Error("Fabric Analyzer returned no structured output.");
  const adapted=adaptFabricProfileToV4(JSON.parse(text));
  if(!adapted) throw new Error("Fabric Analyzer returned an unsupported schema version.");

  const modelColorFamily=adapted.observed.colorFamily;
  const modelPatternScale=adapted.observed.patternScale;
  const reviewNeeded=[...adapted.reviewNeeded];
  if(modelColorFamily && modelColorFamily!==measured.colour.mappedColorFamily) {
    reviewNeeded.push(`Measured/model colour disagreement: measured=${measured.colour.mappedColorFamily}, model=${modelColorFamily}`);
  }
  if(modelPatternScale!==measured.pattern.scale && measured.pattern.orientation!=="uncertain") {
    reviewNeeded.push(`Measured/model pattern-scale disagreement: measured=${measured.pattern.scale}, model=${modelPatternScale}`);
  }

  const measuredConfidence=Math.max(.2,Math.min(1,measured.imageQuality.score/100));
  const profile:FabricAnalyzerProfile={
    ...adapted,
    observed:{
      ...adapted.observed,
      dominantColor:measured.colour.hex,
      colorFamily:measured.colour.mappedColorFamily,
      patternScale:measured.pattern.scale,
      patternDensity:measured.pattern.density,
      patternContrast:measuredPatternContrast(measured.pattern.contrastDeltaE),
      orientation:measured.pattern.orientation==="uncertain" ? adapted.observed.orientation : measured.pattern.orientation,
    },
    confidence:{
      ...adapted.confidence,
      color:Math.min(adapted.confidence.color,measuredConfidence),
      pattern:Math.min(adapted.confidence.pattern,measuredConfidence),
    },
    measured,
    imageQuality:measured.imageQuality,
    renderAssets:{
      tileUrl:null,
      placeholderUrl:null,
      tileWidthPx:null,
      tileHeightPx:null,
      repeatDetected:Boolean(measured.pattern.repeatPeriodPx),
      renderAssetVersion:null,
      scaleApproximate:measured.pattern.physicalScaleStatus==="unknown",
    },
    captureSet:[{
      role:"flat",
      imageUrl:input.imageUrl,
      contentSha256:measured.contentSha256,
    }],
    provenanceByField:{
      "measured.colour":"measured",
      "measured.pattern":"measured",
      "imageQuality":"measured",
      "observed.colorFamily":"measured",
      "observed.patternScale":"measured",
      "observed.patternDensity":"measured",
      "observed.patternContrast":"measured",
      "observed.orientation":"measured",
      "observed.patternFamily":"modelJudged",
      "observed.visibleTexture":"modelJudged",
      "observed.weaveAppearance":"modelJudged",
      "inferredStyle":"modelJudged",
      ...(input.declaredMaterial?{"evidence.declaredMaterial":"declared" as const}:{}),
      ...(input.declaredFabricType?{"evidence.declaredFabricType":"declared" as const}:{}),
      ...(Number.isFinite(input.repeatRealMm)||Number.isFinite(input.swatchRealWidthMm)
        ? {"measured.pattern.physicalScale":"declared" as const}:{}),
    },
    reviewNeeded:[...new Set(reviewNeeded)].slice(0,40),
  };
  return validatedProfile(profile);
}

export type FabricAnalyzerRun = {
  profile:FabricAnalyzerProfile;
  profileId:string|null;
  cached:boolean;
  reviewStatus:"unreviewed"|"approved"|"corrected"|"rejected"|null;
  reviewPriority:"low"|"normal"|"high";
  reviewReasons:string[];
};

function reviewPriorityFor(profile:FabricAnalyzerProfile) {
  const average=(profile.confidence.color+profile.confidence.pattern+profile.confidence.texture+profile.confidence.styling)/4;
  const reasons:string[]=[];
  if(average<.62) reasons.push("Overall Analyzer confidence is low.");
  if(profile.confidence.pattern<.62) reasons.push("Pattern classification needs human review.");
  if(profile.confidence.texture<.58) reasons.push("Texture/weave appearance is uncertain.");
  if(profile.evidence.uncertainClaims.length>=4) reasons.push("Several claims are explicitly uncertain.");
  if(!profile.references.materialTerms.length && !profile.references.patternTerms.length) reasons.push("No real-reference material or pattern term was matched.");
  const priority:FabricAnalyzerRun["reviewPriority"]=
    average<.58 || profile.confidence.pattern<.5 || profile.evidence.uncertainClaims.length>=6 ? "high"
      : average>=.82 && profile.evidence.uncertainClaims.length<=1 ? "low"
        : "normal";
  return {priority,reasons:reasons.slice(0,4)};
}

export async function analyzeMenswearReferencePage(
  pageUrl:string,
  options:{persist?:boolean;fabricId?:string}={},
) {
  const reference=await resolveFabricReferencePage(pageUrl);
  if(!reference.imageUrl) throw new Error("Approved fabric reference page does not expose a trusted preview image.");
  const run=await analyzeMenswearFabricWithStore({
    fabricId:options.fabricId,
    imageUrl:reference.imageUrl,
    sourcePageUrl:reference.canonicalUrl,
    sourceId:reference.sourceId || undefined,
    notes:[
      reference.title ? `Official source title: ${reference.title}` : "",
      reference.description ? `Official source description: ${reference.description}` : "",
    ].filter(Boolean).join(". ").slice(0,500),
  },{reuseReviewed:true,persist:options.persist!==false});
  return {reference,run};
}

export async function analyzeMenswearFabricWithStore(
  rawInput:FabricAnalyzerContext,
  options:{reuseReviewed?:boolean;persist?:boolean}={},
):Promise<FabricAnalyzerRun> {
  const reuseReviewed=options.reuseReviewed!==false;
  const persist=options.persist!==false;
  // Content measurement comes first so cache identity follows the actual image
  // bytes rather than URL query parameters, notes, or other mutable context.
  const input=await prepareFabricMeasurement(rawInput);

  if(reuseReviewed) {
    try {
      const stored=await loadStoredFabricAnalysis(input);
      if(stored && (stored.review_status==="approved" || stored.review_status==="corrected")) {
        const profile=validatedProfile(stored.profile);
        const review=reviewPriorityFor(profile);
        return {
          profile,
          profileId:stored.id,
          cached:true,
          reviewStatus:stored.review_status,
          reviewPriority:review.priority,
          reviewReasons:review.reasons,
        };
      }
    } catch {
      // Analysis remains usable when the private store is temporarily unavailable.
    }
  }

  const profile=await analyzeMenswearFabric(input);
  let profileId:string|null=null;
  if(persist) {
    try {
      profileId=await storeFabricAnalysis(input,profile,fabricAnalyzerModelId());
    } catch {
      // Never block analysis because persistence failed.
    }
  }
  const review=reviewPriorityFor(profile);
  return {
    profile,
    profileId,
    cached:false,
    reviewStatus:profileId?"unreviewed":null,
    reviewPriority:review.priority,
    reviewReasons:review.reasons,
  };
}
