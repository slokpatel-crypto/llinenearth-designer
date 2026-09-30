import test from "node:test";
import assert from "node:assert/strict";
import { GARMENT_OPTION_LIBRARY, optionsFor, validateGarmentOptionLibrary } from "../src/lib/designer/options/library.ts";
import { fromLegacyStyle, legacyStyleHashInput, mergeLegacyIntoStyleSpec, styleSpecHashInput, toLegacyStyle, validateStyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

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
  assert.deepEqual(optionsFor("shirt.wear").map((item)=>item.id),["untucked","tucked"]);
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


test("StyleSpec v2 preserves expanded choices when a legacy field changes",()=>{
  const base=fromLegacyStyle(legacy);
  const expanded={
    ...base,
    shirt:{...base.shirt,type:"camp_collar_resort",length:"shirt_length_short",back:"box_pleat_back"},
    pant:{...base.pant,fit:"korean_straight_wide",pleat:"double_pleat_reverse",hem:"cuffed_turn_up"},
  };
  assert.equal(validateStyleSpecV2(expanded),true);
  const changed={...legacy,collar:"Cutaway Collar"};
  const merged=mergeLegacyIntoStyleSpec(expanded,changed);
  assert.equal(merged.shirt.collar,"cutaway_collar");
  assert.equal(merged.shirt.type,"camp_collar_resort");
  assert.equal(merged.shirt.length,"shirt_length_short");
  assert.equal(merged.pant.fit,"korean_straight_wide");
  assert.equal(merged.pant.pleat,"double_pleat_reverse");
  assert.equal(merged.pant.hem,"cuffed_turn_up");
  assert.equal(toLegacyStyle(merged).collar,"Cutaway Collar");
});


test("StyleSpec v2 canonical hash changes only when canonical construction changes",()=>{
  const base=fromLegacyStyle(legacy);
  const reordered={...base,shirt:{...base.shirt},pant:{...base.pant}};
  assert.equal(styleSpecHashInput(base),styleSpecHashInput(reordered));
  const expanded={...base,pant:{...base.pant,fit:"korean_straight_wide"}};
  assert.notEqual(styleSpecHashInput(base),styleSpecHashInput(expanded));
});
