import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url),{load}=require("../scripts/designer-test-loader.cjs");
const e=load("src/lib/designer/engine.ts");
const {designerDirectionBasis,designerQuestionBasis,designerQuestionPreferenceOccasion}=load("src/lib/designer/question-basis.ts");
const {answerDesignerQuestion}=load("src/lib/designer/advisor.ts");
const {aggregateDesignerTaste}=load("src/lib/designer/taste-profile.ts");
const {parseDesignerBrief}=load("src/lib/designer/brief.ts");
const {safePersonalTaste,personalizeDesignerBrief}=load("src/lib/designer/personal-taste.ts");
const shirt=e.DESIGNER_SHIRTS.find((f:any)=>f.id===e.DESIGNER_REVIEWED_PAIRING.shirtId),pant=e.DESIGNER_PANTS.find((f:any)=>f.id===e.DESIGNER_REVIEWED_PAIRING.pantId);
const current={currentShirtId:shirt.id,currentPantId:pant.id,currentStyle:e.designerStyleForOccasion("Semi-Formal"),occasion:"Semi-Formal",context:{climate:"Air-conditioned",intention:"Balanced"}};
const option={shirt:e.DESIGNER_SHIRTS[1],pant:e.DESIGNER_PANTS[1],style:{...e.designerStyleForOccasion("Casual"),button:"Horn"},occasion:"Casual",context:{climate:"Hot / humid",intention:"Understated"}};
const ask=(brief:string,basis:any)=>answerDesignerQuestion({shirts:e.DESIGNER_SHIRTS,pants:e.DESIGNER_PANTS,currentShirt:e.DESIGNER_SHIRTS.find((f:any)=>f.id===basis.currentShirtId),currentPant:e.DESIGNER_PANTS.find((f:any)=>f.id===basis.currentPantId),chosenStyle:basis.currentStyle,occasion:basis.occasion,context:basis.context,brief});

test("ordinary questions use the applied outfit rather than an arbitrary proposal",()=>{
  assert.deepEqual(designerQuestionBasis(current),current);
});
test("a capsule direction carries its own construction, cloth and occasion into follow-up questions",()=>{
  const basis=designerDirectionBasis(option,current);
  assert.equal(basis.currentShirtId,option.shirt.id);assert.equal(basis.currentPantId,option.pant.id);
  assert.deepEqual(basis.currentStyle,option.style);assert.equal(basis.occasion,"Casual");assert.deepEqual(basis.context,option.context);
  assert.deepEqual(designerQuestionBasis(current,basis),basis);
});
test("legacy advice options without context remain readable using the answer context",()=>{
  const {occasion,context,...legacy}=option;
  const basis=designerDirectionBasis(legacy,current);
  assert.equal(basis.occasion,current.occasion);assert.deepEqual(basis.context,current.context);
});
test("a judgement always revises the judged proposal rather than the conversation starting point",()=>{
  const working=designerDirectionBasis(option,current),judged={...working,currentStyle:{...working.currentStyle,shirtFit:"Relaxed Fit"},occasion:"Smart-Casual"};
  assert.deepEqual(designerQuestionBasis(current,working,judged),judged);
  assert.equal(working.currentStyle.shirtFit,option.style.shirtFit);
});
test("question snapshots cannot mutate either the source proposal or the applied outfit",()=>{
  const basis=designerDirectionBasis(option,current),read=designerQuestionBasis(current,basis);
  read.currentStyle.button="Plastic / Resin";read.context.climate="Cool";
  assert.equal(basis.currentStyle.button,"Horn");assert.equal(option.style.button,"Horn");assert.equal(basis.context.climate,"Hot / humid");
  const applied=designerQuestionBasis(current);applied.currentStyle.collar="Mandarin / Band Collar";
  assert.notEqual(current.currentStyle.collar,applied.currentStyle.collar);
});
test("a non-judgement follow-up preserves the proposed outfit while changing the requested detail",()=>{
  const basis={...current,currentStyle:{...current.currentStyle,collar:"Mandarin / Band Collar",placket:"Hidden / Fly-front",shirtFit:"Relaxed Fit"}};
  const answer=ask("Keep both fabrics. Use horn buttons.",designerQuestionBasis(current,basis));
  assert.equal(answer.advice.task,"refine");assert.equal(answer.advice.revision,null);assert.equal(answer.results.length,1);
  const result=answer.results[0];assert.equal(result.shirt.id,basis.currentShirtId);assert.equal(result.pant.id,basis.currentPantId);
  for(const key of Object.keys(basis.currentStyle))assert.equal(result.style[key],key==="button"?"Horn":basis.currentStyle[key]);
});
test("comparison questions evaluate the working proposal and leave other construction intact",()=>{
  const basis={...current,currentStyle:{...current.currentStyle,placket:"Hidden / Fly-front",shirtFit:"Relaxed Fit"}};
  const answer=ask("Compare point collar vs spread collar",basis);assert.equal(answer.results.length,2);
  for(const result of answer.results){assert.equal(result.shirt.id,basis.currentShirtId);assert.equal(result.pant.id,basis.currentPantId);assert.equal(result.style.placket,"Hidden / Fly-front");assert.equal(result.style.shirtFit,"Relaxed Fit");}
});
test("garment-only tasks preserve the complete companion from the working proposal",()=>{
  const basis={...current,currentStyle:{...current.currentStyle,waistband:"Side-Adjuster Tabs",button:"Horn"}};
  const answer=ask("Design a shirt only with clean tailoring",basis);assert.ok(answer.results.length);
  for(const result of answer.results){assert.equal(result.pant.id,basis.currentPantId);for(const key of ["trouser","rise","waistband","break"])assert.equal(result.style[key],basis.currentStyle[key]);}
});
test("a new explicit occasion gets that occasion's preferences rather than the starting point's",()=>{
  const working=designerDirectionBasis(option,current);
  assert.equal(designerQuestionPreferenceOccasion("Design a business outfit",working),"Semi-Formal");
  assert.equal(designerQuestionPreferenceOccasion("Design a dinner outfit",working),"Smart-Casual");
  assert.equal(designerQuestionPreferenceOccasion("Design a formal look",working),"Formal");
});
test("detail-only follow-ups retain the working occasion for personal preferences",()=>{
  const working=designerDirectionBasis(option,current);
  assert.equal(designerQuestionPreferenceOccasion("Keep both fabrics. Use horn buttons.",working),"Casual");
  assert.equal(designerQuestionPreferenceOccasion("",working),"Casual");
});
test("a complete learned business construction cannot remove the other capsule occasions",()=>{
  const brief="Create a capsule for office, dinner and weekend";
  const events=e.DESIGNER_SHIRTS.slice(0,4).map((fabric:any,i:number)=>({type:"designer_feedback",source:"style-director",payload:{recommendationId:"capsule-taste-"+i,rating:"up",shirtId:fabric.id,pantId:pant.id,occasion:"Semi-Formal",style:{...current.currentStyle,button:"Horn"}}}));
  const parsed=personalizeDesignerBrief(parseDesignerBrief(brief,{style:current.currentStyle,occasion:current.occasion,context:current.context}),safePersonalTaste(aggregateDesignerTaste(events,"Semi-Formal")));
  const learned=answerDesignerQuestion({shirts:e.DESIGNER_SHIRTS,pants:e.DESIGNER_PANTS,currentShirt:shirt,currentPant:pant,chosenStyle:current.currentStyle,occasion:current.occasion,context:current.context,brief,parsed});
  const ordinary=ask(brief,current);
  assert.deepEqual(learned.results.map((r:any)=>r.occasion),["Semi-Formal","Smart-Casual","Casual"]);
  assert.equal(learned.results[0].style.button,"Horn");
  for(const result of learned.results.slice(1))assert.deepEqual(result.style,ordinary.results.find((r:any)=>r.occasion===result.occasion).style);
  assert.ok(learned.results.every((r:any)=>r.canApply));
});
test("capsule occasion defaults preserve explicit construction and customer cut locks",()=>{
  const brief="Create a capsule for office, dinner and weekend with horn buttons. Keep my shirt fit.";
  const parsed=personalizeDesignerBrief(parseDesignerBrief(brief,{style:current.currentStyle,occasion:current.occasion,context:current.context}),safePersonalTaste({version:1,evidence:4,preferredConstruction:{button:"Mother-of-Pearl",shirtFit:"Relaxed Fit"}}));
  const answer=answerDesignerQuestion({shirts:e.DESIGNER_SHIRTS,pants:e.DESIGNER_PANTS,currentShirt:shirt,currentPant:pant,chosenStyle:current.currentStyle,occasion:current.occasion,context:current.context,brief,parsed});
  assert.deepEqual(answer.results.map((r:any)=>r.occasion),["Semi-Formal","Smart-Casual","Casual"]);
  for(const result of answer.results){assert.equal(result.style.button,"Horn");assert.equal(result.style.shirtFit,current.currentStyle.shirtFit);}
});
test("capsule defaults cannot relax an explicitly incompatible construction",()=>{
  const answer=ask("Create a capsule for office, dinner and weekend with camp collar and French cuffs",current);
  assert.deepEqual(answer.results,[]);
  assert.ok(answer.advice.findings.some((f:any)=>/French cuff/.test(f.text)));
});
