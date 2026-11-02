import test from "node:test";
import assert from "node:assert/strict";
import { measurePattern } from "../src/lib/fabric-measurement-core.ts";
import { applyVerifiedPhysicalFabricEvidence } from "../src/lib/fabric-intelligence-evidence.ts";
import type { DesignerFabric } from "../src/lib/designer/engine.ts";
import type { DesignerFabricIntelligence } from "../src/lib/fabric-intelligence-types.ts";

const size=128;
const vertical=new Uint8Array(size*size);
const horizontal=new Uint8Array(size*size);
for(let y=0;y<size;y++) for(let x=0;x<size;x++){
  vertical[y*size+x]=Math.floor(x/4)%2===0?40:210;
  horizontal[y*size+x]=Math.floor(y/4)%2===0?40:210;
}
const plain=new Uint8Array(size*size).fill(120);
const pattern=(gray:Uint8Array,physical?:{swatchRealWidthMm?:number;repeatRealMm?:number;originalWidthPx?:number})=>
  measurePattern(gray,size,size,[],physical);

test("width-only swatch calibration measures the X-axis stripe repeat, not the Y-axis",()=>{
  const x=pattern(vertical,{swatchRealWidthMm:256,originalWidthPx:1024});
  assert.equal(x.orientation,"vertical");
  assert.equal(x.repeatPeriodPx,8);
  assert.equal(x.physicalScaleStatus,"declared_swatch_width");
  assert.equal(x.repeatMm,16);
  const y=pattern(horizontal,{swatchRealWidthMm:256,originalWidthPx:1024});
  assert.equal(y.orientation,"horizontal");
  assert.equal(y.physicalScaleStatus,"unknown");
  assert.equal(y.repeatMm,null);
});

test("supplier repeat calibrates visible horizontal motif but does not certify an invisible motif",()=>{
  const known=pattern(horizontal,{repeatRealMm:12});
  assert.equal(known.physicalScaleStatus,"declared_repeat");
  assert.equal(known.repeatMm,12);
  for(const gray of [plain]){
    for(const physical of [{repeatRealMm:12},{swatchRealWidthMm:256,originalWidthPx:1024}]){
      const actual=pattern(gray,physical);
      assert.equal(actual.physicalScaleStatus,"unknown");
      assert.equal(actual.repeatMm,null);
      assert.equal(actual.stripeWidthMm,null);
    }
  }
});

test("nonfinite, negative, zero, and unreasonable physical dimensions cannot become calibrated",()=>{
  for(const value of [NaN,Infinity,-Infinity,0,-5,5000.1]){
    const repeat=pattern(vertical,{repeatRealMm:value});
    assert.equal(repeat.physicalScaleStatus,"unknown",String(value));
    assert.equal(repeat.repeatMm,null);
    const swatch=pattern(vertical,{swatchRealWidthMm:value,originalWidthPx:1024});
    assert.equal(swatch.physicalScaleStatus,"unknown",String(value));
    assert.equal(swatch.repeatMm,null);
  }
  const badPixelWidth=pattern(vertical,{swatchRealWidthMm:256,originalWidthPx:NaN});
  assert.equal(badPixelWidth.physicalScaleStatus,"unknown");
  assert.equal(badPixelWidth.repeatMm,null);
});

function reviewed():DesignerFabricIntelligence{
  return {
    trust:"reviewed",
    measuredEvidence:{patternPhysicalScale:"declared_repeat",patternOrientation:"vertical",repeatMm:12,stripeWidthMm:3},
    verifiedPhysical:{gsm:150,drape:"Balanced",fiberContent:"100% linen",sourceUrl:null,evidenceNote:"Supplier measured sample roll on 2026-10-01."},
    fieldProvenance:{
      "measured.pattern.physicalScale":"declared",
      "verifiedPhysical.gsm":"declared",
      "verifiedPhysical.drape":"declared",
      "verifiedPhysical.fiberContent":"declared",
    },
  } as DesignerFabricIntelligence;
}
const base={
  renderScale:{physicalScaleStatus:"unknown",repeatMm:null,stripeWidthMm:null},
  weightGsm:null,drape:null,fiberContent:null,
} as unknown as DesignerFabric;
const apply=(i:DesignerFabricIntelligence)=>applyVerifiedPhysicalFabricEvidence(base,i);

test("reviewed metadata with absent or invalid repeat never certifies pattern scale",()=>{
  for(const invalid of [null,undefined,NaN,Infinity,0,-1,5000.1,"12"]){
    const i=reviewed();
    i.measuredEvidence.repeatMm=invalid as number|null;
    const result=apply(i);
    assert.notEqual(result.patternScaleVerified,true,String(invalid));
    assert.equal(result.renderScale?.physicalScaleStatus,"unknown");
  }
  for(const invalid of [-2,Infinity,20,"3"]){
    const i=reviewed();
    i.measuredEvidence.stripeWidthMm=invalid as number;
    assert.notEqual(apply(i).patternScaleVerified,true,String(invalid));
  }
});

test("field claims stay isolated: invalid GSM and provenance cannot upgrade unrelated physical truth",()=>{
  const i=reviewed();
  i.verifiedPhysical.gsm=Infinity;
  const output=apply(i);
  assert.equal(output.weightGsm,null);
  assert.equal(output.patternScaleVerified,true);
  assert.equal(output.fiberContentVerified,true);

  for(const missingSource of [{sourceUrl:null,evidenceNote:null},{sourceUrl:"ftp://invalid.test/spec",evidenceNote:"Owner measured valid sample"}]){
    const bad=reviewed();
    bad.verifiedPhysical={...bad.verifiedPhysical,...missingSource};
    const result=apply(bad);
    assert.equal(result.weightGsm,null);
    assert.notEqual(result.patternScaleVerified,true);
    assert.equal(result.fiberContentVerified,undefined);
  }
});

test("model judgement, unreviewed profiles and image-only estimates never promote physical properties",()=>{
  const model=reviewed();
  model.fieldProvenance={
    "measured.pattern.physicalScale":"modelJudged",
    "verifiedPhysical.gsm":"modelJudged",
    "verifiedPhysical.drape":"modelJudged",
    "verifiedPhysical.fiberContent":"modelJudged",
  };
  const guess=apply(model);
  assert.equal(guess.patternScaleVerified,undefined);
  assert.equal(guess.weightGsm,null);
  assert.equal(guess.fiberContentVerified,undefined);
  model.trust="provisional";
  model.fieldProvenance=reviewed().fieldProvenance;
  const unreviewed=apply(model);
  assert.equal(unreviewed.patternScaleVerified,undefined);
  assert.equal(unreviewed.weightGsm,null);
});
