import test from "node:test";
import assert from "node:assert/strict";
import { GARMENT_OPTION_LIBRARY, optionsFor, validateGarmentOptionLibrary } from "../src/lib/designer/options/library.ts";
import { fromLegacyStyle, legacyStyleHashInput, toLegacyStyle } from "../src/lib/designer/style-spec-v2.ts";

const legacy={
  collar:"Spread Collar",
  collarFinish:"Self-fabric",
  cuff:"French / Double Cuff",
  placket:"Hidden / Fly-front",
  shirtFit:"Regular / Classic Fit",
  shirtWear:"Tucked",
  trouser:"Formal Trouser (Flat-front)",
  rise:"High Rise",
  waistband:"Side-Adjuster Tabs",
  break:"Slight Break",
  button:"Mother-of-Pearl",
};

test("option library is internally valid and expanded",()=>{
  assert.deepEqual(validateGarmentOptionLibrary(),[]);
  assert(optionsFor("shirt.collar").some((item)=>item.id==="cuban_camp_collar"));
  assert(optionsFor("shirt.cuff").some((item)=>item.id==="cocktail_cuff"));
  assert(optionsFor("shirt.fit").some((item)=>item.id==="boxy_oversized"));
  assert(optionsFor("pant.fit").some((item)=>item.id==="korean_straight_wide"));
  assert(optionsFor("pant.rise").some((item)=>item.id==="extra_high_rise"));
  assert(GARMENT_OPTION_LIBRARY.every((item)=>item.formality!==null || Boolean(item.formalityNullReason)));
});

test("legacy style roundtrip preserves existing labels and hash input",()=>{
  const before=legacyStyleHashInput(legacy);
  const v2=fromLegacyStyle(legacy);
  assert.equal(v2.styleSchemaVersion,2);
  assert.equal(v2.pant.fit,"straight_classic");
  assert.equal(v2.shirt.length,"shirt_length_tuck");
  const round=toLegacyStyle(v2);
  assert.deepEqual(round,legacy);
  assert.equal(legacyStyleHashInput(round),before);
});

test("new Korean and extra-high-rise options remain provisional",()=>{
  const korean=optionsFor("pant.fit").find((item)=>item.id==="korean_straight_wide");
  const extraHigh=optionsFor("pant.rise").find((item)=>item.id==="extra_high_rise");
  assert(korean && extraHigh);
  assert.equal(korean.reviewStatus,"provisional");
  assert.equal(extraHigh.reviewStatus,"provisional");
  assert.equal(korean.renderSupport.livePreview,"none");
});
