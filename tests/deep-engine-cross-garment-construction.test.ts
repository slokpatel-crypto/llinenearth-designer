import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {evaluateCrossGarmentRules} from "../src/lib/designer/rules/evaluator.ts";
import type {CrossGarmentRuleContext} from "../src/lib/designer/rules/types.ts";

function context(options:{
  sleeve?:string;cuff?:string;shirtHem?:string;wear?:string;
  pantHem?:string;pantBreak?:string;occasion?:string;
  shirtType?:string;pantType?:string;pantPleat?:string;
}={}):CrossGarmentRuleContext {
  return {
    spec:{
      styleSchemaVersion:2,
      shirt:{
        type:options.shirtType??"dress_shirt",collar:"point_standard_collar",
        collarFinish:"Self-fabric",cuff:options.cuff??"barrel_cuff_1_button",
        placket:"standard_visible_placket",pocket:"no_pocket",
        sleeve:options.sleeve??"full_sleeve",fit:"regular_classic_fit",
        length:"shirt_length_regular",hem:options.shirtHem??"curved_shirttail",
        back:"plain_back",wear:options.wear??"untucked",button:"corozo",
      },
      pant:{
        type:options.pantType??"formal_flat_front",fit:"straight_classic",rise:"mid_rise",
        pleat:options.pantPleat??"flat_front",waistband:"belt_loops",
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

test("short-sleeve shirt family requires an actual short sleeve",()=>{
  for(const sleeve of ["full_sleeve","roll_up_styled"]){
    assert.equal(rule(context({shirtType:"short_sleeve_shirt",sleeve}),"CG-SHORT-TYPE-SLEEVE")?.effect,"block",sleeve);
  }
  assert.equal(rule(context({shirtType:"short_sleeve_shirt",sleeve:"half_sleeve",cuff:"open_short_hem_cuff"}),"CG-SHORT-TYPE-SLEEVE"),undefined);
  assert.equal(rule(context({shirtType:"dress_shirt",sleeve:"full_sleeve"}),"CG-SHORT-TYPE-SLEEVE"),undefined);
});

test("trouser family and pleat IDs must describe the same construction",()=>{
  for(const pantPleat of ["single_pleat_forward","double_pleat_reverse"]){
    assert.equal(rule(context({pantType:"formal_flat_front",pantPleat}),"CG-PLEAT-TYPE")?.effect,"block",pantPleat);
  }
  assert.equal(rule(context({pantType:"pleated_trouser",pantPleat:"flat_front"}),"CG-PLEAT-TYPE")?.effect,"block");
  assert.equal(rule(context({pantType:"pleated_trouser",pantPleat:"single_pleat_reverse"}),"CG-PLEAT-TYPE"),undefined);
  assert.equal(rule(context({pantType:"formal_flat_front",pantPleat:"flat_front"}),"CG-PLEAT-TYPE"),undefined);
  // Unrelated garment families remain provisional rather than being guessed incompatible.
  assert.equal(rule(context({pantType:"chino",pantPleat:"flat_front"}),"CG-PLEAT-TYPE"),undefined);
});

test("cropped trouser type and cropped hem cannot claim a shoe break",()=>{
  for(const pantBreak of ["slight_break","full_break","stacked_break"]){
    assert.equal(rule(context({pantType:"cropped_ankle",pantBreak}),"CG-CROPPED-TYPE-BREAK")?.effect,"block",pantBreak);
    assert.equal(rule(context({pantHem:"cropped_above_ankle_hem",pantBreak}),"CG-CROP-BREAK")?.effect,"block",pantBreak);
  }
  assert.equal(rule(context({pantType:"cropped_ankle",pantBreak:"cropped_above_ankle"}),"CG-CROPPED-TYPE-BREAK"),undefined);
  assert.equal(rule(context({pantType:"cropped_ankle",pantBreak:"no_break"}),"CG-CROPPED-TYPE-BREAK"),undefined);
  assert.equal(rule(context({pantType:"formal_flat_front",pantBreak:"slight_break"}),"CG-CROPPED-TYPE-BREAK"),undefined);
});

test("construction conflicts remain deterministic and do not mutate a saved recipe",()=>{
  const c=context({shirtType:"short_sleeve_shirt",pantType:"formal_flat_front",pantPleat:"double_pleat_forward",pantBreak:"full_break",pantHem:"cropped_above_ankle_hem"});
  const before=JSON.stringify(c);
  const first=evaluateCrossGarmentRules(c);
  assert.deepEqual(evaluateCrossGarmentRules(c),first);
  assert.equal(JSON.stringify(c),before);
  for(const id of ["CG-SHORT-TYPE-SLEEVE","CG-PLEAT-TYPE","CG-CROP-BREAK"]){
    const hit=first.find(x=>x.ruleId===id);
    assert.equal(hit?.effect,"block",id);
    assert.equal(hit?.reviewStatus,"provisional",id);
  }
});

test("Style Director maps the exact v2 construction blockers into high-severity recommendation flags",()=>{
  // Load the existing reference-backed engine through the repository's Node test adapter.
  const require=createRequire(import.meta.url);
  const {load}=require("../scripts/designer-test-loader.cjs");
  const engine=load("src/lib/designer/engine.ts");
  const spec=context({shirtType:"short_sleeve_shirt",pantType:"formal_flat_front",pantPleat:"single_pleat_forward"}).spec;
  const recommendation=engine.evaluateDesignerCombo(
    engine.DESIGNER_SHIRTS[0],engine.DESIGNER_PANTS[0],"Semi-Formal",
    engine.designerStyleForOccasion("Semi-Formal"),undefined,
    {climate:"Not specified",intention:"Balanced"},spec,
  );
  for(const id of ["CG-SHORT-TYPE-SLEEVE","CG-PLEAT-TYPE"]){
    const flag=recommendation.rules.find((item:{id:string})=>item.id===id);
    assert.equal(flag?.status,"flag",id);
    assert.equal(flag?.severity,"High",id);
  }
  assert.equal(recommendation.status,"needs_review");
});
