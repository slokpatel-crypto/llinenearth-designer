import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { DesignerSearchInput } from "../src/lib/designer/search.ts";
import type { DesignerJudgement } from "../src/lib/designer/advisor.ts";
const {load}=createRequire(import.meta.url)("../scripts/designer-test-loader.cjs");
const engine=load("src/lib/designer/engine.ts") as typeof import("../src/lib/designer/engine.ts");
const advisor=load("src/lib/designer/advisor.ts") as typeof import("../src/lib/designer/advisor.ts");
const briefEngine=load("src/lib/designer/brief.ts") as typeof import("../src/lib/designer/brief.ts");
const taste=load("src/lib/designer/taste-profile.ts") as typeof import("../src/lib/designer/taste-profile.ts");
const input:DesignerSearchInput={shirts:engine.DESIGNER_SHIRTS,pants:engine.DESIGNER_PANTS,
  currentShirt:engine.DESIGNER_SHIRTS.find((item)=>item.id===engine.DESIGNER_REVIEWED_PAIRING.shirtId)!,currentPant:engine.DESIGNER_PANTS.find((item)=>item.id===engine.DESIGNER_REVIEWED_PAIRING.pantId)!,
  occasion:"Semi-Formal",context:{climate:"Air-conditioned",intention:"Balanced"},chosenStyle:engine.designerStyleForOccasion("Semi-Formal")};
const ask=(brief:string,patch:Partial<DesignerSearchInput>={},judgement?:DesignerJudgement)=>advisor.answerDesignerQuestion({...input,...patch,brief,judgement});

test("major designer tasks produce separate grounded task answers",()=>{
  for(const [question,task] of [["Design a work outfit","design"],["Critique my current outfit","critique"],["Compare pleated vs flat-front trousers","compare"],["Make the shirt relaxed","refine"],["Check fit and movement","fit"],["Explain my collar construction","construction"],["What is this fabric's GSM and drape?","material"],["Prepare the tailor tech pack","production"]]) assert.equal(ask(question).advice.task,task,question);
});
test("legacy brief interpretation retains compound occasions and current context",()=>{
  assert.equal(briefEngine.parseDesignerBrief("A semi-formal event").occasion,"Semi-Formal");
  assert.equal(briefEngine.parseDesignerBrief("A smart casual outfit").occasion,"Smart-Casual");
  const parsed=briefEngine.parseDesignerBrief("Explain this outfit",{occasion:input.occasion,context:input.context,style:input.chosenStyle});
  assert.equal(parsed.occasion,input.occasion);assert.deepEqual(parsed.context,input.context);assert.deepEqual(parsed.style,input.chosenStyle);
});
test("critique checks the actual selected outfit without replacing its fabrics or cut",()=>{
  const answer=ask("Critique my current outfit");
  assert.ok(answer.advice.findings.some((item)=>item.kind==="missing"));
  for(const option of answer.results) {assert.equal(option.shirt.id,input.currentShirt.id);assert.equal(option.pant.id,input.currentPant.id);}
  assert.deepEqual(answer.results[0].style,input.chosenStyle);
});
test("comparison evaluates both requested cuts and keeps blocked construction unapplyable",()=>{
  const answer=ask("Compare pleated trousers vs flat-front trousers");
  assert.equal(answer.results.length,2);assert.notEqual(answer.results[0].style.trouser,answer.results[1].style.trouser);
  const flat=answer.results.find((item)=>/flat-front/i.test(item.style.trouser))!;
  assert.equal(flat.canApply,false);assert.ok(flat.tradeoffs.length>0);
  assert.ok(answer.results[0].reasons.some((item)=>item.includes("recorded option guidance")));
  assert.equal(answer.results[0].styleSpec.styleSchemaVersion,2);
});
test("comparison understands a shared collar noun and retains current cloth",()=>{
  const answer=ask("Compare point vs spread collar");assert.equal(answer.results.length,2);
  assert.ok(answer.results.some((item)=>/point/i.test(item.style.collar)));assert.ok(answer.results.some((item)=>/spread/i.test(item.style.collar)));
  for(const option of answer.results) assert.equal(option.shirt.id,input.currentShirt.id);
});
test("fabric comparison uses available cloth IDs and preserves the companion garment",()=>{
  const answer=ask("Compare charcoal grey vs beige trouser cloth");assert.equal(answer.results.length,2);
  assert.notEqual(answer.results[0].pant.id,answer.results[1].pant.id);
  for(const option of answer.results) {assert.equal(option.shirt.id,input.currentShirt.id);assert.ok(input.pants.some((fabric)=>fabric.id===option.pant.id));}
});
test("missing measurements stay missing and lead to the existing measurement flow",()=>{
  const answer=ask("Check fit and movement");assert.ok(answer.advice.findings.some((item)=>/Add body measurements/.test(item.text)));
  assert.ok(answer.advice.nextSteps.some((item)=>item.route==="/measurements"));assert.deepEqual(answer.results[0].fitTargets,[]);
});
test("recorded measurements produce provisional targets with house-ease caveats",()=>{
  const answer=ask("Check fit and movement",{measurements:{version:1,unit:"cm",shirt:{chest:100,waist:96,neck:39,wrist:18,shirtLength:74},pants:{waist:86,seat:104,thigh:60,frontRise:28},updatedAt:"2026-10-03"}});
  assert.ok(answer.results[0].fitTargets.length>0);assert.ok(answer.advice.findings.some((item)=>/provisional|tailor verification/.test(item.text)));
  const chest=answer.results[0].fitTargets.find((target)=>/chest/i.test(target.label))!;assert.equal(chest.bodyCm,100);assert.ok(chest.finishedCm.min>100);
});
test("material answers never infer missing GSM, fibre or exact physical drape from a photo",()=>{
  const answer=ask("What is the exact GSM, drape and wash care?",{currentShirt:{...input.currentShirt,weightGsm:null,drape:null,fiberContent:null,colorVerified:false,patternScaleVerified:false,fiberContentVerified:false}});
  assert.equal(answer.results.length,0);assert.ok(answer.advice.findings.some((item)=>/GSM: not recorded/.test(item.text)));
  assert.ok(answer.advice.findings.some((item)=>/Exact mechanical drape is not recovered/.test(item.text)));
  assert.ok(answer.advice.findings.some((item)=>/no wash temperature/.test(item.text)));
});
test("production preparation preserves unresolved evidence and does not approve cutting",()=>{
  const answer=ask("Prepare the tailor tech pack");assert.equal(answer.results.length,0);
  assert.match(answer.advice.answer,/locked, verified specification/);assert.ok(answer.advice.nextSteps.some((item)=>item.id==="lock-and-handoff"));
});
test("a cut-only task preserves both cloths, collar and all other construction choices",()=>{
  const answer=ask("Keep both fabrics. Make the shirt relaxed. Keep my collar.");assert.equal(answer.results.length,1);
  const option=answer.results[0];assert.equal(option.shirt.id,input.currentShirt.id);assert.equal(option.pant.id,input.currentPant.id);
  assert.equal(option.style.shirtFit,"Relaxed Fit");assert.deepEqual({...option.style,shirtFit:input.chosenStyle.shirtFit},input.chosenStyle);
});
test("negative construction instructions select a supported alternative",()=>{
  const answer=ask("Make this not slim, no French cuffs",{chosenStyle:{...input.chosenStyle,shirtFit:"Slim Fit",cuff:"French / Double Cuff"}});
  assert.ok(answer.results.length);assert.equal(answer.results[0].style.shirtFit,"Regular / Classic Fit");assert.match(answer.results[0].style.cuff,/barrel/i);
});
test("explicit colour exclusions and wear instructions survive catalogue-tier variations",()=>{
  const answer=ask("Design a business outfit with no blue and a tucked shirt");assert.ok(answer.results.length);
  for(const result of answer.results) {assert.equal(result.style.shirtWear,"Tucked");assert.doesNotMatch(`${result.shirt.name} ${result.shirt.colorFamily} ${result.pant.name} ${result.pant.colorFamily}`,/\bblue\b/i);}
});
test("a judgement revises the judged proposal and later instruction overrides the old brief",()=>{
  const chosenStyle={...input.chosenStyle,shirtFit:"Slim Fit"};
  const answer=ask("Design a slim business outfit",{chosenStyle},{recommendationId:"r1",rating:"down",reason:"fit_cut",note:"Keep both fabrics. Make the shirt relaxed."});
  assert.equal(answer.results[0].style.shirtFit,"Relaxed Fit");assert.equal(answer.results[0].shirt.id,input.currentShirt.id);assert.ok(answer.advice.revision);
});
test("judgement preserves a requested collar while simplifying the other bold details",()=>{
  const chosenStyle={...input.chosenStyle,collar:"Spread Collar",collarFinish:"White contrast collar + cuffs",cuff:"French / Double Cuff"};
  const answer=ask("Critique this outfit",{chosenStyle},{recommendationId:"r2",rating:"down",reason:"too_bold",note:"Keep my collar and both fabrics."});
  assert.equal(answer.results[0].style.collar,"Spread Collar");assert.equal(answer.results[0].style.collarFinish,"Self-fabric");assert.match(answer.results[0].style.cuff,/barrel/i);
});
test("an explicit judgement instruction outranks a generic reason repair",()=>{
  const answer=ask("Compare pleated vs flat-front trousers",{chosenStyle:{...input.chosenStyle,shirtFit:"Slim Fit"}},{recommendationId:"r3",rating:"down",reason:"fit_cut",note:"Keep Slim Fit. Use a spread collar."});
  assert.equal(answer.results[0].style.shirtFit,"Slim Fit");assert.equal(answer.results[0].style.collar,"Spread Collar");assert.equal(answer.results[0].style.trouser,input.chosenStyle.trouser);
});
test("less formal feedback softens construction without reversing the recorded occasion",()=>{
  const answer=ask("Critique my current outfit",{chosenStyle:{...input.chosenStyle,cuff:"French / Double Cuff",collar:"Spread Collar"}},{recommendationId:"r4",rating:"down",reason:"formality",note:"This feels too formal. Make it less formal."});
  assert.equal(answer.interpretation.occasion,input.occasion);assert.match(answer.results[0].style.cuff,/barrel/i);assert.equal(answer.results[0].style.collar,"Point (Standard) Collar");
});
test("unsupported garments and unknown tasks ask for a specific supported task",()=>{
  for(const question of ["Design a sherwani","Make a jacket","Tell me something random"]) {const answer=ask(question);assert.equal(answer.advice.task,"clarify");assert.deepEqual(answer.results,[]);}
});
test("construction and judgement contracts reject invented values",()=>{
  assert.equal(advisor.validDesignerStyle({...input.chosenStyle,collar:"Banana collar"}),false);assert.equal(advisor.validDesignerContext({climate:"Mars",intention:"Balanced"}),false);
  assert.equal(advisor.safeDesignerJudgement({recommendationId:"r",rating:"down",reason:"invented",note:"change it"}),null);
  assert.equal(advisor.safeDesignerJudgement({recommendationId:"r",rating:"down"}),null);
  assert.equal(advisor.safeDesignerJudgement({recommendationId:"r",rating:"down",reason:"formality"}),null);
  assert.equal(advisor.safeDesignerJudgement({recommendationId:"r",rating:"down",reason:"fit_cut",note:"a".repeat(400)})!.note.length,300);
});
test("task planning never mutates the current outfit or measurement input",()=>{
  const before=JSON.stringify(input);ask("Keep both fabrics. Make the shirt relaxed.");assert.equal(JSON.stringify(input),before);
});

function vote(id:string,rating:string,style=input.chosenStyle,occasion="Semi-Formal",extra:Record<string,unknown>={}) {return {type:"designer_feedback",source:"style-director",payload:{recommendationId:id,rating,occasion,style,shirtId:input.currentShirt.id,pantId:input.currentPant.id,...extra}};}
test("same-button repetitions and reasked copies of the same design count once",()=>{
  const events=Array.from({length:20},(_,i)=>vote("request-"+i,"up"));assert.equal(taste.aggregateDesignerTaste(events,"Semi-Formal").evidence,1);
});
test("latest corrected judgement replaces its earlier endorsement",()=>{
  const profile=taste.aggregateDesignerTaste([vote("r1","up"),vote("r1","down",input.chosenStyle,"Semi-Formal",{reason:"too_bold"})]);assert.equal(profile.evidence,1);assert.equal(profile.preferredShirtWear,undefined);
});
test("saved looks, selections and automated image QA cannot train fashion taste",()=>{
  const events=[vote("saved","saved"),{...vote("qa","up"),payload:{...vote("qa","up").payload,creativeVisualCheck:{status:"pass"}}},{type:"designer_recommendation",payload:{input:{source:"one_line_designer_brief"}}},vote("auto","down",input.chosenStyle,"Semi-Formal",{automatic:true,reason:"too_bold"})];assert.equal(taste.aggregateDesignerTaste(events).evidence,0);
});
test("four distinct human reviews can form an occasion-specific preference",()=>{
  const events=engine.DESIGNER_SHIRTS.slice(0,4).map((shirt,i)=>vote("r"+i,"up",input.chosenStyle,"Semi-Formal",{shirtId:shirt.id}));
  const profile=taste.aggregateDesignerTaste(events,"Semi-Formal");assert.equal(profile.evidence,4);assert.equal(profile.preferredShirtWear,"Tucked");assert.equal(profile.preferredTrouser,input.chosenStyle.trouser);
  assert.equal(taste.aggregateDesignerTaste(events,"Casual").evidence,0);
});
test("tied judgements never manufacture a preferred wear choice",()=>{
  const events=engine.DESIGNER_SHIRTS.slice(0,4).map((shirt,i)=>vote("r"+i,"up",{...input.chosenStyle,shirtWear:i<2?"Tucked":"Untucked"},"Semi-Formal",{shirtId:shirt.id}));assert.equal(taste.aggregateDesignerTaste(events).preferredShirtWear,undefined);
});
