import "server-only";
import {
  FABRIC_ANALYZER_EVIDENCE_RULES,
  MENSWEAR_COLOR_TAXONOMY,
  MENSWEAR_GARMENT_USES,
  MENSWEAR_MATERIAL_TAXONOMY,
  MENSWEAR_OCCASION_TAXONOMY,
  MENSWEAR_PATTERN_TAXONOMY,
} from "@/lib/fabric-analyzer-taxonomy";

export type FabricAnalyzerContext = {
  imageUrl:string;
  declaredMaterial?:string;
  declaredFabricType?:string;
  supplierColorName?:string;
  supplierPatternName?:string;
  notes?:string;
};

export type FabricAnalyzerProfile = {
  version:"fabric-analyzer-v1";
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
    version:{type:"string",enum:["fabric-analyzer-v1"]},
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
    summary:{type:"string",maxLength:700},
  },
  required:["version","observed","inferredStyle","confidence","evidence","summary"],
  additionalProperties:false,
};

function safeText(value:unknown,limit:number) {
  return String(value??"").replace(/\s+/g," ").trim().slice(0,limit);
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

Known context, if any: ${declared || "No verified context supplied; rely only on visible evidence."}`;

  const response=await fetch("https://ai-gateway.vercel.sh/v1/responses",{
    method:"POST",
    headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
    body:JSON.stringify({
      model:(process.env.LINEN_FABRIC_ANALYZER_MODEL || "openai/gpt-5.4"),
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
  return JSON.parse(text) as FabricAnalyzerProfile;
}
