import fs from "node:fs";
import path from "node:path";
import { evaluateCrossGarmentRules } from "../src/lib/designer/rules/evaluator.ts";

const root=path.resolve("evals");
const definition=JSON.parse(fs.readFileSync(path.join(root,"rules.engine.json"),"utf8"));
const reportDir=path.join(root,"reports");
fs.mkdirSync(reportDir,{recursive:true});

const base={
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

function merge(baseValue,patch={}) {
  return {
    ...baseValue,
    shirt:{...baseValue.shirt,...(patch.shirt||{})},
    pant:{...baseValue.pant,...(patch.pant||{})},
    legacy:{...baseValue.legacy},
  };
}

const rows=definition.cases.map((item)=>{
  const context={
    spec:merge(base,item.patch),
    occasion:item.occasion,
    climate:item.climate,
    ...(item.signals||{}),
  };
  const rules=evaluateCrossGarmentRules(context);
  const ids=new Set(rules.map((rule)=>rule.ruleId));
  const missing=(item.expected||[]).filter((id)=>!ids.has(id));
  const forbidden=(item.forbidden||[]).filter((id)=>ids.has(id));
  return {
    id:item.id,
    pass:missing.length===0&&forbidden.length===0,
    triggered:[...ids],
    missing,
    forbiddenTriggered:forbidden,
  };
});
const passed=rows.filter((row)=>row.pass).length;
const output={
  kind:"designer-engine-rules",
  generatedAt:new Date().toISOString(),
  status:passed===rows.length?"pass":"fail",
  scope:"deterministic engineering invariants only; not owner taste accuracy",
  total:rows.length,
  passed,
  passPct:rows.length?Math.round(passed/rows.length*1000)/10:null,
  cases:rows,
};
fs.writeFileSync(path.join(reportDir,"engine-rules.json"),JSON.stringify(output,null,2)+"\n");
console.log(`engine rules: ${passed}/${rows.length} cases passed. Report: evals/reports/engine-rules.json`);
if(passed!==rows.length) process.exit(1);
