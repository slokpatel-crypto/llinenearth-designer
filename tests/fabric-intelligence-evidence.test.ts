import test from "node:test";
import assert from "node:assert/strict";
import { applyVerifiedPhysicalFabricEvidence } from "../src/lib/fabric-intelligence-evidence.ts";
import type { DesignerFabric } from "../src/lib/designer/engine.ts";
import type { DesignerFabricIntelligence } from "../src/lib/fabric-intelligence-types.ts";

const fabric:DesignerFabric={
  id:"stripe-a",
  name:"Stripe A",
  line:"Test",
  image:"/fabrics/test.webp",
  hex:"#AABBCC",
  colorFamily:null,
  tone:null,
  formalityScore:null,
  patternType:"Stripe",
  patternScale:null,
  renderScale:{physicalScaleStatus:"unknown",repeatMm:null,stripeWidthMm:null},
  weightGsm:null,
  weightClass:null,
  bestSeason:null,
  roleTags:null,
  weave:null,
  texture:null,
  fiberContent:null,
  confirmedAvailableMetres:null,
  drape:null,
  opacity:null,
  comfortTags:null,
  source:"test",
  allowedGarments:["shirt"],
};

function intelligence(trust:DesignerFabricIntelligence["trust"]):DesignerFabricIntelligence {
  return {
    profileId:"profile-1",
    analyzerVersion:"fabric-analyzer-v4",
    reviewStatus:trust==="reviewed"?"approved":"unreviewed",
    trust,
    measuredEvidence:{
      imageQualityScore:90,
      colorDeltaE:1,
      measuredHex:"#AABBCC",
      patternContrastDeltaE:12,
      patternOrientation:"vertical",
      patternPhysicalScale:"declared_repeat",
      repeatMm:10,
      stripeWidthMm:2,
      contentSha256:"abc",
    },
    verifiedPhysical:{
      gsm:145,
      drape:"Balanced",
      fiberContent:"100% Linen",
      sourceUrl:null,
    },
    colorFamily:null,
    undertone:"neutral",
    depth:"mid",
    saturation:"medium",
    patternFamily:"stripe",
    patternScale:"fine",
    patternDensity:"balanced",
    patternContrast:"medium",
    visibleTexture:[],
    weaveAppearance:[],
    sheen:"matte",
    visualWeight:"medium-looking",
    personality:[],
    formality:3,
    statementLevel:2,
    bestGarments:[],
    bestOccasions:[],
    climateVisualFit:[],
    recommendedConstruction:{collars:[],cuffs:[],shirtFits:[],trouserDirections:[]},
    pairing:{goodColorFamilies:[],avoidColorFamilies:[],goodPatternStrategy:[]},
    reviewNeeded:[],
    confidence:{color:.9,pattern:.9,texture:.9,styling:.9},
    references:{materialTerms:[],patternTerms:[],colorTerms:[],sourceIds:[]},
  };
}

test("unreviewed physical measurements cannot upgrade customer fabric truth",()=>{
  const result=applyVerifiedPhysicalFabricEvidence(fabric,intelligence("high-confidence"));
  assert.equal(result.patternScaleVerified,undefined);
  assert.equal(result.renderScale?.physicalScaleStatus,"unknown");
  assert.equal(result.weightGsm,null);
  assert.equal(result.drape,null);
  assert.equal(result.fiberContent,null);
});

test("reviewed physical evidence upgrades scale and material facts",()=>{
  const result=applyVerifiedPhysicalFabricEvidence(fabric,intelligence("reviewed"));
  assert.equal(result.patternScaleVerified,true);
  assert.equal(result.renderScale?.physicalScaleStatus,"declared_repeat");
  assert.equal(result.renderScale?.repeatMm,10);
  assert.equal(result.weightGsm,145);
  assert.equal(result.drape,"Balanced");
  assert.equal(result.fiberContent,"100% Linen");
  assert.equal(result.fiberContentVerified,true);
});
