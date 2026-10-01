import test from "node:test";
import assert from "node:assert/strict";
import { applyVerifiedPhysicalFabricEvidence } from "../src/lib/fabric-intelligence-evidence.ts";
import type { DesignerFabric } from "../src/lib/designer/engine.ts";
import type { DesignerFabricIntelligence } from "../src/lib/fabric-intelligence-types.ts";

const fabric:DesignerFabric={
  id:"fabric-1",
  name:"Blue Stripe",
  line:"Formal Shirting",
  image:"/fabrics/blue.webp",
  hex:"#446688",
  colorFamily:"Blue",
  tone:"Medium",
  formalityScore:4,
  patternType:"Candy Stripe",
  patternScale:"Medium",
  weightGsm:null,
  weightClass:null,
  bestSeason:null,
  roleTags:null,
  weave:null,
  texture:null,
  fiberContent:null,
  confirmedAvailableMetres:null,
  colorVerified:false,
  patternScaleVerified:false,
  fiberContentVerified:false,
  drape:null,
  opacity:null,
  comfortTags:null,
  source:"catalogue",
  allowedGarments:["shirt"],
};

const intelligence={
  profileId:"profile-1",
  analyzerVersion:"fabric-analyzer-v4",
  reviewStatus:"approved",
  trust:"reviewed",
  measuredEvidence:{
    imageQualityScore:91,
    colorDeltaE:3.2,
    measuredHex:"#456789",
    patternContrastDeltaE:20,
    patternOrientation:"vertical",
    patternPhysicalScale:"declared_repeat",
    repeatMm:18,
    stripeWidthMm:4,
    contentSha256:"sha",
  },
  verifiedPhysical:{
    gsm:145,
    drape:"Balanced",
    fiberContent:"100% linen",
    sourceUrl:"https://example.com/evidence",
  },
  colorFamily:"blue_family",
  undertone:"cool",
  depth:"mid",
  saturation:"soft",
  patternFamily:"stripe",
  patternScale:"medium",
  patternDensity:"balanced",
  patternContrast:"medium",
  visibleTexture:[],
  weaveAppearance:[],
  sheen:"low",
  visualWeight:"medium-looking",
  personality:["refined"],
  formality:5,
  statementLevel:4,
  bestGarments:["shirt"],
  bestOccasions:[],
  climateVisualFit:[],
  recommendedConstruction:{collars:[],cuffs:[],shirtFits:[],trouserDirections:[]},
  pairing:{goodColorFamilies:[],avoidColorFamilies:[],goodPatternStrategy:[]},
  reviewNeeded:[],
  confidence:{color:.9,pattern:.9,texture:.8,styling:.9},
  references:{materialTerms:[],patternTerms:[],colorTerms:[],sourceIds:[]},
} satisfies DesignerFabricIntelligence;

test("verified physical Analyzer facts enrich missing Designer fabric evidence",()=>{
  const enriched=applyVerifiedPhysicalFabricEvidence(fabric,intelligence);
  assert.equal(enriched.weightGsm,145);
  assert.equal(enriched.drape,"Balanced");
  assert.equal(enriched.fiberContent,"100% linen");
  assert.equal(enriched.fiberContentVerified,true);
  assert.equal(enriched.patternScaleVerified,true);
  assert.deepEqual(enriched.renderScale,{
    physicalScaleStatus:"declared_repeat",
    repeatMm:18,
    stripeWidthMm:4,
  });
  assert.equal(enriched.formalityScore,4);
  assert.equal(enriched.colorVerified,false);
});

test("existing verified merchandising weight and drape keep precedence",()=>{
  const enriched=applyVerifiedPhysicalFabricEvidence(
    {...fabric,weightGsm:175,drape:"Structured"},
    intelligence,
  );
  assert.equal(enriched.weightGsm,175);
  assert.equal(enriched.drape,"Structured");
});

test("unknown physical scale does not claim true-scale preview",()=>{
  const unknown={
    ...intelligence,
    measuredEvidence:{...intelligence.measuredEvidence,patternPhysicalScale:"unknown",repeatMm:null,stripeWidthMm:null},
  } satisfies DesignerFabricIntelligence;
  const enriched=applyVerifiedPhysicalFabricEvidence(fabric,unknown);
  assert.equal(enriched.patternScaleVerified,false);
  assert.equal(enriched.renderScale,undefined);
});
