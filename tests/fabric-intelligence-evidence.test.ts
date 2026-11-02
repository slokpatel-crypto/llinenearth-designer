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

test("missing or inconsistent physical repeat never upgrades customer scale",()=>{
  for(const [repeatMm,stripeWidthMm] of [
    [null,null],[0,null],[-3,null],[Infinity,null],[10,11],[10,NaN],
  ] as const) {
    const reviewed=intelligence("reviewed");
    reviewed.measuredEvidence.repeatMm=repeatMm;
    reviewed.measuredEvidence.stripeWidthMm=stripeWidthMm;
    const result=applyVerifiedPhysicalFabricEvidence(fabric,reviewed);
    assert.equal(result.patternScaleVerified,undefined);
    assert.equal(result.renderScale?.physicalScaleStatus,"unknown");
  }
});

test("invalid physical evidence URL and unproven physical facts fail closed",()=>{
  for(const sourceUrl of ["javascript:alert(1)","http://example.com/spec","https://"]) {
    const reviewed=intelligence("reviewed");
    reviewed.verifiedPhysical.sourceUrl=sourceUrl;
    reviewed.verifiedPhysical.evidenceNote=null;
    const result=applyVerifiedPhysicalFabricEvidence(fabric,reviewed);
    assert.equal(result.patternScaleVerified,undefined);
    assert.equal(result.weightGsm,null);
    assert.equal(result.drape,null);
    assert.equal(result.fiberContent,null);
  }
});

test("invalid GSM, drape or fibre values cannot turn into verified physical facts",()=>{
  const reviewed=intelligence("reviewed");
  reviewed.verifiedPhysical.gsm=Infinity;
  reviewed.verifiedPhysical.drape="Rigid" as never;
  reviewed.verifiedPhysical.fiberContent="   ";
  const result=applyVerifiedPhysicalFabricEvidence(fabric,reviewed);
  assert.equal(result.weightGsm,null);
  assert.equal(result.drape,null);
  assert.equal(result.fiberContent,null);
  assert.equal(result.fiberContentVerified,undefined);
});

test("previously verified fibre content is not overwritten by later analysis",()=>{
  const prior={...fabric,fiberContent:"100% verified cotton",fiberContentVerified:true};
  const result=applyVerifiedPhysicalFabricEvidence(prior,intelligence("reviewed"));
  assert.equal(result.fiberContent,"100% verified cotton");
  assert.equal(result.fiberContentVerified,true);
});

test("persisted JSON cannot coerce provenance or supplier source into reviewed physical claims",()=>{
  for(const field of ["measured.pattern.physicalScale","verifiedPhysical.gsm","verifiedPhysical.drape","verifiedPhysical.fiberContent"] as const){
    const reviewed=intelligence("reviewed");
    reviewed.fieldProvenance={...reviewed.fieldProvenance,[field]:["declared"] as never};
    const result=applyVerifiedPhysicalFabricEvidence(fabric,reviewed);
    if(field==="measured.pattern.physicalScale") assert.equal(result.patternScaleVerified,undefined);
    if(field==="verifiedPhysical.gsm") assert.equal(result.weightGsm,null);
    if(field==="verifiedPhysical.drape") assert.equal(result.drape,null);
    if(field==="verifiedPhysical.fiberContent") assert.equal(result.fiberContentVerified,undefined);
  }
  for(const [field,value] of [
    ["sourceUrl",["https://supplier.example/roll"]],
    ["evidenceNote",["Inspector measured physical roll"]],
    ["sourceUrl",{url:"https://supplier.example/roll"}],
    ["evidenceNote",{text:"Inspector measured physical roll"}],
  ] as const){
    const reviewed=intelligence("reviewed");
    reviewed.verifiedPhysical={...reviewed.verifiedPhysical,sourceUrl:null,evidenceNote:"Inspector recorded physical roll", [field]:value as never};
    const result=applyVerifiedPhysicalFabricEvidence(fabric,reviewed);
    assert.equal(result.patternScaleVerified,undefined,field);
    assert.equal(result.weightGsm,null,field);
    assert.equal(result.drape,null,field);
    assert.equal(result.fiberContentVerified,undefined,field);
  }
  for(const [field,value] of [
    ["sourceUrl","https://supplier.example/"+"a".repeat(1800)],
    ["evidenceNote","e".repeat(501)],
  ] as const){
    const reviewed=intelligence("reviewed");
    reviewed.verifiedPhysical={...reviewed.verifiedPhysical,[field]:value};
    const result=applyVerifiedPhysicalFabricEvidence(fabric,reviewed);
    assert.equal(result.patternScaleVerified,undefined,field);
    assert.equal(result.weightGsm,null,field);
  }
  const wrongDrape=intelligence("reviewed");
  wrongDrape.verifiedPhysical.drape=["Balanced"] as never;
  assert.equal(applyVerifiedPhysicalFabricEvidence(fabric,wrongDrape).drape,null);
});

test("customer scale certification rejects unsupported axis even with reviewed supplier numbers",()=>{
  for(const physicalScale of ["declared_repeat","declared_swatch_width"] as const){
    for(const patternOrientation of ["none","uncertain","grid",null] as const){
      const reviewed=intelligence("reviewed");
      reviewed.measuredEvidence.patternPhysicalScale=physicalScale;
      reviewed.measuredEvidence.patternOrientation=patternOrientation;
      const result=applyVerifiedPhysicalFabricEvidence(fabric,reviewed);
      assert.equal(result.patternScaleVerified,undefined,`${physicalScale} / ${patternOrientation}`);
    }
  }
  for(const patternOrientation of ["horizontal","grid","uncertain"] as const){
    const reviewed=intelligence("reviewed");
    reviewed.measuredEvidence.patternPhysicalScale="declared_swatch_width";
    reviewed.measuredEvidence.patternOrientation=patternOrientation;
    assert.equal(applyVerifiedPhysicalFabricEvidence(fabric,reviewed).patternScaleVerified,undefined,patternOrientation);
  }
  const horizontal=intelligence("reviewed");
  horizontal.measuredEvidence.patternOrientation="horizontal";
  assert.equal(applyVerifiedPhysicalFabricEvidence(fabric,horizontal).patternScaleVerified,true);
  const validSwatch=intelligence("reviewed");
  validSwatch.measuredEvidence.patternPhysicalScale="declared_swatch_width";
  assert.equal(applyVerifiedPhysicalFabricEvidence(fabric,validSwatch).patternScaleVerified,true);
});

test("rejected or pending review cannot promote customer fabric claims even with stale reviewed trust",()=>{
  for(const reviewStatus of ["rejected","unreviewed"] as const){
    const stale=intelligence("reviewed");
    stale.reviewStatus=reviewStatus;
    const output=applyVerifiedPhysicalFabricEvidence(fabric,stale);
    assert.equal(output.patternScaleVerified,undefined,reviewStatus);
    assert.equal(output.renderScale?.physicalScaleStatus,"unknown",reviewStatus);
    assert.equal(output.weightGsm,null,reviewStatus);
    assert.equal(output.drape,null,reviewStatus);
    assert.equal(output.fiberContentVerified,undefined,reviewStatus);
  }
  const corrected=intelligence("reviewed");
  corrected.reviewStatus="corrected";
  assert.equal(applyVerifiedPhysicalFabricEvidence(fabric,corrected).patternScaleVerified,true);
  assert.equal(applyVerifiedPhysicalFabricEvidence(fabric,corrected).fiberContentVerified,true);
  const missing=intelligence("reviewed");
  (missing as unknown as Record<string,unknown>).reviewStatus=undefined;
  assert.equal(applyVerifiedPhysicalFabricEvidence(fabric,missing).patternScaleVerified,undefined);
});
