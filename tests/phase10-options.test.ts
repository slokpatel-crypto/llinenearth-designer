import test from "node:test";
import assert from "node:assert/strict";
import { GARMENT_OPTION_LIBRARY, optionsFor, validateGarmentOptionLibrary } from "../src/lib/designer/options/library.ts";
import { fromLegacyStyle, legacyLabelForSelectedOption, legacyStyleHashInput, mergeLegacyIntoStyleSpec, styleSpecHashInput, toLegacyStyle, validateStyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

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

test("StyleSpec v2 refuses coerced construction IDs and incomplete legacy handoffs",()=>{
  const original=fromLegacyStyle(legacy);
  assert.equal(validateStyleSpecV2(original),true);
  const invalid:unknown[]=[
    {...original,shirt:{...original.shirt,collar:[original.shirt.collar]}},
    {...original,shirt:{...original.shirt,cuff:[original.shirt.cuff]}},
    {...original,pant:{...original.pant,rise:[original.pant.rise]}},
    {...original,pant:{...original.pant,type:{toString:()=>original.pant.type}}},
    {...original,shirt:{...original.shirt,wear:["tucked"]}},
    {...original,shirt:{...original.shirt,collarFinish:["Self-fabric"]}},
    {...original,legacy:["Spread Collar"]},
    {...original,legacy:"not an object"},
    {...original,legacy:{...legacy,button:["Mother-of-Pearl"]}},
    {...original,legacy:{...legacy,button:undefined}},
    {...original,legacy:{...legacy,button:"  "}},
  ];
  for(const candidate of invalid){
    assert.equal(validateStyleSpecV2(candidate),false,
      "malformed JSON must not become a valid saved design/tailor receipt");
  }
  const legitimateAdvanced={...original,shirt:{...original.shirt,cuff:"open_short_hem_cuff"}};
  assert.equal(validateStyleSpecV2(legitimateAdvanced),true,
    "typed provisional garment options remain backward compatible");
});

test("persisted v2 legacy photo controls reject unsupported and withheld labels",()=>{
  const original=fromLegacyStyle(legacy);
  assert.equal(validateStyleSpecV2(original),true);
  const invalid=[
    ["collar","Invented Collar"],
    ["collar","Wing Collar"],
    ["collarFinish","Fabric supplied by unknown seller"],
    ["cuff","Not a cuff"],
    ["placket","Contrast Placket"],
    ["shirtFit","Unverified fit"],
    ["shirtWear","Tucked or Untucked"],
    ["trouser","Imaginary trouser"],
    ["rise","Extra Highish Rise"],
    ["waistband","Custom seller waistband"],
    ["break","Unlimited Break"],
    ["button","Seller-supplied mystery button"],
  ] as const;
  for(const [key,label] of invalid){
    assert.equal(validateStyleSpecV2({...original,legacy:{...legacy,[key]:label}}),false,
      `unsupported legacy photo/tailor label must fail closed: ${key}=${label}`);
  }
  // A provisional advanced v2 construction is still valid while the original
  // photographic control remains a supported, honest legacy selection.
  assert.equal(validateStyleSpecV2({...original,shirt:{...original.shirt,cuff:"open_short_hem_cuff"}}),true);
  const supportedCuff=optionsFor("shirt.cuff").find(option=>
    option.legacySelectable!==false && option.renderSupport.livePreview==="none" && option.legacyLabel);
  if(supportedCuff){
    assert.equal(validateStyleSpecV2({...original,legacy:{...legacy,cuff:supportedCuff.legacyLabel!}}),true,
      "previously selectable provisional labels remain backward compatible");
  }
});

test("expanded options only synchronize labels supported by visible legacy controls",()=>{
  assert.equal(legacyLabelForSelectedOption("shirt.collar","spread_collar",["Spread Collar"]),"Spread Collar");
  assert.equal(legacyLabelForSelectedOption("shirt.cuff","french_double_cuff",["French / Double Cuff"]),"French / Double Cuff");
  assert.equal(legacyLabelForSelectedOption("shirt.placket","hidden_fly_front",["Hidden / Fly-front"]),"Hidden / Fly-front");
  assert.equal(legacyLabelForSelectedOption("pant.rise","high_rise",["High Rise"]),"High Rise");
  assert.equal(legacyLabelForSelectedOption("pant.waistband","side_adjuster_tabs",["Side-Adjuster Tabs"]),"Side-Adjuster Tabs");
  assert.equal(legacyLabelForSelectedOption("pant.break","slight_break",["Slight Break"]),"Slight Break");
  assert.equal(legacyLabelForSelectedOption("shirt.collar","wing_collar",["Wing Collar"]),null,
    "a legacy-unselectable wing collar must not be represented as a photographed control");
  assert.equal(legacyLabelForSelectedOption("shirt.placket","contrast_placket",["Contrast Placket"]),null);
  assert.equal(legacyLabelForSelectedOption("shirt.cuff","open_short_hem_cuff",["Barrel Cuff (1-button)"]),null);
  assert.equal(legacyLabelForSelectedOption("shirt.cuff","open_short_hem_cuff",["Open Short-Sleeve Hem"]),null,
    "a legacy-listed but unphotographed precision cuff must not replace the photo control");
  assert.equal(legacyLabelForSelectedOption("shirt.cuff","cocktail_cuff",["Cocktail Cuff"]),null,
    "provisional livePreview:none construction cannot claim photographic parity");
  assert.equal(legacyLabelForSelectedOption("pant.rise","high_rise",["Low Rise"]),null);
  assert.equal(legacyLabelForSelectedOption("pant.rise","spread_collar",["Spread Collar"]),null);
});

test("canonical collar cloth and advanced-only choices cannot rewrite photographed legacy selection",()=>{
  const base=fromLegacyStyle(legacy);
  const advanced={...base,shirt:{...base.shirt,
    collarFinish:"White contrast collar + cuffs",
    collar:"wing_collar",placket:"contrast_placket"}};
  assert.equal(validateStyleSpecV2(advanced),true);
  const displayed=toLegacyStyle(advanced);
  assert.equal(displayed.collarFinish,"White contrast collar + cuffs");
  assert.equal(displayed.collar,legacy.collar);
  assert.equal(displayed.placket,legacy.placket);
  assert.notEqual(styleSpecHashInput(advanced),styleSpecHashInput(base));
  const afterUnrelatedChange=mergeLegacyIntoStyleSpec(advanced,{...displayed,button:"Horn"});
  assert.equal(afterUnrelatedChange.shirt.collarFinish,"White contrast collar + cuffs");
  assert.equal(afterUnrelatedChange.shirt.collar,"wing_collar");
  assert.equal(afterUnrelatedChange.shirt.placket,"contrast_placket");
  assert.equal(toLegacyStyle(afterUnrelatedChange).button,"Horn");
});
