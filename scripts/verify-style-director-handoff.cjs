// Real questionnaire -> Designer -> 3D recipe navigation. All backend responses
// are deterministic fixtures; no paid calls or production audit writes.
const assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path"),{createRequire}=require("node:module");
const {load}=require("./designer-test-loader.cjs");
const {createStyleDirectorLooks}=load("src/lib/style-director-agent.ts");
const engine=load("src/lib/designer/engine.ts");
const {fromLegacyStyle,toLegacyStyle}=load("src/lib/designer/style-spec-v2.ts");
const {optionById}=load("src/lib/designer/options/library.ts");
const {assessFitConstruction}=load("src/lib/designer/fit-construction.ts"),{assessBlockStrategy}=load("src/lib/designer/block-strategy.ts");
const {evaluateLinenEarthBrandLanguage}=load("src/lib/designer/brand-language.ts"),{buildDesignerNegotiation}=load("src/lib/designer/constraint-negotiation.ts");
const {buildCanonicalGarmentSpec}=load("src/lib/designer/garment-spec.ts");
const looks=createStyleDirectorLooks({occasion:"Work",mood:"Quiet",time:"Day",climate:"Indoor",garment:"shirt",colorDirection:"Light"}).map(look=>({...look,handoffToken:"synthetic-browser-handoff"}));
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
if(!runtime)throw Error("Set LINEN_BROWSER_QA_RUNTIME");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const baseURL=process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000";
const output=path.resolve("artifacts/preview-lifecycle/style-director-handoff");
const draftKey="linen-earth:real-designer-draft:v2";
const summary={browser:"Chromium",backendResponses:"mocked; no paid calls or cloud writes",physicalOrDeviceAcceptance:false,viewports:[],errors:[]};

function assessmentFixture(body){
  const shirt=engine.DESIGNER_SHIRTS.find(f=>f.id===body.shirtId),pant=engine.DESIGNER_PANTS.find(f=>f.id===body.pantId),style=toLegacyStyle(body.styleSpec);
  const recommendation=engine.evaluateDesignerCombo(shirt,pant,body.occasion,style,undefined,body.context);
  const fitConstruction=assessFitConstruction(body.measurements,style,{climate:body.context.climate,shirtFabric:shirt,trouserFabric:pant,observations:body.observations});
  const blockStrategy=assessBlockStrategy(body.measurements,style,body.observations),brandLanguage=evaluateLinenEarthBrandLanguage(shirt,pant,style,body.occasion,body.context);
  return {assessment:{recommendation,fitConstruction,blockStrategy,brandLanguage,negotiation:buildDesignerNegotiation(recommendation,fitConstruction),garmentSpec:buildCanonicalGarmentSpec(recommendation,fitConstruction,body.measurements,brandLanguage,blockStrategy,null,null,body.styleSpec,body.bodyProfile)}};
}
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,30)))));
async function complete(page,kind,value,fail=false){
  await page.evaluate(({kind,value,fail})=>{
    const request=window.__linenHandoffQA.find(r=>r.kind===kind);
    if(!request)throw Error("Missing handoff request: "+kind);
    if(fail)request.reject(new TypeError("Synthetic offline failure"));
    else request.resolve(new Response(JSON.stringify(value),{status:200,headers:{"content-type":"application/json"}}));
  },{kind,value,fail});
  await settle(page);
}
async function verify(browser,width){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  page.on("pageerror",error=>summary.errors.push(error.message));
  page.on("console",message=>{if(message.type()==="error")summary.errors.push(message.text());});
  const paid=[];
  await context.route("**/api/**",route=>{
    const p=new URL(route.request().url()).pathname;
    if(/look-render|look-inspect|creative-render|creative-inspect/.test(p))paid.push(p);
    if(p==="/api/designer/assess"||p==="/api/style-director/handoff")summary.errors.push("Handoff request escaped mock: "+p);
    return route.fulfill({status:200,json:p==="/api/style-director"?{looks}:p.includes("photo-calibration")?{verified:false}:{}});
  });
  await page.addInitScript(()=>{
    const original=window.fetch.bind(window);window.__linenHandoffQA=[];
    window.fetch=(input,options={})=>{
      const p=new URL(typeof input==="string"?input:input.url,location.href).pathname;
      const kind=p==="/api/designer/assess"?"assessment":p==="/api/style-director/handoff"?"audit":null;
      if(!kind)return original(input,options);
      // Deliberately resolve even after abort, as an in-flight server may finish.
      return new Promise((resolve,reject)=>window.__linenHandoffQA.push({kind,body:JSON.parse(options.body||"{}"),resolve,reject}));
    };
  });
  await page.goto(baseURL+"/style-director",{waitUntil:"networkidle"});
  await page.locator(".brandIntro").waitFor({state:"hidden"});
  for(const label of ["Work","Quiet","Day","Indoor / AC","Shirt","Light"]){
    await page.locator(".directorOption").filter({has:page.locator("strong").getByText(label,{exact:true})}).click();
  }
  const link=page.getByRole("link",{name:/Open Linen Earth Real Model Designer/});
  await link.waitFor({state:"visible"});
  const target=new URL(await link.getAttribute("href"),baseURL),model=looks[0].realModel;
  assert.deepEqual(JSON.parse(target.searchParams.get("styleSpec")),model.styleSpec);
  const staleStyle=engine.designerStyleForOccasion("Casual"),staleSpec=fromLegacyStyle(staleStyle);
  staleSpec.shirt.type="overshirt";
  await page.evaluate(({draftKey,width,staleStyle,staleSpec})=>localStorage.setItem(draftKey,width===390?"{broken-json":JSON.stringify({style:staleStyle,styleSpec:staleSpec})),{draftKey,width,staleStyle,staleSpec});
  if(width===1440)await page.addInitScript(draftKey=>{
    const get=Storage.prototype.getItem,remove=Storage.prototype.removeItem;
    Storage.prototype.getItem=function(key){if(key===draftKey)throw new DOMException("Blocked draft","SecurityError");return get.call(this,key);};
    Storage.prototype.removeItem=function(key){if(key===draftKey)throw new DOMException("Blocked draft","SecurityError");return remove.call(this,key);};
  },draftKey);
  // Use a document navigation to exercise the hydration/restore boundary.
  await page.goto(target.href,{waitUntil:"networkidle"});
  await page.locator(".brandIntro").waitFor({state:"hidden"});
  await page.waitForFunction(()=>window.__linenHandoffQA.some(r=>r.kind==="assessment")&&window.__linenHandoffQA.some(r=>r.kind==="audit"));
  assert.equal(await page.getByRole("combobox",{name:"Shirt type",exact:true}).inputValue(),model.styleSpec.shirt.type);
  assert.equal(await page.getByRole("combobox",{name:"Trouser type",exact:true}).inputValue(),model.styleSpec.pant.type);
  const requests=await page.evaluate(()=>window.__linenHandoffQA.map(({kind,body})=>({kind,body})));
  for(const request of requests){
    assert.equal(request.body.shirtId,model.shirtId);
    assert.equal(request.body.pantId,model.pantId);
    assert.deepEqual(request.body.styleSpec,model.styleSpec);
    assert.deepEqual(request.body.style,model.style);
  }
  const assessment=assessmentFixture(requests.find(r=>r.kind==="assessment").body);
  if(width===390){
    await complete(page,"audit",{verified:true,audited:true,auditId:"synthetic-audit"});
    await complete(page,"assessment",assessment);
    assert.match(await page.locator(".newDesignerHandoff").innerText(),/VERIFIED HANDOFF/);
    assert.equal(await page.locator(".newDesignerResultTop").count(),1);
  }else{
    await page.getByRole("combobox",{name:"Shirt type",exact:true}).selectOption("overshirt");
    await complete(page,"assessment",assessment);
    await complete(page,"audit",{verified:true,audited:true,auditId:"late-audit"},width===1440);
    assert.equal(await page.locator(".newDesignerResultTop").count(),0,"Delayed handoff assessment must not restore the previous result");
    const text=await page.locator(".newDesignerHandoff").innerText();
    assert.match(text,/Design adjusted/);
    assert.doesNotMatch(text,/VERIFIED HANDOFF|Handoff matched/);
    const events=await page.evaluate(()=>JSON.parse(localStorage.getItem("linen-earth:style-memory:v1")||"[]"));
    assert.equal(events.filter(e=>e.type==="designer_recommendation").length,0,"Discarded assessment must not enter memory");
    if(width===1440){
      await page.getByRole("combobox",{name:"Shirt type",exact:true}).selectOption(model.styleSpec.shirt.type);
      await settle(page);
      assert.match(await page.locator(".newDesignerHandoff").innerText(),/verification is currently unavailable/);
    }
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Designer must not overflow at "+width);
  await page.screenshot({path:path.join(output,"designer-"+width+".png"),fullPage:true});
  // Readable storage cases also prove exact Designer-to-3D recipe continuity.
  if(width!==1440){
    const expectedType=width===390?model.styleSpec.shirt.type:"overshirt";
    await page.locator(".newDesignerOpen3D").click();
    await page.waitForURL("**/lab/garment-viewer");
    await page.locator(".garmentDraftRecipe").waitFor({state:"visible"});
    const recipe=await page.locator(".garmentDraftRecipe").innerText();
    assert.ok(recipe.includes(optionById(expectedType).label),"3D recipe must retain the current shirt type");
    const selects=page.locator(".garmentViewerControls select");
    assert.equal(await selects.nth(0).inputValue(),model.shirtId);
    assert.equal(await selects.nth(1).inputValue(),model.pantId);
  }
  assert.deepEqual(paid,[],"Navigation and live garment edits must not call paid providers");
  summary.viewports.push({width,draft:width===390?"malformed":width===768?"stale":"blocked",exactRecipe:true,lateResponse:width!==390,paidCalls:paid.length});
  await context.close();
}
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of [390,768,1440])await verify(browser,width);
    assert.deepEqual(summary.errors,[]);
    console.log("Style Director handoff verified at 390, 768 and 1440px; no paid calls.");
  }finally{
    await fs.writeFile(path.join(output,"summary.json"),JSON.stringify(summary,null,2)+"\n");
    await browser.close();
  }
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
