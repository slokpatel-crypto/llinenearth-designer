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
      evidenceNote:"Owner measured the physical roll and verified these facts.",
    },
    fieldProvenance:{
      "measured.pattern.physicalScale":"declared",
      "verifiedPhysical.gsm":"declared",
      "verifiedPhysical.drape":"declared",
      "verifiedPhysical.fiberContent":"declared",
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


test("reviewed profile without physical field provenance cannot upgrade physical claims",()=>{
  const reviewed=intelligence("reviewed");
  reviewed.fieldProvenance={};
  const result=applyVerifiedPhysicalFabricEvidence(fabric,reviewed);
  assert.equal(result.patternScaleVerified,undefined);
  assert.equal(result.renderScale?.physicalScaleStatus,"unknown");
  assert.equal(result.weightGsm,null);
  assert.equal(result.drape,null);
  assert.equal(result.fiberContent,null);
  assert.equal(result.fiberContentVerified,undefined);
});

test("reviewed physical claims are applied independently by field provenance",()=>{
  const reviewed=intelligence("reviewed");
  reviewed.fieldProvenance={"verifiedPhysical.gsm":"reviewed"};
  const result=applyVerifiedPhysicalFabricEvidence(fabric,reviewed);
  assert.equal(result.weightGsm,145);
  assert.equal(result.drape,null);
  assert.equal(result.fiberContent,null);
  assert.equal(result.patternScaleVerified,undefined);
});

test("reviewed scale requires actual finite physical dimensions, not only a status",()=>{
  for(const bad of [null,0,-1,Number.NaN,Number.POSITIVE_INFINITY,5001,"12"]){
    const reviewed=intelligence("reviewed");
    reviewed.measuredEvidence.repeatMm=bad as number|null;
    const result=applyVerifiedPhysicalFabricEvidence(fabric,reviewed);
    assert.equal(result.patternScaleVerified,undefined);
    assert.equal(result.renderScale?.physicalScaleStatus,"unknown");
  }
  const swatch=intelligence("reviewed");
  swatch.measuredEvidence.patternPhysicalScale="declared_swatch_width";
  swatch.measuredEvidence.repeatMm=null;
  swatch.measuredEvidence.stripeWidthMm=null;
  assert.equal(applyVerifiedPhysicalFabricEvidence(fabric,swatch).patternScaleVerified,undefined);
  swatch.measuredEvidence.stripeWidthMm=3;
  const withStripe=applyVerifiedPhysicalFabricEvidence(fabric,swatch);
  assert.equal(withStripe.patternScaleVerified,true);
  assert.equal(withStripe.renderScale?.repeatMm,null);
  assert.equal(withStripe.renderScale?.stripeWidthMm,3);
});

test("invalid stripe widths are never copied into reviewed scale",()=>{
  for(const stripeWidthMm of [-2,Number.NaN,Number.POSITIVE_INFINITY,6000,20]){
    const reviewed=intelligence("reviewed");
    reviewed.measuredEvidence.stripeWidthMm=stripeWidthMm;
    const result=applyVerifiedPhysicalFabricEvidence(fabric,reviewed);
    assert.equal(result.patternScaleVerified,true);
    assert.equal(result.renderScale?.repeatMm,10);
    assert.equal(result.renderScale?.stripeWidthMm,null);
  }
});

test("invalid source, GSM, drape and fibre cannot be promoted",()=>{
  for(const sourceUrl of ["not-a-url","http://supplier.example/roll","https://user:pass@supplier.example/roll",{}]){
    const reviewed=intelligence("reviewed");
    reviewed.verifiedPhysical.sourceUrl=sourceUrl as string;
    reviewed.verifiedPhysical.evidenceNote=null;
    const result=applyVerifiedPhysicalFabricEvidence(fabric,reviewed);
    assert.equal(result.patternScaleVerified,undefined);
    assert.equal(result.weightGsm,null);
    assert.equal(result.fiberContent,null);
  }
  const malformed=intelligence("reviewed");
  malformed.verifiedPhysical.gsm="145" as unknown as number;
  malformed.verifiedPhysical.drape="Stretchy" as "Balanced";
  malformed.verifiedPhysical.fiberContent={text:"linen"} as unknown as string;
  const result=applyVerifiedPhysicalFabricEvidence(fabric,malformed);
  assert.equal(result.weightGsm,null);
  assert.equal(result.drape,null);
  assert.equal(result.fiberContent,null);
  assert.equal(result.fiberContentVerified,undefined);
  assert.equal(result.patternScaleVerified,true);
});

test("rejected profile cannot upgrade physical facts despite reviewed trust",()=>{
  const rejected=intelligence("reviewed");
  rejected.reviewStatus="rejected";
  assert.deepEqual(applyVerifiedPhysicalFabricEvidence(fabric,rejected),fabric);
});
