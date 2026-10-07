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
const construction=load("src/lib/designer/construction-intent.ts") as typeof import("../src/lib/designer/construction-intent.ts");
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
test("British collar resolves to the researched English Spread construction",()=>{
  const answer=ask("Keep both fabrics. Use a British collar.");
  assert.equal(answer.advice.task,"refine");assert.equal(answer.results.length,1);
  assert.equal(answer.results[0].style.collar,"English Spread / British Collar");
  assert.equal(answer.results[0].shirt.id,input.currentShirt.id);assert.equal(answer.results[0].pant.id,input.currentPant.id);
});
test("unmapped collars offer supported, grounded comparison questions",()=>{
  const before=JSON.stringify(input),answer=ask("Design a sailor collar shirt");
  assert.equal(answer.advice.task,"clarify");assert.deepEqual(answer.results,[]);
  assert.equal(answer.advice.clarification?.choices.length,2);
  for(const choice of answer.advice.clarification!.choices) {
    const follow=ask(choice.brief);assert.equal(follow.advice.task,"compare");assert.equal(follow.results.length,2);
    for(const result of follow.results) {assert.equal(result.shirt.id,input.currentShirt.id);assert.equal(result.pant.id,input.currentPant.id);assert.ok(engine.DESIGNER_STYLE_CHOICES.collar.includes(result.style.collar));}
  }
  assert.equal(JSON.stringify(input),before);
});
test("conflicting construction offers an explicit comparison without choosing a winner",()=>{
  const answer=ask("Use point collar and spread collar");
  assert.deepEqual(answer.results,[]);assert.equal(answer.advice.clarification?.choices[0].id,"compare-conflict");
  const follow=ask(answer.advice.clarification!.choices[0].brief);
  assert.equal(follow.advice.task,"compare");assert.deepEqual(follow.results.map(result=>result.style.collar),["Point (Standard) Collar","Spread Collar"]);
  assert.equal(follow.advice.revision,null);
});
test("unsupported garments only offer explicit supported garment tasks",()=>{
  const answer=ask("Design a sherwani for me");assert.deepEqual(answer.results,[]);
  assert.deepEqual(answer.advice.clarification?.choices.map(choice=>choice.id),["shirt-task","trouser-task"]);
  const shirt=ask(answer.advice.clarification!.choices[0].brief);assert.ok(shirt.results.length);
  for(const option of shirt.results) {assert.equal(option.pant.id,input.currentPant.id);for(const key of ["trouser","rise","waistband","break"] as const)assert.equal(option.style[key],input.chosenStyle[key]);}
});
test("reference-copy and unknown questions keep clarification bounded and optional",()=>{
  for(const brief of ["Make an exact copy of this photo","Help me understand"]){
    const answer=ask(brief);assert.equal(answer.advice.task,"clarify");assert.deepEqual(answer.results,[]);
    assert.ok(answer.advice.clarification!.choices.length<=3);
    for(const choice of answer.advice.clarification!.choices){assert.ok(choice.brief.length>=5&&choice.brief.length<=500);assert.notEqual(ask(choice.brief).advice.task,"clarify");}
  }
  assert.equal(ask("Critique my current outfit").advice.clarification,undefined);
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

test("compound comfort and fabric requirements do not replace the primary design task",()=>{
  const answer=ask("Design a comfortable summer wedding outfit with a mandarin collar and horn buttons");
  assert.equal(answer.advice.task,"design");assert.ok(answer.results.length);
  assert.equal(answer.interpretation.context.climate,"Hot / humid");
  for(const result of answer.results) {assert.equal(result.style.collar,"Mandarin / Band Collar");assert.equal(result.style.button,"Horn");}
  assert.equal(ask("What is this fabric's drape for a wedding?").advice.task,"material");
  assert.equal(ask("Recommend a collar for this shirt").advice.task,"construction");
});
test("all current construction labels can be requested without invented vocabulary",()=>{
  for(const [key,values] of Object.entries(engine.DESIGNER_STYLE_CHOICES)) for(const value of values) {
    const intent=construction.parseDesignerConstructionIntent("Use "+value);
    assert.equal(intent.patch[key as keyof typeof intent.patch],value,key+": "+value);
    assert.deepEqual(intent.issues,[],value);
  }
});
test("natural construction aliases resolve shared options and preserve other details",()=>{
  const answer=ask("Keep both fabrics. Make the collar mandarin, hide the placket and use horn buttons.");
  assert.equal(answer.advice.task,"refine");assert.equal(answer.results.length,1);
  const result=answer.results[0];assert.equal(result.style.collar,"Mandarin / Band Collar");assert.equal(result.style.placket,"Hidden / Fly-front");assert.equal(result.style.button,"Horn");
  assert.deepEqual({...result.style,collar:input.chosenStyle.collar,placket:input.chosenStyle.placket,button:input.chosenStyle.button},input.chosenStyle);
  assert.equal(result.shirt.id,input.currentShirt.id);assert.equal(result.pant.id,input.currentPant.id);
  assert.ok(result.reasons.some((reason)=>reason.startsWith("Horn:")));assert.ok(result.reasons.some((reason)=>reason.startsWith("Hidden / Fly-front:")));
});
test("specific option names win over contained generic aliases",()=>{
  const intent=construction.parseDesignerConstructionIntent("Use a soft button-down collar and extra-high rise with two-button barrel cuffs");
  assert.equal(intent.patch.collar,"Soft Button-Down Collar");assert.equal(intent.patch.rise,"Extra-High Rise");assert.equal(intent.patch.cuff,"Barrel Cuff (2-button)");assert.deepEqual(intent.issues,[]);
});
test("comparison answers the named collars rather than substituting defaults",()=>{
  const answer=ask("Compare mandarin vs camp collar");assert.equal(answer.results.length,2);
  assert.deepEqual(answer.results.map((result)=>result.style.collar),["Mandarin / Band Collar","Cuban / Camp Collar"]);
  for(const result of answer.results) {assert.equal(result.shirt.id,input.currentShirt.id);assert.equal(result.pant.id,input.currentPant.id);}
});
test("an unknown comparison choice is never replaced by a different supported option",()=>{
  for(const question of ["Compare square vs spread collar","Compare slim vs pleated trousers"]) {
    const answer=ask(question);assert.deepEqual(answer.results,[]);assert.match(answer.advice.answer,/Name two/);
  }
});
test("trouser fit requests cannot silently alter the shirt fit",()=>{
  for(const question of ["Make the trousers slim. Keep the shirt fit.","Use slim trousers with a regular shirt"]) {
    const answer=ask(question);assert.equal(answer.advice.task,"clarify");assert.deepEqual(answer.results,[]);assert.match(answer.advice.answer,/shirt fit is preserved/);
  }
  const intent=construction.parseDesignerConstructionIntent("Use relaxed trousers with a slim shirt");
  assert.equal(intent.patch.trouser,"Wide-leg / Relaxed Drape Trouser");assert.equal(intent.patch.shirtFit,"Slim Fit");
});
test("negated bold energy and pattern lists remain exclusions",()=>{
  const answer=ask("Design a resort outfit, not bold and no prints or checks");
  assert.equal(answer.interpretation.context.intention,"Understated");assert.ok(answer.results.length);
  for(const result of answer.results) for(const fabric of [result.shirt,result.pant]) assert.doesNotMatch(fabric.patternType,/print|check/i);
  const parsed=briefEngine.parseDesignerBrief("Design an outfit without stripes, prints and checks but with plain cloth");
  assert.equal(parsed.preference.preferredPattern,"plain");assert.deepEqual([...parsed.preference.excludedPatterns!].sort(),["check","print","stripe"]);
});
test("excluded cloth is filtered before ranking even when every high-scoring pair contains it",()=>{
  const plain={...input.currentShirt,id:"plain-fixture",name:"Plain test",patternType:"Solid" as const};
  const print={...input.currentShirt,id:"print-fixture",name:"Printed test",patternType:"Floral Print" as const};
  const answer=ask("Design a casual resort outfit with no prints",{shirts:[print,plain],currentShirt:print});
  assert.ok(answer.results.length);for(const result of answer.results) assert.equal(result.shirt.id,plain.id);
});
test("an excluded retained cloth produces no proposal instead of breaking the constraint",()=>{
  const currentShirt={...input.currentShirt,patternType:"Floral Print" as const};
  const answer=ask("Keep both fabrics. Design a casual outfit with no prints",{currentShirt,shirts:[currentShirt]});
  assert.deepEqual(answer.results,[]);assert.match(answer.advice.answer,/No current stock/);
});
test("construction negation is scoped independently from fabric colour exclusions",()=>{
  const intent=construction.parseDesignerConstructionIntent("Design a business outfit with no blue and a tucked shirt");
  assert.equal(intent.patch.shirtWear,"Tucked");assert.deepEqual(intent.excluded,{});
  const answer=ask("No slim fit or French cuffs. Use a camp collar.",{chosenStyle:{...input.chosenStyle,shirtFit:"Slim Fit",cuff:"French / Double Cuff"}});
  assert.equal(answer.results[0].style.shirtFit,"Regular / Classic Fit");assert.equal(answer.results[0].style.cuff,"Barrel Cuff (1-button)");assert.equal(answer.results[0].style.collar,"Cuban / Camp Collar");
});
test("contradictory construction asks for a choice without applying either option",()=>{
  for(const question of ["Use point collar and spread collar","Make a slim fit, but no slim fit"]) {
    const answer=ask(question);assert.equal(answer.advice.task,"clarify");assert.deepEqual(answer.results,[]);assert.match(answer.advice.answer,/Choose one/);
  }
  assert.deepEqual(construction.parseDesignerConstructionIntent("Use point collar then switch to mandarin collar").issues,[]);
});
test("white contrast details and vegetable ivory buttons do not replace body cloth",()=>{
  const answer=ask("Use white contrast collar and cuffs");assert.equal(answer.results.length,1);
  assert.equal(answer.results[0].style.collarFinish,"White contrast collar + cuffs");
  assert.equal(answer.results[0].shirt.id,input.currentShirt.id);assert.equal(answer.results[0].pant.id,input.currentPant.id);
  assert.deepEqual(briefEngine.parseDesignerBrief("Use corozo (vegetable ivory) buttons").preference.wantedTokens,[]);
});
test("words embedded in photograph or different do not invent hot weather or expressive intent",()=>{
  const parsed=briefEngine.parseDesignerBrief("Review the photograph",{occasion:input.occasion,context:input.context,style:input.chosenStyle});
  assert.equal(parsed.context.climate,input.context.climate);assert.equal(parsed.context.intention,input.context.intention);
});
