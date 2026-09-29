import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCrossGarmentRules } from "../src/lib/designer/rules/evaluator.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";
import { FABRIC_INTELLIGENCE_WEIGHTS } from "../src/lib/designer/weights.ts";

function base():StyleSpecV2 {
  return {
    styleSchemaVersion:2,
    shirt:{
      type:"dress_shirt",collar:"point_standard_collar",collarFinish:"Self-fabric",
      cuff:"barrel_cuff_1_button",placket:"standard_visible_placket",pocket:"no_pocket",
      sleeve:"full_sleeve",fit:"regular_classic_fit",length:"shirt_length_regular",
      hem:"curved_shirttail",back:"plain_back",wear:"tucked",button:"plastic_resin",
    },
    pant:{
      type:"formal_flat_front",fit:"straight_classic",rise:"mid_rise",pleat:"flat_front",
      waistband:"belt_loops",hem:"plain_hem",break:"no_break",
    },
    legacy:{
      collar:"Point (Standard) Collar",collarFinish:"Self-fabric",cuff:"Barrel Cuff (1-button)",
      placket:"Standard (visible stitch)",shirtFit:"Regular / Classic Fit",shirtWear:"Tucked",
      trouser:"Formal Trouser (Flat-front)",rise:"Mid Rise",waistband:"Belt Loops",break:"No Break",button:"Plastic / Resin",
    },
  };
}

test("high-rise untucked and Korean-wide proportion rules explain the conflict",()=>{
  const spec=base();
  spec.shirt.wear="untucked";
  spec.pant.rise="extra_high_rise";
  spec.pant.fit="korean_straight_wide";
  const rules=evaluateCrossGarmentRules({spec,occasion:"Smart-Casual",climate:"Not specified",pantDrapeVerified:false});
  assert(rules.some((item)=>item.ruleId==="CG-RISE-TUCK" && item.effect==="penalty"));
  assert(rules.some((item)=>item.ruleId==="CG-WIDE-PROPORTION"));
  assert(rules.some((item)=>item.ruleId==="CG-WIDE-DRAPE-VERIFY"));
});

test("camp collar tucked is blocked",()=>{
  const spec=base();
  spec.shirt.type="camp_collar_resort";
  spec.shirt.collar="cuban_camp_collar";
  spec.shirt.wear="tucked";
  const rules=evaluateCrossGarmentRules({spec,occasion:"Casual",climate:"Hot / humid"});
  assert(rules.some((item)=>item.ruleId==="CG-CAMP-UNTUCKED" && item.effect==="block"));
});

test("pattern load and festive band directions are deterministic",()=>{
  const spec=base();
  const bold=evaluateCrossGarmentRules({
    spec,occasion:"Casual",climate:"Not specified",
    shirtPatternScale:"Bold",pantPatternScale:"Medium-Bold",
  });
  assert(bold.some((item)=>item.ruleId==="CG-PATTERN-LOAD" && item.severity==="High"));

  spec.shirt.type="band_collar_shirt";
  spec.shirt.collar="mandarin_band_collar";
  spec.pant.type="jodhpuri_churidar";
  const festive=evaluateCrossGarmentRules({spec,occasion:"Semi-Formal",climate:"Air-conditioned"});
  assert(festive.some((item)=>item.ruleId==="CG-FESTIVE-BAND" && item.effect==="bonus"));
});

test("fabric intelligence ranking uses named weight configuration",()=>{
  assert.equal(FABRIC_INTELLIGENCE_WEIGHTS.trust.reviewed,1);
  assert(FABRIC_INTELLIGENCE_WEIGHTS.trust.provisional<FABRIC_INTELLIGENCE_WEIGHTS.trust.highConfidence);
  assert(FABRIC_INTELLIGENCE_WEIGHTS.colorPair.shirtAvoid<0);
  assert(FABRIC_INTELLIGENCE_WEIGHTS.patternPair.bothStrong<0);
});
