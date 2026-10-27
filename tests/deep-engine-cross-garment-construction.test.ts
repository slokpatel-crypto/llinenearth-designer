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
  assert.equal(rule(context({sleeve:"roll_up_styled",cuff:"open_short_hem_cuff"}),"CG-FULL-SLEEVE-HEM")?.effect,"block");
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

test("categorical drape and unproven GSM never clear the physical evidence gate",()=>{
  const require=createRequire(import.meta.url);
  const {load}=require("../scripts/designer-test-loader.cjs");
  const engine=load("src/lib/designer/engine.ts");
  const shirt={...engine.DESIGNER_SHIRTS[0],weightGsm:180,drape:"Balanced"};
  const pant={...engine.DESIGNER_PANTS[0],weightGsm:260,drape:"Fluid"};
  const original=engine.designerMaterialEvidence(shirt,pant);
  assert(original.missing.includes(`${pant.name}: drape`));
  assert(original.missing.includes(`${pant.name}: measured GSM`));
  const profile=(fabricId:string,evidence:string,drapeValue:unknown=0.72,gsmValue:unknown=260)=>({
    version:"linen-earth-fabric-physics-v1",fabricId,
    drape:{value:drapeValue,evidence},gsm:{value:gsmValue,evidence},
  });
  for(const bad of [
    profile(pant.id,"estimated"),
    profile(pant.id,"declared"),
    profile("different-fabric","reviewed"),
    profile(pant.id,"reviewed",Number.NaN),
    profile(pant.id,"reviewed",Infinity),
    profile(pant.id,"reviewed",1.01),
    profile(pant.id,"reviewed","0.7"),
  ]){
    const evidence=engine.designerMaterialEvidence(shirt,{...pant,physicsProfile:bad});
    assert(evidence.missing.includes(`${pant.name}: drape`),JSON.stringify(bad));
  }
  const reviewed=engine.designerMaterialEvidence(shirt,{...pant,physicsProfile:profile(pant.id,"reviewed")});
  assert(!reviewed.missing.includes(`${pant.name}: drape`));
  assert(!reviewed.missing.includes(`${pant.name}: measured GSM`));
  assert.equal(reviewed.verified,original.verified+2);
  const malformedGsm=engine.designerMaterialEvidence(shirt,{...pant,physicsProfile:profile(pant.id,"reviewed",0.7,Number.POSITIVE_INFINITY)});
  assert(malformedGsm.missing.includes(`${pant.name}: measured GSM`));
});

test("wide-trouser drape rule is cleared only by reviewed evidence for the selected fabric",()=>{
  const require=createRequire(import.meta.url);
  const {load}=require("../scripts/designer-test-loader.cjs");
  const engine=load("src/lib/designer/engine.ts");
  const shirt=engine.DESIGNER_SHIRTS[0];
  const pant={...engine.DESIGNER_PANTS[0],weightGsm:260,drape:"Fluid"};
  const spec=context().spec;
  spec.pant.fit="wide_leg_drape";
  const check=(fabric:typeof pant)=>{
    const recommendation=engine.evaluateDesignerCombo(
      shirt,fabric,"Semi-Formal",engine.designerStyleForOccasion("Semi-Formal"),
      undefined,{climate:"Not specified",intention:"Balanced"},spec,
    );
    return recommendation.rules.find((item:{id:string})=>item.id==="CG-WIDE-DRAPE-VERIFY");
  };
  assert.equal(check(pant)?.status,"flag");
  assert.equal(check({...pant,physicsProfile:{
    version:"linen-earth-fabric-physics-v1",fabricId:pant.id,
    drape:{value:0.72,evidence:"estimated"},
  }})?.status,"flag");
  assert.equal(check({...pant,physicsProfile:{
    version:"linen-earth-fabric-physics-v1",fabricId:pant.id,
    drape:{value:0.72,evidence:"reviewed"},
  }}),undefined);
});

test("hot-weather catalogue weight cautions do not claim supplier-verified GSM",()=>{
  const c=context();
  c.climate="Hot / humid";
  const caution=evaluateCrossGarmentRules({
    ...c,shirtWeightClass:"Heavy",pantWeightClass:"Heavy",
  }).find(x=>x.ruleId==="CG-HOT-HEAVY");
  assert.equal(caution?.effect,"penalty");
  assert.match(caution?.explanation??"",/catalogue|supplier|confirm/i);
  assert.doesNotMatch(caution?.explanation??"",/confirmed in the heavy weight class/i);
});

test("Style Director catalogue search excludes every incompatible v2 construction candidate",()=>{
  const require=createRequire(import.meta.url);
  const {load}=require("../scripts/designer-test-loader.cjs");
  const engine=load("src/lib/designer/engine.ts");
  const {searchDesignerCatalogue}=load("src/lib/designer/search.ts");
  const {fromLegacyStyle}=load("src/lib/designer/style-spec-v2.ts");
  const style=engine.designerStyleForOccasion("Semi-Formal");
  const base=fromLegacyStyle(style);
  const shirt=engine.DESIGNER_SHIRTS.find((item:{id:string})=>item.id===engine.DESIGNER_REVIEWED_PAIRING.shirtId);
  const pant=engine.DESIGNER_PANTS.find((item:{id:string})=>item.id===engine.DESIGNER_REVIEWED_PAIRING.pantId);
  assert(shirt&&pant,"reference pairing must remain available for regression");
  const input={
    shirts:engine.DESIGNER_SHIRTS,pants:engine.DESIGNER_PANTS,currentShirt:shirt,currentPant:pant,
    chosenStyle:style,occasion:"Semi-Formal",context:{climate:"Not specified",intention:"Balanced"},
  };
  const normal=searchDesignerCatalogue({...input,styleSpec:base});
  assert(normal.length>0,"known baseline must remain recommendable");
  const incompatible=structuredClone(base);
  incompatible.shirt.type="short_sleeve_shirt";
  incompatible.shirt.sleeve="full_sleeve";
  assert.deepEqual(searchDesignerCatalogue({...input,styleSpec:incompatible}),[]);
  assert.equal(base.shirt.type,"dress_shirt","search must not mutate the saved recipe");
});

test("malformed catalogue weight and pattern vocabularies fail closed in pairing and accent rules",()=>{
  const require=createRequire(import.meta.url);
  const {load}=require("../scripts/designer-test-loader.cjs");
  const engine=load("src/lib/designer/engine.ts");
  const shirt={...engine.DESIGNER_SHIRTS[0],weightClass:"not-a-band",patternScale:"not-a-pattern"};
  const pant={...engine.DESIGNER_PANTS[0],weightClass:"Heavy",patternScale:"Fine"};
  const style=engine.designerStyleForOccasion("Semi-Formal");
  const result=engine.evaluateDesignerCombo(
    shirt,pant,"Semi-Formal",style,undefined,{climate:"Not specified",intention:"Balanced"},
  );
  assert.equal(result.rules.find((item:{id:string})=>item.id==="CR-3")?.status,"unknown");
  assert.equal(result.rules.find((item:{id:string})=>item.id==="CR-4")?.status,"unknown");
  const accent=engine.evaluateDesignerAccent(pant,shirt,"cuff","Semi-Formal");
  assert.equal(accent.find((item:{id:string})=>item.id==="MF-2")?.status,"unknown");
  assert.equal(accent.find((item:{id:string})=>item.id==="MF-4")?.status,"unknown");
  const known=engine.evaluateDesignerAccent(
    {...pant,weightClass:"Heavy",patternScale:"None"},
    {...shirt,weightClass:"Light",patternScale:"Bold"},"cuff","Semi-Formal",
  );
  assert.equal(known.find((item:{id:string})=>item.id==="MF-2")?.status,"pass");
  assert.equal(known.find((item:{id:string})=>item.id==="MF-4")?.status,"pass");
});

test("catalogue motif categories cannot suppress physical repeat confirmation",()=>{
  const require=createRequire(import.meta.url);
  const {load}=require("../scripts/designer-test-loader.cjs");
  const engine=load("src/lib/designer/engine.ts");
  const shirt={...engine.DESIGNER_SHIRTS[0],patternScale:"Fine",patternScaleVerified:false};
  const pant={...engine.DESIGNER_PANTS[0],patternScale:"None",patternScaleVerified:false};
  const style=engine.designerStyleForOccasion("Semi-Formal");
  const run=(a:typeof shirt,b:typeof pant)=>engine.evaluateDesignerCombo(
    a,b,"Semi-Formal",style,undefined,{climate:"Not specified",intention:"Balanced"},
  );
  const needs=(result:{confirmationsNeeded:string[]})=>result.confirmationsNeeded.some(x=>/physical swatch/i.test(x));
  assert(needs(run(shirt,pant)),"named pattern categories are not measured physical repeats");
  assert(needs(run({...shirt,patternScaleVerified:true},pant)),"both garments require independent evidence");
  assert(!needs(run({...shirt,patternScaleVerified:true},{...pant,patternScaleVerified:true})));
  assert(needs(run({...shirt,patternScale:"invalid",patternScaleVerified:true},{...pant,patternScaleVerified:true})));
});
