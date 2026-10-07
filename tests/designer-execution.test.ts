import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url),{load}=require("../scripts/designer-test-loader.cjs");
const e=load("src/lib/designer/engine.ts"),{answerDesignerQuestion:answer}=load("src/lib/designer/advisor.ts"),{compileDesignerIntent,designGoalPatch}=load("src/lib/designer/design-intent.ts"),{parseDesignerBrief}=load("src/lib/designer/brief.ts"),{aggregateDesignerTaste}=load("src/lib/designer/taste-profile.ts"),{safePersonalTaste,personalizeDesignerBrief}=load("src/lib/designer/personal-taste.ts"),{searchDesignerCatalogue}=load("src/lib/designer/search.ts");
const input={shirts:e.DESIGNER_SHIRTS,pants:e.DESIGNER_PANTS,currentShirt:e.DESIGNER_SHIRTS.find((f:any)=>f.id===e.DESIGNER_REVIEWED_PAIRING.shirtId),currentPant:e.DESIGNER_PANTS.find((f:any)=>f.id===e.DESIGNER_REVIEWED_PAIRING.pantId),chosenStyle:e.designerStyleForOccasion("Semi-Formal"),occasion:"Semi-Formal",context:{climate:"Not specified",intention:"Balanced"}};
const ask=(brief:string,patch:any={})=>answer({...input,...patch,brief});
const vote=(index:number,style:any=input.chosenStyle,patch:any={})=>({type:"designer_feedback",source:"style-director",payload:{recommendationId:"review-"+index,rating:"up",occasion:input.occasion,shirtId:input.shirts[index%input.shirts.length].id,pantId:input.currentPant.id,style,...patch}});

test("role colours are hard constraints on their garment before catalogue ranking",()=>{
  const result=ask("Design two relaxed summer dinner outfits with a blue shirt and beige trousers");assert.equal(result.advice.task,"design");assert.equal(result.results.length,2);
  for(const r of result.results){assert.match(r.shirt.name+" "+r.shirt.colorFamily,/blue/i);assert.match(r.pant.name+" "+r.pant.colorFamily,/beige/i);assert.equal(r.style.shirtFit,"Relaxed Fit");assert.equal(r.style.collar,"Cuban / Camp Collar");}
});
test("negative shirt colour does not forbid that colour in the trousers",()=>{
  const result=ask("Design a casual outfit with no blue shirt and blue trousers");assert.ok(result.results.length);
  for(const r of result.results){assert.doesNotMatch(r.shirt.name+" "+r.shirt.colorFamily,/\bblue\b/i);assert.match(r.pant.name+" "+r.pant.colorFamily,/\bblue\b/i);}
});
test("unavailable required shirt colour never falls back to another colour",()=>{
  const result=ask("Design an outfit with a purple shirt",{shirts:[input.currentShirt]});assert.deepEqual(result.results,[]);assert.match(result.advice.answer,/No current stock/);
});
test("requested garment pattern is not imposed on the companion cloth",()=>{
  const print={...input.currentShirt,id:"pattern-shirt",name:"Printed blue fixture",patternType:"Floral Print",patternScale:"Fine"};
  const solid={...print,id:"solid-shirt",patternType:"Solid"};
  const result=ask("Design a casual outfit with a printed shirt and plain trousers",{shirts:[solid,print]});assert.ok(result.results.length);for(const r of result.results){assert.equal(r.shirt.id,print.id);assert.match(r.pant.patternType,/solid|plain/i);}
});
test("shirt-only design locks the entire trouser and its stock ID",()=>{
  const result=ask("Design a shirt only with clean tailoring");assert.ok(result.results.length);
  for(const r of result.results){assert.equal(r.pant.id,input.currentPant.id);for(const key of ["trouser","rise","waistband","break"])assert.equal(r.style[key],input.chosenStyle[key]);assert.equal(r.style.placket,"French Placket");}
});
test("trouser-only design keeps all shirt choices and the shirt fabric",()=>{
  const result=ask("Design trousers only with modern volume");assert.ok(result.results.length);
  for(const r of result.results){assert.equal(r.shirt.id,input.currentShirt.id);for(const key of ["collar","collarFinish","cuff","placket","shirtFit","shirtWear","button"])assert.equal(r.style[key],input.chosenStyle[key]);assert.equal(r.style.trouser,"Wide-leg / Relaxed Drape Trouser");}
});
test("capsule directions retain separate occasions and valid canonical styles",()=>{
  const result=ask("Create a capsule for office, dinner and weekend");assert.equal(result.advice.task,"capsule");assert.equal(result.results.length,3);
  assert.deepEqual(result.results.map((r:any)=>r.occasion),["Semi-Formal","Smart-Casual","Casual"]);
  for(const r of result.results){assert.equal(r.recommendation.occasion,r.occasion);assert.equal(r.styleSpec.styleSchemaVersion,2);assert.equal(r.canApply,true);}
  assert.equal(new Set(result.results.map((r:any)=>JSON.stringify(r.style))).size,3);
});
test("a missing capsule occasion is explicitly incomplete rather than duplicated",()=>{
  const patterned={...input.currentShirt,patternType:"Floral Print",patternScale:"Fine"};
  const result=ask("Create a capsule for office and a formal event",{shirts:[patterned],currentShirt:patterned});assert.ok(result.results.length<2);assert.ok(result.advice.findings.some((f:any)=>/wardrobe is incomplete/.test(f.text)));
});
test("creative goals resolve existing options and keep explicit construction primary",()=>{
  for(const goal of ["relaxed summer dinner","clean tailoring","modern volume","quiet texture","one contrast detail"]){const result=ask("Design an outfit with "+goal+" and a mandarin collar");assert.ok(result.results.length,goal);for(const r of result.results){assert.equal(r.style.collar,"Mandarin / Band Collar");assert.ok(r.reasons.length);for(const [key,value]of Object.entries(r.style))assert.ok(e.DESIGNER_STYLE_CHOICES[key].includes(value));}}
});
test("cropped design fills the matching hem without overriding a requested incompatible break",()=>{
  const result=ask("Design a cropped trouser");assert.ok(result.results.length);for(const r of result.results){assert.equal(r.style.trouser,"Cropped / Ankle-length Trouser");assert.equal(r.style.break,"Cropped / Above-ankle");}
  const conflict=ask("Design a cropped trouser with a full break");assert.deepEqual(conflict.results,[]);assert.ok(conflict.advice.findings.some((f:any)=>/hem|length/i.test(f.text)));
});
test("explicit incompatible collar/cuff constraints are never ranked as valid directions",()=>{
  const result=ask("Design a formal look with a camp collar and French cuffs");assert.deepEqual(result.results,[]);assert.ok(result.advice.findings.some((f:any)=>/French cuff|collar/i.test(f.text)));
});
test("GSM constraints require recorded values and never infer a value from Lea",()=>{
  const missing=ask("Design an outfit with a linen shirt under 180 gsm");assert.deepEqual(missing.results,[]);assert.ok(missing.advice.findings.some((f:any)=>/matching recorded GSM/.test(f.text)));
  const light={...input.currentShirt,id:"light-shirt",weightGsm:150},heavy={...light,id:"heavy-shirt",weightGsm:210};
  const result=ask("Design an outfit with a linen shirt under 180 gsm",{shirts:[heavy,light],currentShirt:light});assert.ok(result.results.length);for(const r of result.results)assert.equal(r.shirt.id,light.id);
});
test("Lea requests match catalogue yarn-count labels without inventing composition",()=>{
  const result=ask("Design an outfit with a 40 lea linen shirt");assert.deepEqual(result.results,[]);
  assert.equal(compileDesignerIntent("Design a 75 lea linen shirt").roles.shirt.lea,75);
});
test("direction counts stay bounded and oversized requests disclose the limit",()=>{
  assert.equal(compileDesignerIntent("Show one clean tailoring outfit").directionCount,1);assert.equal(compileDesignerIntent("Show two relaxed summer dinner outfits").directionCount,2);
  const result=ask("Design five outfit directions");assert.ok(result.results.length<=3);assert.match(result.advice.designPlan.notes.join(" "),/three reviewed directions/);
});
test("unmapped reference collars and exact image-copy requests need clarification",()=>{
  for(const brief of ["Design a sailor collar shirt","Design an outfit identical to the image"]){const result=ask(brief);assert.equal(result.advice.task,"clarify");assert.deepEqual(result.results,[]);}
});
test("researched British collar is now a supported construction",()=>{
  const result=ask("Design a British collar shirt");assert.ok(result.results.length);
  for(const direction of result.results) assert.equal(direction.style.collar,"English Spread / British Collar");
});
test("proposal cards disclose which construction choices are still photographic approximations",()=>{
  const result=ask("Keep both fabrics. Use mandarin collar and horn buttons");assert.ok(result.results.length);assert.ok(result.results[0].previewNotes.some((s:string)=>/Mandarin.*point-collar/.test(s)));assert.ok(result.results[0].previewNotes.some((s:string)=>/Horn.*specification-only/.test(s)));
});
test("four distinct approved looks learn construction at an independently supported threshold",()=>{
  const style={...input.chosenStyle,collar:"Spread Collar",shirtFit:"Relaxed Fit",button:"Horn"};const profile=aggregateDesignerTaste([0,1,2,3].map(i=>vote(i,style)),input.occasion);
  assert.equal(profile.preferredConstruction.collar,"Spread Collar");assert.equal(profile.preferredConstruction.shirtFit,"Relaxed Fit");assert.equal(profile.preferredConstruction.button,"Horn");assert.equal(profile.signals.find((s:any)=>s.key==="button").support,4);
});
test("unrelated colour rejections never teach a different cut or suppress a liked collar",()=>{
  const style={...input.chosenStyle,collar:"Spread Collar"};const events=[0,1,2,3].map(i=>vote(i,style));events.push(vote(4,style,{rating:"down",reason:"color",note:"Try beige"}));
  const profile=aggregateDesignerTaste(events,input.occasion);assert.equal(profile.preferredConstruction.collar,"Spread Collar");assert.equal(profile.signals.find((s:any)=>s.key==="collar").opposition,0);
});
test("unrelated negative reviews cannot pad a garment-choice or energy threshold",()=>{
  const profile=aggregateDesignerTaste([vote(0),vote(1),vote(2,input.chosenStyle,{rating:"down",reason:"too_bold"}),vote(3,input.chosenStyle,{rating:"down",reason:"too_bold"})],input.occasion);
  assert.equal(profile.evidence,4);assert.equal(profile.preferredShirtWear,undefined);assert.equal(profile.preferredTrouser,undefined);assert.equal(profile.preferredTier,undefined);
});
test("targeted fit rejections can remove an old fit preference without rejecting the collar",()=>{
  const style={...input.chosenStyle,shirtFit:"Slim Fit",collar:"Spread Collar"};const events=[0,1,2,3].map(i=>vote(i,style));for(const i of [4,5,6])events.push(vote(i,style,{rating:"down",reason:"fit_cut"}));
  const profile=aggregateDesignerTaste(events,input.occasion);assert.equal(profile.preferredConstruction.shirtFit,undefined);assert.equal(profile.preferredConstruction.collar,"Spread Collar");
});
test("ties, repeated recipes and other occasions cannot manufacture a construction preference",()=>{
  const repeated=Array.from({length:12},(_,i)=>vote(i%1));assert.equal(aggregateDesignerTaste(repeated,input.occasion).evidence,1);
  const events=[0,1,2,3].map(i=>vote(i,{...input.chosenStyle,collar:i<2?"Spread Collar":"Mandarin / Band Collar"}));assert.equal(aggregateDesignerTaste(events,input.occasion).preferredConstruction.collar,undefined);assert.equal(aggregateDesignerTaste(events,"Casual").evidence,0);
});
test("the latest correction wins even when the same recipe was reasked under another ID",()=>{
  const first=vote(0),copy=vote(0,input.chosenStyle,{recommendationId:"reasked",rating:"down",reason:"too_bold"}),correction=vote(0);
  const profile=aggregateDesignerTaste([first,copy,correction,vote(1),vote(2),vote(3)],input.occasion);
  assert.equal(profile.evidence,4);assert.equal(profile.preferredShirtWear,"Tucked");assert.equal(profile.signals.find((s:any)=>s.key==="shirtWear").support,4);
});
test("personal learning is secondary to explicit details, exclusions, mood and garment locks",()=>{
  const taste={version:1,evidence:4,preferredTier:"Statement",preferredConstruction:{collar:"Spread Collar",shirtFit:"Slim Fit",trouser:"Wide-leg / Relaxed Drape Trouser",button:"Horn"}};
  const parsed=personalizeDesignerBrief(parseDesignerBrief("Design a shirt only with quiet texture, not slim and use mother-of-pearl buttons",{occasion:input.occasion,context:input.context,style:input.chosenStyle}),taste);
  assert.equal(parsed.style.collar,"Point (Standard) Collar");assert.equal(parsed.style.shirtFit,"Regular / Classic Fit");assert.equal(parsed.style.trouser,input.chosenStyle.trouser);assert.equal(parsed.style.button,"Mother-of-Pearl");assert.equal(parsed.preference.preferredTier,"Safe");
});
test("learned choices survive tier generation and are evaluated against hard constraints",()=>{
  const parsed=personalizeDesignerBrief(parseDesignerBrief("Design a business outfit",{occasion:input.occasion,context:input.context,style:input.chosenStyle}),{version:1,evidence:4,preferredConstruction:{collar:"Mandarin / Band Collar",shirtFit:"Relaxed Fit",button:"Horn"}});
  const result=ask("Design a business outfit",{parsed});assert.ok(result.results.length);for(const r of result.results){assert.equal(r.style.collar,"Mandarin / Band Collar");assert.equal(r.style.shirtFit,"Relaxed Fit");assert.equal(r.style.button,"Horn");}
});
test("invalid personal profiles cannot inject unsupported choices or physical data",()=>{
  assert.equal(safePersonalTaste({version:2,evidence:99}),null);assert.deepEqual(safePersonalTaste({version:1,evidence:3,preferredConstruction:{button:"Horn"}}),{version:1,evidence:3});
  const safe=safePersonalTaste({version:1,evidence:4,preferredConstruction:{collar:"Invented",shirtFit:"Relaxed Fit",weightGsm:140},gsmVerified:true});assert.deepEqual(safe.preferredConstruction,{shirtFit:"Relaxed Fit"});assert.equal(safe.gsmVerified,undefined);
});
test("execution leaves the caller outfit, taste and stock records unchanged",()=>{
  const before=JSON.stringify(input),profile={version:1,evidence:4,preferredConstruction:{button:"Horn"}},original=JSON.stringify(profile);ask("Create a capsule for office, dinner and weekend");personalizeDesignerBrief(parseDesignerBrief("Design an outfit"),profile);assert.equal(JSON.stringify(input),before);assert.equal(JSON.stringify(profile),original);
});
test("a cloth-only judgement retains the judged construction across all proposal tiers",()=>{
  const style={...input.chosenStyle,collar:"Mandarin / Band Collar",shirtFit:"Relaxed Fit",trouser:"Wide-leg / Relaxed Drape Trouser",break:"No Break",button:"Horn"};
  const result=ask("Design a summer dinner outfit",{chosenStyle:style,judgement:{recommendationId:"judged",rating:"down",reason:"color",note:"Keep the trouser fabric. Change the shirt fabric to blue."}});assert.ok(result.results.length);
  for(const r of result.results){assert.deepEqual(r.style,style);assert.equal(r.pant.id,input.currentPant.id);assert.match(r.shirt.name+" "+r.shirt.colorFamily,/blue/i);}
});
