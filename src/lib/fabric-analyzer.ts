import "server-only";
import {
  FABRIC_ANALYZER_EVIDENCE_RULES,
  MENSWEAR_COLOR_TAXONOMY,
  MENSWEAR_GARMENT_USES,
  MENSWEAR_MATERIAL_TAXONOMY,
  MENSWEAR_OCCASION_TAXONOMY,
  MENSWEAR_PATTERN_TAXONOMY,
} from "@/lib/fabric-analyzer-taxonomy";
import {
  FABRIC_REFERENCE_COUNTS,
  FABRIC_REFERENCE_INDEX_VERSION,
  FABRIC_REFERENCE_SOURCES,
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
  loadFabricAnalyzerLearningHints,
  loadStoredFabricAnalysis,
  storeFabricAnalysis,
} from "@/lib/fabric-analyzer-store";

export type FabricAnalyzerContext = {
  imageUrl:string;
  declaredMaterial?:string;
  declaredFabricType?:string;
  supplierColorName?:string;
  supplierPatternName?:string;
  notes?:string;
};

export type FabricAnalyzerProfile = {
  version:"fabric-analyzer-v3";
  observed:{
    dominantColor:string;
    colorFamily:string;
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
    bestGarments:string[];
    bestOccasions:string[];
    climateVisualFit:string[];
    recommendedConstruction:{
      collars:string[];
      cuffs:string[];
      shirtFits:string[];
      trouserDirections:string[];
    };
    pairing:{
      goodColorFamilies:string[];
      avoidColorFamilies:string[];
      goodPatternStrategy:string[];
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
  summary:string;
};

const ALLOWED_HOSTS=[
  /^https:\/\/[^/]+\.vercel-storage\.com\//i,
  /^https:\/\/(cdn|media)\.fashn\.ai\//i,
  /^https:\/\/images\.unsplash\.com\//i,
];

function safeImageUrl(value:string) {
  const url=value.trim();
  if(!url || url.length>1800 || !ALLOWED_HOSTS.some((pattern)=>pattern.test(url))) {
    throw new Error("Fabric Analyzer only accepts trusted HTTPS image sources.");
  }
  return url;
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
    version:{type:"string",enum:["fabric-analyzer-v3"]},
    observed:{
      type:"object",
      properties:{
        dominantColor:{type:"string",maxLength:80},
        colorFamily:{type:"string",maxLength:60},
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
        bestGarments:{type:"array",items:{type:"string",maxLength:60},maxItems:10},
        bestOccasions:{type:"array",items:{type:"string",maxLength:80},maxItems:10},
        climateVisualFit:{type:"array",items:{type:"string",maxLength:60},maxItems:8},
        recommendedConstruction:{
          type:"object",
          properties:{
            collars:{type:"array",items:{type:"string",maxLength:60},maxItems:8},
            cuffs:{type:"array",items:{type:"string",maxLength:60},maxItems:8},
            shirtFits:{type:"array",items:{type:"string",maxLength:60},maxItems:6},
            trouserDirections:{type:"array",items:{type:"string",maxLength:80},maxItems:8},
          },
          required:["collars","cuffs","shirtFits","trouserDirections"],
          additionalProperties:false,
        },
        pairing:{
          type:"object",
          properties:{
            goodColorFamilies:{type:"array",items:{type:"string",maxLength:50},maxItems:10},
            avoidColorFamilies:{type:"array",items:{type:"string",maxLength:50},maxItems:8},
            goodPatternStrategy:{type:"array",items:{type:"string",maxLength:100},maxItems:8},
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

export async function analyzeMenswearFabric(input:FabricAnalyzerContext):Promise<FabricAnalyzerProfile> {
  const token=gatewayToken();
  if(!token) throw new Error("AI Gateway is not configured for Fabric Analyzer.");

  const declared=[
    input.declaredMaterial ? `Declared material: ${safeText(input.declaredMaterial,120)}.` : "",
    input.declaredFabricType ? `Declared fabric type: ${safeText(input.declaredFabricType,120)}.` : "",
    input.supplierColorName ? `Supplier color name: ${safeText(input.supplierColorName,120)}.` : "",
    input.supplierPatternName ? `Supplier pattern name: ${safeText(input.supplierPatternName,120)}.` : "",
    input.notes ? `Additional context: ${safeText(input.notes,300)}.` : "",
  ].filter(Boolean).join(" ");

  const learningHints=await loadFabricAnalyzerLearningHints();
  const learnedGuidance=learningHints.length
    ? learningHints.map((hint)=>`${hint.field_path} => ${safeText(JSON.stringify(hint.corrected_value),160)} (${hint.samples} reviewed corrections)`).join("\n")
    : "No reviewed correction pattern has reached the learning threshold yet.";

  const prompt=`You are the private Fabric Analyzer for a premium menswear Designer engine.
Analyze the supplied fabric/swatches visually and produce a structured styling profile.

Important evidence rules:
1. Separate VERIFIED FACTS supplied in context from what is only visually observed.
2. Never claim exact fiber composition, GSM, thread count, Lea, shrinkage, breathability, stretch, softness, hand-feel or physical drape from an image unless explicitly supplied as a verified fact.
3. Texture and weave from the image must be described as appearance only: e.g. "slub-looking", "twill-like", "open-weave appearance".
4. Be useful for menswear design: shirt, trouser, blazer, suit, overshirt, jacket and occasion decisions.
5. Pattern/formality judgments should account for scale, density, contrast, color depth and visual texture together.
6. A visually strong fabric should normally receive simpler supporting garments/construction.
7. Return calibrated confidence. If the image is ambiguous, lower confidence and state uncertainty rather than guessing.
8. This is an internal analysis tool; do not write marketing copy.

Menswear interpretation scale:
Formality 1 = relaxed/resort/casual; 2 = casual/smart-casual; 3 = smart-casual/semi-formal; 4 = business/formal; 5 = ceremonial/evening/high-formality.
Statement level 1 = quiet base; 5 = dominant hero fabric.

Internal menswear taxonomy to ground classification:
Materials/constructions: ${MENSWEAR_MATERIAL_TAXONOMY.join(", ")}.
Patterns: ${MENSWEAR_PATTERN_TAXONOMY.join(", ")}.
Shade families: ${MENSWEAR_COLOR_TAXONOMY.join(", ")}.
Garment uses: ${MENSWEAR_GARMENT_USES.join(", ")}.
Occasions: ${MENSWEAR_OCCASION_TAXONOMY.join(", ")}.
Evidence discipline: ${FABRIC_ANALYZER_EVIDENCE_RULES.join(" ")}

Real-reference corpus ${FABRIC_REFERENCE_INDEX_VERSION}:
- ${FABRIC_REFERENCE_COUNTS.materials} material/construction terms from real mills and textile authorities: ${REAL_MENSWEAR_MATERIAL_TERMS.join(", ")}.
- ${FABRIC_REFERENCE_COUNTS.patterns} source-backed pattern/construction terms: ${REAL_MENSWEAR_PATTERN_TERMS.join(", ")}.
- ${FABRIC_REFERENCE_COUNTS.colors} standardized/reference color terms: ${STANDARD_COLOR_REFERENCE_TERMS.join(", ")}.
- Source IDs available for provenance: ${FABRIC_REFERENCE_SOURCES.map((source)=>`${source.id}=${source.publisher}`).join("; ")}.
- ${REAL_MENSWEAR_FABRIC_EXAMPLE_COUNT} verified real-fabric examples from the source corpus:
${REAL_MENSWEAR_FABRIC_EXAMPLES.map((example)=>[
  example.manufacturer,
  example.product_name,
  example.composition ? `composition=${example.composition}` : "",
  example.color_name ? `color=${example.color_name}` : "",
  example.pattern_name ? `pattern=${example.pattern_name}` : "",
  example.construction_name ? `construction=${example.construction_name}` : "",
  example.weight_gsm ? `weight=${example.weight_gsm}gsm` : "",
  example.usage_tags?.length ? `use=${example.usage_tags.join("/")}` : "",
  `source=${example.source_id}`,
].filter(Boolean).join(" | ")).join("\n")}

Reviewed correction learning:
${learnedGuidance}

Learning rules:
- Treat these only as aggregate correction signals from prior reviewed Analyzer outputs.
- A learned signal may refine classification when the current image/context is similar, but it never overrides explicit verified supplier facts.
- Do not extrapolate a correction to unrelated materials, colors or patterns.
- When current visual evidence is weak or conflicts with a learned signal, lower confidence rather than forcing the learned answer.

Reference rules:
- Use references only when there is a defensible visual or declared-context match.
- Do not claim that a fabric is a specific branded mill product unless that exact product is supplied as verified context.
- references.materialTerms/patternTerms/colorTerms must contain only exact terms from the corpus above.
- The backend derives sourceIds from its provenance map; do not rely on guessed source attribution.
- A source-backed vocabulary match supports terminology, not unverified composition or provenance of the uploaded fabric.
- Real-fabric examples are anchors for vocabulary, scale and menswear role only. Never copy composition, weight or provenance from a similar-looking example onto the uploaded fabric.
- If a declared fact conflicts with visual resemblance to a reference example, preserve the declared fact and lower confidence in the visual match.

Known context, if any: ${declared || "No verified context supplied; rely only on visible evidence."}`;

  const response=await fetch("https://ai-gateway.vercel.sh/v1/responses",{
    method:"POST",
    headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
    body:JSON.stringify({
      model:fabricAnalyzerModelId(),
      input:[{
        role:"user",
        content:[
          {type:"input_text",text:prompt},
          {type:"input_image",image_url:safeImageUrl(input.imageUrl),detail:"high"},
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
  return validatedProfile(JSON.parse(text) as FabricAnalyzerProfile);
}

export type FabricAnalyzerRun = {
  profile:FabricAnalyzerProfile;
  profileId:string|null;
  cached:boolean;
  reviewStatus:"unreviewed"|"approved"|"corrected"|"rejected"|null;
};

export async function analyzeMenswearFabricWithStore(
  input:FabricAnalyzerContext,
  options:{reuseReviewed?:boolean;persist?:boolean}={},
):Promise<FabricAnalyzerRun> {
  const reuseReviewed=options.reuseReviewed!==false;
  const persist=options.persist!==false;

  if(reuseReviewed) {
    try {
      const stored=await loadStoredFabricAnalysis(input);
      if(stored && (stored.review_status==="approved" || stored.review_status==="corrected")) {
        return {
          profile:validatedProfile(stored.profile),
          profileId:stored.id,
          cached:true,
          reviewStatus:stored.review_status,
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
  return {profile,profileId,cached:false,reviewStatus:profileId?"unreviewed":null};
}
