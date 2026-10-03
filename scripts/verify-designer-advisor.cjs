// Real Designer UI and Canvas; deterministic engine fixtures and delayed API
// responses. No provider calls and no physical-fabric/device acceptance.
const assert=require("node:assert/strict"), fs=require("node:fs"), path=require("node:path"), Module=require("node:module");
const {load}=require("./designer-test-loader.cjs");
const engine=load("src/lib/designer/engine.ts"), {answerDesignerQuestion}=load("src/lib/designer/advisor.ts"), {aggregateDesignerTaste}=load("src/lib/designer/taste-profile.ts");
const {fromLegacyStyle,toLegacyStyle}=load("src/lib/designer/style-spec-v2.ts");
const {assessFitConstruction}=load("src/lib/designer/fit-construction.ts"), {assessBlockStrategy}=load("src/lib/designer/block-strategy.ts"), {evaluateLinenEarthBrandLanguage}=load("src/lib/designer/brand-language.ts");
const {buildDesignerNegotiation}=load("src/lib/designer/constraint-negotiation.ts"), {buildCanonicalGarmentSpec}=load("src/lib/designer/garment-spec.ts");
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;if(!runtime)throw Error("Set LINEN_BROWSER_QA_RUNTIME");
const {chromium}=Module.createRequire(path.join(runtime,"package.json"))("playwright");
const output=path.resolve("artifacts/preview-lifecycle/designer-advisor"), baseURL=process.env.LINEN_BROWSER_QA_URL || "http://127.0.0.1:3000";
const summary={browser:"Chromium",backendResponses:"mocked using the real deterministic rules; no paid calls",physicalOrDeviceAcceptance:false,viewports:[],regressions:[],errors:[]};
let browser;
const panel=page=>page.locator(".newDesignerAdvisor");
const question=page=>page.getByRole("textbox",{name:"Designer question or task",exact:true});
const askButton=page=>panel(page).getByRole("button",{name:"Ask Designer",exact:true});
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,30)))));
async function freshPage(width=1440){
  const context=await browser.newContext({viewport:{width,height:1000}}), page=await context.newPage();
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
  return {...answerDesignerQuestion({shirts,pants,currentShirt:shirts.find(f=>f.id===body.currentShirtId),currentPant:pants.find(f=>f.id===body.currentPantId),chosenStyle:body.currentStyle,occasion:body.occasion,context:body.context,brief:body.brief,judgement:body.judgement,measurements:body.measurements,observations:body.observations}),requestId:"LE-QA-"+index};
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
(async()=>{
  fs.mkdirSync(output,{recursive:true});browser=await chromium.launch({headless:true});
  for(const width of [390,768,1440]){
    const {page,context}=await freshPage(width),pixels=await mainPixels(page);
    const first=await start(page,"Critique my current outfit",true);const initial=await answer(page,first);
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
    const metrics=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth}));assert.ok(metrics.documentWidth<=width+2);
    await page.screenshot({path:path.join(output,"applied-"+width+".png"),fullPage:true});summary.viewports.push({...metrics,critiqueJudgementRevisionApply:"passed",sameFrameDispatch:"passed",exactCanonicalConstruction:"passed"});await context.close();console.log("PASS designer judgement flow at "+width+"px");
  }
  await regression("stale-question-after-new-text",async page=>{const old=await start(page);const fresh=await start(page,"Compare point vs spread collar");await answer(page,old);assert.equal(await panel(page).locator(".designerAdvice").count(),0);assert.equal((await request(page,"question",old)).aborted,true);await answer(page,fresh);assert.match(await panel(page).locator(".designerAdvice>span").textContent(),/COMPARE/);});
  await regression("stale-question-after-construction-change",async page=>{const old=await start(page);await page.getByLabel("Shirt fit",{exact:true}).selectOption("Relaxed Fit");await answer(page,old);assert.equal(await panel(page).locator(".designerAdvice").count(),0);assert.equal((await memory(page)).filter(e=>e.type==="designer_override").length,0);});
  await regression("reset-same-design-invalidates-question",async page=>{const old=await start(page);await page.getByRole("button",{name:"Reset",exact:true}).click();await answer(page,old);assert.equal(await question(page).inputValue(),"");assert.equal((await request(page,"question",old)).aborted,true);assert.equal(await panel(page).locator(".designerAdvice").count(),0);});
  await regression("stale-revision-error-cannot-unlock-new-question",async page=>{await answer(page,await start(page));const old=await revision(page);const fresh=await start(page,"Compare point vs spread collar");await complete(page,"question",old,{error:"Discarded revision error"},500);assert.equal(await panel(page).getByRole("alert").count(),0);assert.equal(await panel(page).getByRole("button",{name:"Designing…",exact:true}).isDisabled(),true);await answer(page,fresh);});
  await regression("stale-assessment-after-applied-choice-change",async page=>{await answer(page,await start(page,"Keep both fabrics. Make the shirt relaxed."));await panel(page).getByRole("button",{name:"Apply direction",exact:true}).first().click();await settle(page);const index=(await count(page,"assessment"))-1,body=(await request(page,"assessment",index)).body;await page.getByLabel("Shirt fit",{exact:true}).selectOption("Slim Fit");await complete(page,"assessment",index,assessmentFixture(body));assert.equal(await page.getByLabel("Shirt fit",{exact:true}).inputValue(),"Slim Fit");assert.equal((await memory(page)).filter(e=>e.type==="designer_recommendation").length,0);});
  await regression("comparison-and-unsupported-task",async page=>{const compared=await answer(page,await start(page,"Compare pleated vs flat-front trousers"));assert.equal(compared.results.length,2);assert.equal(await panel(page).getByRole("button",{name:"Resolve conflict first",exact:true}).isDisabled(),true);await answer(page,await start(page,"Design a sherwani"));assert.equal(await panel(page).locator(".newDesignerBriefResults").count(),0);assert.match(await panel(page).locator(".designerAdvice").textContent(),/supported block/);});
  await regression("unmount-discards-question",async page=>{const old=await start(page);await page.getByRole("link",{name:/Style Director/i}).first().click();await page.waitForURL("**/style-director");await answer(page,old);assert.equal((await request(page,"question",old)).aborted,true);assert.equal((await memory(page)).filter(e=>e.type==="designer_override").length,0);});
  assert.deepEqual(summary.errors,[]);assert.equal(summary.regressions.filter(r=>r.status==="failed").length,0,"Designer advisor regressions failed");
})().catch(error=>{summary.failure=error.stack;console.error(error);process.exitCode=1;}).finally(async()=>{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,"summary.json"),JSON.stringify(summary,null,2));if(browser)await browser.close();});
