import test from "node:test";
import assert from "node:assert/strict";
import {evaluateCrossGarmentRules} from "../src/lib/designer/rules/evaluator.ts";
import type {CrossGarmentRuleContext} from "../src/lib/designer/rules/types.ts";

function context(options:{
  sleeve?:string;cuff?:string;shirtHem?:string;wear?:string;
  pantHem?:string;pantBreak?:string;occasion?:string;
}={}):CrossGarmentRuleContext {
  return {
    spec:{
      styleSchemaVersion:2,
      shirt:{
        type:"dress_shirt",collar:"point_standard_collar",
        collarFinish:"Self-fabric",cuff:options.cuff??"barrel_cuff_1_button",
        placket:"standard_visible_placket",pocket:"no_pocket",
        sleeve:options.sleeve??"full_sleeve",fit:"regular_classic_fit",
        length:"shirt_length_regular",hem:options.shirtHem??"curved_shirttail",
        back:"plain_back",wear:options.wear??"untucked",button:"corozo",
      },
      pant:{
        type:"formal_flat_front",fit:"straight_classic",rise:"mid_rise",
        pleat:"flat_front",waistband:"belt_loops",
        hem:options.pantHem??"plain_hem",
        break:options.pantBreak??"no_break",
      },
      legacy:{} as CrossGarmentRuleContext["spec"]["legacy"],
    },
    occasion:(options.occasion??"Semi-Formal") as CrossGarmentRuleContext["occasion"],
    climate:"Not specified",
  };
}
const rule=(c:CrossGarmentRuleContext,id:string)=>
  evaluateCrossGarmentRules(c).find(x=>x.ruleId===id);

test("short sleeve blocks actual wrist cuff construction, not just a styling preference",()=>{
  for(const cuff of ["french_double_cuff","barrel_cuff_1_button","cocktail_cuff"]){
    const found=rule(context({sleeve:"half_sleeve",cuff}),"CG-SLEEVE-CUFF");
    assert.equal(found?.effect,"block",cuff);
    assert.equal(found.reviewStatus,"provisional");
  }
  assert.equal(rule(context({sleeve:"half_sleeve",cuff:"open_short_hem_cuff"}),"CG-SLEEVE-CUFF"),undefined);
});

test("full sleeve cannot silently use a short-sleeve hem instead of a wrist cuff",()=>{
  assert.equal(rule(context({sleeve:"full_sleeve",cuff:"open_short_hem_cuff"}),"CG-FULL-SLEEVE-HEM")?.effect,"block");
  assert.equal(rule(context(),"CG-FULL-SLEEVE-HEM"),undefined);
});

test("cropped pants cannot simultaneously stack or have a full shoe break",()=>{
  for(const pantBreak of ["full_break","stacked_break"]){
    assert.equal(rule(context({pantHem:"cropped_above_ankle_hem",pantBreak}),"CG-CROP-BREAK")?.effect,"block");
  }
  assert.equal(rule(context({pantHem:"cropped_above_ankle_hem",pantBreak:"no_break"}),"CG-CROP-BREAK"),undefined);
});

test("formal tucked side-vented or flat hem calls for tailor review instead of auto-correction",()=>{
  const c=context({shirtHem:"side_vents_hem",wear:"tucked",occasion:"Formal"});
  const before=JSON.stringify(c);
  const found=rule(c,"CG-HEM-TUCK");
  assert.equal(found?.effect,"penalty");
  assert.equal(found?.reviewStatus,"provisional");
  assert.equal(JSON.stringify(c),before,"engine must not modify customer-selected cut");
  assert.equal(rule(context({shirtHem:"straight_flat_hem",wear:"tucked",occasion:"Semi-Formal"}),"CG-HEM-TUCK")?.effect,"penalty");
  assert.equal(rule(context({shirtHem:"curved_shirttail",wear:"tucked",occasion:"Formal"}),"CG-HEM-TUCK"),undefined);
  assert.equal(rule(context({shirtHem:"side_vents_hem",wear:"untucked",occasion:"Formal"}),"CG-HEM-TUCK"),undefined);
});

test("legacy default regular officewear garment remains viable",()=>{
  const blocked=evaluateCrossGarmentRules(context()).filter(x=>x.effect==="block");
  assert.deepEqual(blocked,[]);
});
