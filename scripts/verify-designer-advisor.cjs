// Real Designer UI and Canvas; deterministic engine fixtures and delayed API
// responses. No provider calls and no physical-fabric/device acceptance.
const assert=require("node:assert/strict"), fs=require("node:fs"), path=require("node:path"), Module=require("node:module");
const {load}=require("./designer-test-loader.cjs");
const engine=load("src/lib/designer/engine.ts"), {answerDesignerQuestion}=load("src/lib/designer/advisor.ts"), {aggregateDesignerTaste}=load("src/lib/designer/taste-profile.ts");
const {parseDesignerBrief,explicitDesignerStylePatch}=load("src/lib/designer/brief.ts"),{designerTaskFor}=load("src/lib/designer/advisor.ts"),{safePersonalTaste,personalizeDesignerBrief}=load("src/lib/designer/personal-taste.ts");
const {fromLegacyStyle,toLegacyStyle}=load("src/lib/designer/style-spec-v2.ts");
const {designerDirectionBasis}=load("src/lib/designer/question-basis.ts");
const {assessFitConstruction}=load("src/lib/designer/fit-construction.ts"), {assessBlockStrategy}=load("src/lib/designer/block-strategy.ts"), {evaluateLinenEarthBrandLanguage}=load("src/lib/designer/brand-language.ts");
const {buildDesignerNegotiation}=load("src/lib/designer/constraint-negotiation.ts"), {buildCanonicalGarmentSpec}=load("src/lib/designer/garment-spec.ts");
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;if(!runtime)throw Error("Set LINEN_BROWSER_QA_RUNTIME");
const {chromium}=Module.createRequire(path.join(runtime,"package.json"))("playwright");
const output=path.resolve("artifacts/preview-lifecycle/designer-advisor"), baseURL=process.env.LINEN_BROWSER_QA_URL || "http://127.0.0.1:3000";
const summary={browser:"Chromium",backendResponses:"UI responses mocked using the real rules; actual HTTP contracts checked on the isolated CI server; no paid calls",physicalOrDeviceAcceptance:false,apiContracts:[],viewports:[],regressions:[],errors:[]};
let browser,activePage;
const panel=page=>page.locator(".newDesignerAdvisor");
const question=page=>page.getByRole("textbox",{name:"Designer question or task",exact:true});
const askButton=page=>panel(page).getByRole("button",{name:"Ask Designer",exact:true});
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,30)))));
async function freshPage(width=1440){
  const context=await browser.newContext({viewport:{width,height:1000}}), page=await context.newPage();
  activePage=page;
  page.on("pageerror",error=>summary.errors.push(error.message));page.on("console",message=>{if(message.type()==="error")summary.errors.push(message.text());});
  await context.route("**/api/**",route=>{
    const p=new URL(route.request().url()).pathname;
    if(/look-render|look-inspect|creative-render|creative-inspect|\/designer\/brief|\/designer\/assess/.test(p))summary.errors.push("Backend escaped mock: "+p);
    return route.fulfill({status:200,json:p.includes("photo-calibration")?{verified:false}:{}});
  });
  await page.addInitScript(()=>{
    const originalFetch=window.fetch.bind(window);window.__linenAdvisorQA={requests:[]};
    window.fetch=(input,options={})=>{
      const p=new URL(typeof input==="string"?input:input.url,location.href).pathname;
      const kind=p==="/api/designer/brief"?"question":p==="/api/designer/assess"?"assessment":null;
      if(!kind)return originalFetch(input,options);
      return new Promise(resolve=>window.__linenAdvisorQA.requests.push({kind,body:JSON.parse(options.body || "{}"),signal:options.signal,completed:false,
        complete(value,status=200){this.completed=true;resolve(new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json"}}));}}));
    };
  });
  await page.goto(baseURL+"/designer-studio",{waitUntil:"networkidle"});await page.locator(".brandIntro").waitFor({state:"hidden"});await panel(page).waitFor({state:"visible"});
  await page.waitForFunction(()=>[...document.querySelectorAll(".newDesignerPhoto button")].some(b=>b.textContent==="Lock final design"&&!b.disabled));
  return {page,context};
}
const count=(page,kind)=>page.evaluate(kind=>window.__linenAdvisorQA.requests.filter(r=>r.kind===kind).length,kind);
const request=(page,kind,index)=>page.evaluate(({kind,index})=>{const r=window.__linenAdvisorQA.requests.filter(r=>r.kind===kind)[index];return {body:r.body,aborted:r.signal?.aborted || false};},{kind,index});
async function complete(page,kind,index,value,status=200){await page.evaluate(({kind,index,value,status})=>{const r=window.__linenAdvisorQA.requests.filter(r=>r.kind===kind)[index];if(!r||r.completed)throw Error("Missing/duplicate mock response");r.complete(value,status);},{kind,index,value,status});await settle(page);}
const memory=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("linen-earth:style-memory:v1")||"[]"));
const mainPixels=page=>page.locator(".newDesignerPhoto canvas").evaluate(canvas=>canvas.toDataURL("image/png"));
function questionFixture(body,index){
  const shirts=engine.DESIGNER_SHIRTS,pants=engine.DESIGNER_PANTS;
  const task=designerTaskFor(body.brief+(body.judgement?.note || ""),body.judgement),read=parseDesignerBrief(body.judgement?body.judgement.note || "Revise this direction":body.brief,{style:body.currentStyle,occasion:body.occasion,context:body.context});
  if(["design","capsule"].includes(task) && !/\b(?:keep|preserve|same|unchanged)\b/i.test(body.brief))read.style={...engine.designerStyleForOccasion(read.occasion),...explicitDesignerStylePatch(body.brief)};
  const parsed=["design","capsule"].includes(task)?personalizeDesignerBrief(read,safePersonalTaste(body.tasteProfile)):read;
  return {...answerDesignerQuestion({shirts,pants,currentShirt:shirts.find(f=>f.id===body.currentShirtId),currentPant:pants.find(f=>f.id===body.currentPantId),chosenStyle:body.currentStyle,occasion:body.occasion,context:body.context,brief:body.brief,judgement:body.judgement,measurements:body.measurements,observations:body.observations,parsed}),requestId:"LE-QA-"+index};
}
async function answer(page,index){const {body}=await request(page,"question",index),fixture=questionFixture(body,index);await complete(page,"question",index,fixture);return fixture;}
function assessmentFixture(body){
  const shirt=engine.DESIGNER_SHIRTS.find(f=>f.id===body.shirtId),pant=engine.DESIGNER_PANTS.find(f=>f.id===body.pantId),style=toLegacyStyle(body.styleSpec);
  const recommendation=engine.evaluateDesignerCombo(shirt,pant,body.occasion,style,undefined,body.context),fitConstruction=assessFitConstruction(body.measurements,style,{climate:body.context.climate,shirtFabric:shirt,trouserFabric:pant,observations:body.observations});
  const blockStrategy=assessBlockStrategy(body.measurements,style,body.observations),brandLanguage=evaluateLinenEarthBrandLanguage(shirt,pant,style,body.occasion,body.context);
  return {assessment:{recommendation,fitConstruction,blockStrategy,brandLanguage,negotiation:buildDesignerNegotiation(recommendation,fitConstruction),garmentSpec:buildCanonicalGarmentSpec(recommendation,fitConstruction,body.measurements,brandLanguage,blockStrategy,null,null,body.styleSpec,body.bodyProfile)}};
}
async function start(page,text="Critique my current outfit",duplicate=false){
  await question(page).fill(text);const index=await count(page,"question");
  if(duplicate)await askButton(page).evaluate(b=>{b.click();b.click();});else await askButton(page).click();
  await settle(page);assert.equal(await count(page,"question"),index+1,"One action must dispatch one question");return index;
}
async function revision(page,duplicate=false){
  await panel(page).getByRole("button",{name:"Improve this",exact:true}).first().click();
  await panel(page).getByLabel("What should improve?",{exact:true}).selectOption("fit_cut");
  await panel(page).getByLabel("Your judgement or instruction",{exact:true}).fill("Keep both fabrics and collar. Make the shirt relaxed.");
  const index=await count(page,"question"),button=panel(page).getByRole("button",{name:"Revise this direction",exact:true});
  if(duplicate)await button.evaluate(b=>{b.click();b.click();});else await button.click();
  await settle(page);assert.equal(await count(page,"question"),index+1);return index;
}
async function regression(name,run){const {page,context}=await freshPage();try{await run(page);summary.regressions.push({name,status:"passed"});console.log("PASS "+name);}catch(error){summary.regressions.push({name,status:"failed",error:error.message});await page.screenshot({path:path.join(output,name+"-failure.png"),fullPage:true}).catch(()=>{});}finally{await context.close();}}
async function apiContracts(){
  const base={currentShirtId:engine.DESIGNER_REVIEWED_PAIRING.shirtId,currentPantId:engine.DESIGNER_REVIEWED_PAIRING.pantId,currentStyle:engine.designerStyleForOccasion("Semi-Formal"),occasion:"Semi-Formal",context:{climate:"Air-conditioned",intention:"Balanced"}};
  const post=async(label,body,status=200)=>{
    const response=await fetch(baseURL+"/api/designer/brief",{method:"POST",headers:{"content-type":"application/json","x-forwarded-for":"192.0.2."+(1+Math.floor(summary.apiContracts.length/18))},body:JSON.stringify(body)}),data=await response.json();
    assert.equal(response.status,status,label+": "+(data.error || "unexpected response"));
    summary.apiContracts.push({label,status:response.status,engine:data.engine || null});return data;
  };
  for(const [brief,task] of [["Design a business outfit","design"],["Critique my current outfit","critique"],["Compare point vs spread collar","compare"],["Keep both fabrics. Make the shirt relaxed.","refine"],["Check fit and movement","fit"],["Explain my collar construction","construction"],["What is this fabric's GSM and drape?","material"],["Prepare the tailor tech pack","production"]]){
    const data=await post(task,{...base,brief});assert.equal(data.engine,"linen-designer-advisor-v1");assert.equal(data.advice.version,"designer-advice-v1");assert.equal(data.advice.task,task);assert.ok(data.requestId);
    for(const option of data.results){assert.equal(option.styleSpec.styleSchemaVersion,2);assert.equal(typeof option.canApply,"boolean");assert.ok(Array.isArray(option.fitTargets));}
  }
  const revised=await post("judged revision",{...base,brief:"Design a slim business outfit",currentStyle:{...base.currentStyle,shirtFit:"Slim Fit"},judgement:{recommendationId:"CI-judged-direction",rating:"down",reason:"fit_cut",note:"Keep both fabrics and collar. Make the shirt relaxed."}});
  assert.equal(revised.results[0].style.shirtFit,"Relaxed Fit");assert.equal(revised.results[0].shirt.id,base.currentShirtId);assert.equal(revised.results[0].pant.id,base.currentPantId);
  const legacy=await post("legacy v2 compatibility",{brief:"Business meeting with a tucked shirt",currentShirtId:base.currentShirtId,currentPantId:base.currentPantId});assert.equal(legacy.engine,"linen-designer-brief-v2");assert.ok(legacy.results.length>0);
  await post("reject invented construction",{...base,brief:"Critique this outfit",currentStyle:{...base.currentStyle,collar:"Invented collar"}},400);
  await post("reject unavailability",{...base,brief:"Critique this outfit",currentShirtId:"not-a-stock-fabric"},409);
  await post("reject ambiguous judgement",{...base,brief:"Critique this outfit",judgement:{recommendationId:"CI-judged-direction",rating:"down",reason:"formality"}},400);
  const compound=await post("compound design task",{...base,brief:"Design a comfortable summer wedding outfit with a mandarin collar and horn buttons"});
  assert.equal(compound.advice.task,"design");assert.ok(compound.results.length);for(const option of compound.results){assert.equal(option.style.collar,"Mandarin / Band Collar");assert.equal(option.style.button,"Horn");}
  const details=await post("named construction revision",{...base,brief:"Keep both fabrics. Make the collar mandarin, hide the placket and use horn buttons."});
  assert.equal(details.results.length,1);assert.equal(details.results[0].style.placket,"Hidden / Fly-front");assert.equal(details.results[0].style.button,"Horn");assert.equal(details.results[0].shirt.id,base.currentShirtId);
  const collars=await post("named collar comparison",{...base,brief:"Compare mandarin vs camp collar"});
  assert.deepEqual(collars.results.map(option=>option.style.collar),["Mandarin / Band Collar","Cuban / Camp Collar"]);
  const excluded=await post("negated energy and patterns",{...base,brief:"Design a resort outfit, not bold and no prints or checks"});
  assert.equal(excluded.interpretation.context.intention,"Understated");assert.ok(excluded.results.length);
  for(const option of excluded.results)for(const fabric of [option.shirt,option.pant])assert.doesNotMatch(fabric.patternType,/print|check/i);
  const ambiguous=await post("contradictory construction clarification",{...base,brief:"Use point collar and spread collar"});assert.equal(ambiguous.advice.task,"clarify");assert.deepEqual(ambiguous.results,[]);
  const trouser=await post("unsupported trouser fit clarification",{...base,brief:"Make the trousers slim. Keep the shirt fit."});assert.equal(trouser.advice.task,"clarify");assert.deepEqual(trouser.results,[]);
  const roles=await post("garment-specific colour execution",{...base,brief:"Design two relaxed summer dinner outfits with a blue shirt and beige trousers"});assert.equal(roles.results.length,2);for(const r of roles.results){assert.match(r.shirt.name+" "+r.shirt.colorFamily,/blue/i);assert.match(r.pant.name+" "+r.pant.colorFamily,/beige/i);}
  const capsule=await post("three-occasion capsule",{...base,brief:"Create a capsule for office, dinner and weekend"});assert.equal(capsule.advice.task,"capsule");assert.deepEqual(capsule.results.map(r=>r.occasion),["Semi-Formal","Smart-Casual","Casual"]);
  const shirtOnly=await post("shirt-only companion lock",{...base,brief:"Design a shirt only with clean tailoring"});assert.ok(shirtOnly.results.length);for(const r of shirtOnly.results){assert.equal(r.pant.id,base.currentPantId);for(const k of ["trouser","rise","waistband","break"])assert.equal(r.style[k],base.currentStyle[k]);}
  const pantOnly=await post("trouser-only companion lock",{...base,brief:"Design trousers only with modern volume"});assert.ok(pantOnly.results.length);for(const r of pantOnly.results){assert.equal(r.shirt.id,base.currentShirtId);for(const k of ["collar","collarFinish","cuff","placket","shirtFit","shirtWear","button"])assert.equal(r.style[k],base.currentStyle[k]);}
  const weight=await post("missing numeric fabric evidence",{...base,brief:"Design an outfit with a linen shirt under 180 gsm"});assert.deepEqual(weight.results,[]);assert.ok(weight.advice.findings.some(f=>/recorded GSM/.test(f.text)));
  const clash=await post("explicit construction incompatibility",{...base,brief:"Design a formal look with a camp collar and French cuffs"});assert.deepEqual(clash.results,[]);assert.ok(clash.advice.findings.some(f=>/French cuff/.test(f.text)));
  const unknown=await post("unmapped reference clarification",{...base,brief:"Design a British collar shirt"});assert.equal(unknown.advice.task,"clarify");assert.deepEqual(unknown.results,[]);
  const learned=await post("construction-level personal preference",{...base,brief:"Design a business outfit",tasteProfile:{version:1,evidence:4,preferredConstruction:{collar:"Mandarin / Band Collar",shirtFit:"Relaxed Fit",button:"Horn"}}});assert.ok(learned.results.length);for(const r of learned.results){assert.equal(r.style.collar,"Mandarin / Band Collar");assert.equal(r.style.shirtFit,"Relaxed Fit");assert.equal(r.style.button,"Horn");}
  const overridden=await post("instructions precede learned construction",{...base,brief:"Design a business outfit with a point collar and mother-of-pearl buttons",tasteProfile:{version:1,evidence:4,preferredConstruction:{collar:"Mandarin / Band Collar",button:"Horn"}}});assert.ok(overridden.results.length);for(const r of overridden.results){assert.equal(r.style.collar,"Point (Standard) Collar");assert.equal(r.style.button,"Mother-of-Pearl");}
  const invalidTaste=await post("unsupported preference discarded",{...base,brief:"Design a business outfit",tasteProfile:{version:1,evidence:100,preferredConstruction:{collar:"Invented collar"}}});assert.ok(invalidTaste.results.length);for(const r of invalidTaste.results)assert.notEqual(r.style.collar,"Invented collar");
  const cropped=await post("coherent cropped construction",{...base,brief:"Design a cropped trouser"});assert.ok(cropped.results.length);for(const r of cropped.results)assert.equal(r.style.break,"Cropped / Above-ankle");
  const followBasis=designerDirectionBasis(capsule.results[2],capsule.interpretation);
  const followButton=followBasis.currentStyle.button==="Horn"?"Mother-of-Pearl":"Horn";
  const follow=await post("proposal follow-up without judgement",{...followBasis,brief:"Keep both fabrics. Use "+(followButton==="Horn"?"horn":"mother-of-pearl")+" buttons."});assert.equal(follow.advice.task,"refine");assert.equal(follow.advice.revision,null);assert.equal(follow.results.length,1);assert.equal(follow.results[0].occasion,"Casual");
  for(const k of Object.keys(followBasis.currentStyle))assert.equal(follow.results[0].style[k],k==="button"?followButton:followBasis.currentStyle[k]);assert.equal(follow.results[0].shirt.id,followBasis.currentShirtId);assert.equal(follow.results[0].pant.id,followBasis.currentPantId);
  const followCompare=await post("comparison from proposal construction",{...followBasis,brief:"Compare point collar vs spread collar"});assert.equal(followCompare.results.length,2);for(const r of followCompare.results){assert.equal(r.shirt.id,followBasis.currentShirtId);assert.equal(r.pant.id,followBasis.currentPantId);for(const k of Object.keys(followBasis.currentStyle).filter(k=>k!=="collar"))assert.equal(r.style[k],followBasis.currentStyle[k]);}
  const learnedCapsule=await post("occasion-scoped learned capsule construction",{...base,brief:"Create a capsule for office, dinner and weekend",tasteProfile:{version:1,evidence:4,preferredConstruction:{...base.currentStyle,button:"Horn"}}});assert.deepEqual(learnedCapsule.results.map(r=>r.occasion),["Semi-Formal","Smart-Casual","Casual"]);assert.equal(learnedCapsule.results[0].style.button,"Horn");for(const r of learnedCapsule.results.slice(1))assert.deepEqual(r.style,capsule.results.find(original=>original.occasion===r.occasion).style);
  console.log("PASS "+summary.apiContracts.length+" actual Designer HTTP contracts");
}
(async()=>{
  fs.mkdirSync(output,{recursive:true});await apiContracts();browser=await chromium.launch({headless:true});
  for(const width of [390,768,1440]){
    const {page,context}=await freshPage(width),pixels=await mainPixels(page);
    const heroLayout=await page.evaluate(()=>{
      const heading=document.querySelector(".newDesignerHero h1"),art=document.querySelector(".newDesignerHeroArt"),hero=document.querySelector(".newDesignerHero");
      const range=document.createRange();range.selectNodeContents(heading);const text=range.getBoundingClientRect(),image=art.getBoundingClientRect(),bounds=hero.getBoundingClientRect();
      return {textContained:text.left>=bounds.left-1&&text.right<=bounds.right+1,textClearOfImage:text.right<=image.left+1||text.bottom<=image.top+1||text.top>=image.bottom-1};
    });
    assert.ok(heroLayout.textContained&&heroLayout.textClearOfImage,"Designer heading must remain fully visible beside or above the hero image");
    const first=await start(page,"Critique my current outfit",true);const initial=await answer(page,first);
    await page.screenshot({path:path.join(output,"critique-"+width+".png"),fullPage:true});
    assert.equal(await mainPixels(page),pixels,"Advice must not alter the chosen outfit before Apply");assert.ok(initial.advice.findings.length>0);
    await panel(page).getByRole("button",{name:"Works for me",exact:true}).first().evaluate(b=>{b.click();b.click();});await settle(page);
    assert.equal(aggregateDesignerTaste(await memory(page),initial.interpretation.occasion).evidence,1,"Repeated clicks count once");
    const changed=await revision(page,true),judged=(await request(page,"question",changed)).body;
    assert.deepEqual(judged.currentStyle,initial.results[0].style);assert.equal(judged.judgement.rating,"down");assert.equal(judged.judgement.reason,"fit_cut");
    const revised=await answer(page,changed);assert.equal(revised.results[0].style.shirtFit,"Relaxed Fit");
    assert.equal(await mainPixels(page),pixels,"A judged revision needs explicit Apply");
    await page.screenshot({path:path.join(output,"revision-"+width+".png"),fullPage:true});
    const assessmentIndex=await count(page,"assessment");await panel(page).getByRole("button",{name:"Apply direction",exact:true}).first().click();await settle(page);
    const applied=(await request(page,"assessment",assessmentIndex)).body;
    assert.deepEqual(applied.styleSpec,fromLegacyStyle(revised.results[0].style),"Canonical assessment must receive the applied construction, not the old StyleSpec");
    assert.equal(applied.shirtId,revised.results[0].shirt.id);assert.equal(applied.pantId,revised.results[0].pant.id);
    await complete(page,"assessment",assessmentIndex,assessmentFixture(applied));
    assert.equal(await page.getByLabel("Shirt fit",{exact:true}).inputValue(),"Relaxed Fit");
    const completed=(await memory(page)).filter(e=>e.type==="designer_recommendation");assert.equal(completed.at(-1).payload.style.shirtFit,"Relaxed Fit");
    const constructionPixels=await mainPixels(page),named=await answer(page,await start(page,"Keep both fabrics. Make the collar mandarin, hide the placket and use horn buttons."));
    assert.equal(named.results.length,1);assert.equal(named.results[0].style.collar,"Mandarin / Band Collar");assert.equal(named.results[0].style.placket,"Hidden / Fly-front");assert.equal(named.results[0].style.button,"Horn");
    assert.equal(await mainPixels(page),constructionPixels,"A named construction request still needs Apply");
    await page.screenshot({path:path.join(output,"construction-"+width+".png"),fullPage:true});
    const namedAssessmentIndex=await count(page,"assessment");await panel(page).getByRole("button",{name:"Apply direction",exact:true}).first().click();await settle(page);
    const namedApplied=(await request(page,"assessment",namedAssessmentIndex)).body;
    assert.deepEqual(namedApplied.styleSpec,fromLegacyStyle(named.results[0].style));await complete(page,"assessment",namedAssessmentIndex,assessmentFixture(namedApplied));
    const namedMemory=(await memory(page)).filter(e=>e.type==="designer_recommendation").at(-1).payload.style;
    assert.equal(namedMemory.collar,"Mandarin / Band Collar");assert.equal(namedMemory.placket,"Hidden / Fly-front");assert.equal(namedMemory.button,"Horn");
    const beforeCapsule=await mainPixels(page),wardrobe=await answer(page,await start(page,"Create a capsule for office, dinner and weekend"));
    assert.deepEqual(wardrobe.results.map(r=>r.occasion),["Semi-Formal","Smart-Casual","Casual"]);assert.equal(await mainPixels(page),beforeCapsule);
    assert.equal(await panel(page).locator(".designerOptionOccasion").count(),3);
    if(width<=720){const cards=await panel(page).locator(".newDesignerBriefResults").evaluate(list=>({width:list.clientWidth,scrollWidth:list.scrollWidth,contained:[...list.children].every(card=>card.getBoundingClientRect().left>=list.getBoundingClientRect().left-1&&card.getBoundingClientRect().right<=list.getBoundingClientRect().right+1)}));assert.ok(cards.contained&&cards.scrollWidth<=cards.width+1,"Every mobile direction and judgement control must fit without horizontal scrolling");}
    await page.screenshot({path:path.join(output,"capsule-"+width+".png"),fullPage:true});
    const capsuleAssessmentIndex=await count(page,"assessment");await panel(page).getByRole("button",{name:"Apply direction",exact:true}).nth(1).click();await settle(page);
    const capsuleApplied=(await request(page,"assessment",capsuleAssessmentIndex)).body;assert.equal(capsuleApplied.occasion,"Smart-Casual");assert.deepEqual(capsuleApplied.styleSpec,wardrobe.results[1].styleSpec);await complete(page,"assessment",capsuleAssessmentIndex,assessmentFixture(capsuleApplied));
    assert.equal((await memory(page)).filter(e=>e.type==="designer_recommendation").at(-1).payload.occasion,"Smart-Casual");
    const followPixels=await mainPixels(page),followAssessmentCount=await count(page,"assessment"),votesBefore=(await memory(page)).filter(e=>e.type==="designer_feedback").length;
    const followWardrobe=await answer(page,await start(page,"Create a capsule for office, dinner and weekend"));
    await panel(page).getByRole("button",{name:"Develop this direction",exact:true}).nth(2).evaluate(button=>{button.click();button.click();});await settle(page);
    assert.match(await panel(page).getByLabel("Designer starting point").textContent(),/Weekend direction.*Casual/);assert.equal(await question(page).inputValue(),"");assert.equal(await question(page).evaluate(el=>el===document.activeElement),true);assert.equal(await mainPixels(page),followPixels);assert.equal(await count(page,"assessment"),followAssessmentCount);
    const followIndex=await start(page,"Keep both fabrics. Use horn buttons."),followRequest=(await request(page,"question",followIndex)).body;
    assert.deepEqual(followRequest.currentStyle,followWardrobe.results[2].style);assert.equal(followRequest.currentShirtId,followWardrobe.results[2].shirt.id);assert.equal(followRequest.currentPantId,followWardrobe.results[2].pant.id);assert.equal(followRequest.occasion,"Casual");assert.deepEqual(followRequest.context,followWardrobe.results[2].context);assert.equal(followRequest.judgement,undefined);
    const followed=await answer(page,followIndex);assert.equal(followed.results.length,1);assert.equal(followed.results[0].style.button,"Horn");assert.equal((await memory(page)).filter(e=>e.type==="designer_feedback").length,votesBefore);assert.equal(await mainPixels(page),followPixels);
    await panel(page).locator(".designerTaste>summary").click();assert.match(await panel(page).locator(".designerTaste").textContent(),/For casual looks/);
    await page.screenshot({path:path.join(output,"follow-up-"+width+".png"),fullPage:true});
    const followAssessmentIndex=await count(page,"assessment");await panel(page).getByRole("button",{name:"Apply direction",exact:true}).first().click();await settle(page);
    const followApplied=(await request(page,"assessment",followAssessmentIndex)).body;assert.equal(followApplied.occasion,"Casual");assert.deepEqual(followApplied.styleSpec,followed.results[0].styleSpec);await complete(page,"assessment",followAssessmentIndex,assessmentFixture(followApplied));assert.equal(await panel(page).getByLabel("Designer starting point").count(),0);
    const metrics=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth}));assert.ok(metrics.documentWidth<=width+2);
    await page.screenshot({path:path.join(output,"applied-"+width+".png"),fullPage:true});summary.viewports.push({...metrics,heroTextVisibility:"passed",mobileDirectionLayout:"passed",critiqueJudgementRevisionApply:"passed",sameFrameDispatch:"passed",exactCanonicalConstruction:"passed",namedConstructionRevisionApply:"passed",capsuleOwnOccasionApply:"passed",proposalFollowUpApply:"passed"});await context.close();console.log("PASS designer judgement flow at "+width+"px");
  }
  await regression("stale-question-after-new-text",async page=>{const old=await start(page);const fresh=await start(page,"Compare point vs spread collar");await answer(page,old);assert.equal(await panel(page).locator(".designerAdvice").count(),0);assert.equal((await request(page,"question",old)).aborted,true);await answer(page,fresh);assert.match(await panel(page).locator(".designerAdvice>span").textContent(),/COMPARE/);});
  await regression("stale-question-after-construction-change",async page=>{const old=await start(page);await page.getByLabel("Shirt fit",{exact:true}).selectOption("Relaxed Fit");await answer(page,old);assert.equal(await panel(page).locator(".designerAdvice").count(),0);assert.equal((await memory(page)).filter(e=>e.type==="designer_override").length,0);});
  await regression("reset-same-design-invalidates-question",async page=>{const old=await start(page);await page.getByRole("button",{name:"Reset",exact:true}).click();await answer(page,old);assert.equal(await question(page).inputValue(),"");assert.equal((await request(page,"question",old)).aborted,true);assert.equal(await panel(page).locator(".designerAdvice").count(),0);});
  await regression("stale-revision-error-cannot-unlock-new-question",async page=>{await answer(page,await start(page));const old=await revision(page);const fresh=await start(page,"Compare point vs spread collar");await complete(page,"question",old,{error:"Discarded revision error"},500);assert.equal(await panel(page).getByRole("alert").count(),0);assert.equal(await panel(page).getByRole("button",{name:"Designing…",exact:true}).isDisabled(),true);await answer(page,fresh);});
  await regression("stale-assessment-after-applied-choice-change",async page=>{await answer(page,await start(page,"Keep both fabrics. Make the shirt relaxed."));await panel(page).getByRole("button",{name:"Apply direction",exact:true}).first().click();await settle(page);const index=(await count(page,"assessment"))-1,body=(await request(page,"assessment",index)).body;await page.getByLabel("Shirt fit",{exact:true}).selectOption("Slim Fit");await complete(page,"assessment",index,assessmentFixture(body));assert.equal(await page.getByLabel("Shirt fit",{exact:true}).inputValue(),"Slim Fit");assert.equal((await memory(page)).filter(e=>e.type==="designer_recommendation").length,0);});
  await regression("comparison-and-unsupported-task",async page=>{const compared=await answer(page,await start(page,"Compare pleated vs flat-front trousers"));assert.equal(compared.results.length,2);assert.equal(await panel(page).getByRole("button",{name:"Resolve conflict first",exact:true}).isDisabled(),true);await answer(page,await start(page,"Design a sherwani"));assert.equal(await panel(page).locator(".newDesignerBriefResults").count(),0);assert.match(await panel(page).locator(".designerAdvice").textContent(),/supported block/);});
  await regression("unmount-discards-question",async page=>{const old=await start(page);await page.getByRole("link",{name:/Style Director/i}).first().click();await page.waitForURL("**/style-director");await answer(page,old);assert.equal((await request(page,"question",old)).aborted,true);assert.equal((await memory(page)).filter(e=>e.type==="designer_override").length,0);});
  await regression("previous-revision-restores-proposal-without-apply",async page=>{const original=await answer(page,await start(page));const pixels=await mainPixels(page);await answer(page,await revision(page));assert.match(await panel(page).locator(".designerAdvice>span").textContent(),/REVISION 1/);await panel(page).getByRole("button",{name:"Previous revision",exact:true}).click();assert.doesNotMatch(await panel(page).locator(".designerAdvice>span").textContent(),/REVISION/);assert.equal(await mainPixels(page),pixels);assert.match(await panel(page).locator(".newDesignerBriefCut").first().textContent(),new RegExp(original.results[0].style.collar.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));});
  await regression("personal-preferences-are-visible-and-can-be-disabled",async page=>{
    const style={...engine.designerStyleForOccasion("Semi-Formal"),collar:"Spread Collar",shirtFit:"Relaxed Fit",button:"Horn"};
    const events=engine.DESIGNER_SHIRTS.slice(0,4).map((shirt,i)=>({type:"designer_feedback",source:"style-director",payload:{recommendationId:"qa-taste-"+i,rating:"up",shirtId:shirt.id,pantId:engine.DESIGNER_REVIEWED_PAIRING.pantId,occasion:"Semi-Formal",style}}));
    await page.evaluate(events=>localStorage.setItem("linen-earth:style-memory:v1",JSON.stringify(events)),events);
    const index=await start(page,"Design a business outfit"),body=(await request(page,"question",index)).body;assert.equal(body.tasteProfile.preferredConstruction.collar,"Spread Collar");const personalized=await answer(page,index);assert.ok(personalized.results.length);for(const r of personalized.results){assert.equal(r.style.collar,"Spread Collar");assert.equal(r.style.shirtFit,"Relaxed Fit");assert.equal(r.style.button,"Horn");}
    await panel(page).locator(".designerTaste>summary").click();assert.match(await panel(page).locator(".designerTaste").textContent(),/Spread Collar \(4 supporting reviews\)/);
    await panel(page).getByLabel("Use my preferences for new directions").uncheck();assert.equal(await panel(page).locator(".designerAdvice").count(),0);
    const fresh=await start(page,"Design a business outfit"),unpersonalized=(await request(page,"question",fresh)).body;assert.equal(unpersonalized.tasteProfile,undefined);await answer(page,fresh);
  });
  await regression("changing-preference-choice-discards-pending-response",async page=>{const index=await start(page);await panel(page).locator(".designerTaste>summary").click();await panel(page).getByLabel("Use my preferences for new directions").uncheck();await answer(page,index);assert.equal((await request(page,"question",index)).aborted,true);assert.equal(await panel(page).locator(".designerAdvice").count(),0);});
  await regression("leaving-starting-point-discards-pending-follow-up",async page=>{
    await answer(page,await start(page,"Create a capsule for office, dinner and weekend"));await panel(page).getByRole("button",{name:"Develop this direction",exact:true}).nth(2).click();
    const old=await start(page,"Keep both fabrics. Use horn buttons.");await panel(page).getByRole("button",{name:"Use my current outfit",exact:true}).click();assert.equal(await panel(page).getByLabel("Designer starting point").count(),0);
    const fresh=await start(page,"Compare point collar vs spread collar");await answer(page,old);assert.equal((await request(page,"question",old)).aborted,true);assert.equal(await panel(page).locator(".designerAdvice").count(),0);assert.equal(await panel(page).getByRole("button",{name:"Designing…",exact:true}).isDisabled(),true);assert.equal((await request(page,"question",fresh)).body.occasion,"Semi-Formal");await answer(page,fresh);
  });
  await regression("manual-outfit-change-clears-proposal-starting-point",async page=>{
    await answer(page,await start(page,"Create a capsule for office, dinner and weekend"));await panel(page).getByRole("button",{name:"Develop this direction",exact:true}).nth(2).click();const old=await start(page,"Keep both fabrics. Use horn buttons.");
    await page.getByLabel("Shirt fit",{exact:true}).selectOption("Relaxed Fit");assert.equal(await panel(page).getByLabel("Designer starting point").count(),0);await answer(page,old);assert.equal((await request(page,"question",old)).aborted,true);assert.equal(await panel(page).locator(".designerAdvice").count(),0);
  });
  await regression("judged-follow-up-refers-to-new-proposal",async page=>{
    await answer(page,await start(page,"Create a capsule for office, dinner and weekend"));await panel(page).getByRole("button",{name:"Develop this direction",exact:true}).nth(2).click();
    const followed=await answer(page,await start(page,"Keep both fabrics. Use horn buttons.")),index=await revision(page),body=(await request(page,"question",index)).body;
    assert.deepEqual(body.currentStyle,followed.results[0].style);assert.equal(body.currentStyle.button,"Horn");assert.equal(body.occasion,"Casual");assert.equal(body.judgement.rating,"down");await answer(page,index);
  });
  await regression("new-occasion-uses-own-personal-preferences",async page=>{
    const events=[];for(const [occasion,button] of [["Casual","Horn"],["Semi-Formal","Mother-of-Pearl"]])for(let i=0;i<4;i++)events.push({type:"designer_feedback",source:"style-director",payload:{recommendationId:"qa-occasion-"+occasion+i,rating:"up",shirtId:engine.DESIGNER_SHIRTS[i].id,pantId:engine.DESIGNER_REVIEWED_PAIRING.pantId,occasion,style:{...engine.designerStyleForOccasion(occasion),button}}});
    await page.evaluate(events=>localStorage.setItem("linen-earth:style-memory:v1",JSON.stringify(events)),events);
    await answer(page,await start(page,"Create a capsule for office, dinner and weekend"));await panel(page).getByRole("button",{name:"Develop this direction",exact:true}).nth(2).click();
    const index=await start(page,"Design a business outfit"),body=(await request(page,"question",index)).body;assert.equal(body.occasion,"Casual");assert.equal(body.tasteProfile.preferredConstruction.button,"Mother-of-Pearl");
    await panel(page).locator(".designerTaste>summary").click();assert.match(await panel(page).locator(".designerTaste").textContent(),/For semi-formal looks/);const reply=await answer(page,index);assert.equal(reply.interpretation.occasion,"Semi-Formal");assert.ok(reply.results.length);for(const result of reply.results)assert.equal(result.style.button,"Mother-of-Pearl");
  });
  assert.deepEqual(summary.errors,[]);assert.equal(summary.regressions.filter(r=>r.status==="failed").length,0,"Designer advisor regressions failed");
})().catch(async error=>{summary.failure=error.stack;console.error(error);process.exitCode=1;if(activePage&&!activePage.isClosed())await activePage.screenshot({path:path.join(output,"flow-failure.png"),fullPage:true}).catch(()=>{});}).finally(async()=>{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,"summary.json"),JSON.stringify(summary,null,2));if(browser)await browser.close();});
