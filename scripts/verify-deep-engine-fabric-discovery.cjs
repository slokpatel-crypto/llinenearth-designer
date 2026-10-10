// Actual user-visible fabric discovery in real desktop/mobile Chromium.
// No 3D model, mocked paid endpoints, no fabricated supplier measurements.
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const path=require("node:path");
const {createRequire}=require("node:module");
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
if(!runtime)throw Error("Set LINEN_BROWSER_QA_RUNTIME to the pinned test runtime.");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const base=process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000";
const output=path.resolve("artifacts/deep-engine-browser");
const summary={version:"linen-earth-non3d-fabric-browser-v1",
  browser:"Chromium",physicalFabricVerified:false,visualDrapeApproved:false,
  paidCalls:0,devices:[],consoleErrors:[]};
let browser,activePage;
const input=(page,id)=>page.locator(id);

async function testViewport(width){
  const context=await browser.newContext({viewport:{width,height:930},reducedMotion:"reduce"});
  const capturedAssessments=[];
  await context.route("**/api/**",route=>{
    const p=new URL(route.request().url()).pathname;
    if(p==="/api/designer/assess"){
      capturedAssessments.push(JSON.parse(route.request().postData()||"{}"));
      return route.fulfill({status:422,json:{error:"QA deliberately mocked server assessment"}});
    }
    if(/(?:creative-render|look-render|creative-inspect|look-inspect)/.test(p))
      summary.paidCalls++;
    return route.fulfill({status:200,json:{verified:false}});
  });
  const page=await context.newPage();activePage=page;
  page.on("pageerror",error=>summary.consoleErrors.push(error.message));
  try{
    await page.goto(base+"/designer-studio",{waitUntil:"domcontentloaded"});
    await page.locator(".newDesignerFabricSearch").first().waitFor({state:"visible",timeout:20000});
    await page.locator(".brandIntro").waitFor({state:"hidden",timeout:20000});
    // 16/50+ actual supplier records, not a made-up 10-row selector.
    const shirt=input(page,"#designer-shirt"),pant=input(page,"#designer-pant");
    const initialShirt=await shirt.inputValue(),initialPant=await pant.inputValue();
    assert.ok(initialShirt&&initialPant);
    const allShirts=await shirt.locator("option").count();
    const allPants=await pant.locator("option").count();
    assert.ok(allShirts>=30,`Missing real shirt stock: ${allShirts}`);
    assert.ok(allPants>=10,`Missing real trouser stock: ${allPants}`);
    const visibleStart=await page.locator(".newDesignerFabricChoices").first().locator("button").count();
    assert.ok(visibleStart<=8 && visibleStart>0,`Swatches must be progressive, got ${visibleStart}`);
    // Changing filters/search terms must NEVER silently replace a locked
    // shirt or trouser, including when the selected item is outside results.
    const shirtSearch=input(page,"#designer-shirt-search");
    await shirtSearch.fill("NO SUCH INVENTORY 2026");
    await page.locator(".newDesignerFabricNoMatch").filter({hasText:"No matching shirt fabrics."}).waitFor({state:"visible"});
    assert.equal(await shirt.inputValue(),initialShirt);
    assert.equal(await pant.inputValue(),initialPant);
    assert.ok((await shirt.locator("option").allTextContents()).some(t=>t.includes("outside filter")));
    await page.getByRole("button",{name:"Clear search"}).first().click();
    assert.equal(await shirtSearch.inputValue(),"");
    assert.equal(await shirt.inputValue(),initialShirt);
    const pantSearch=input(page,"#designer-pant-search");
    await pantSearch.fill("NO SUCH TROUSER INVENTORY 2026");
    await page.locator(".newDesignerFabricNoMatch").filter({hasText:"No matching trouser fabrics."}).waitFor({state:"visible"});
    assert.equal(await pant.inputValue(),initialPant);
    assert.equal(await shirt.inputValue(),initialShirt);
    await page.getByRole("button",{name:"Clear search"}).last().click();
    assert.equal(await pantSearch.inputValue(),"");
    // Real user selects a category: counts remain consistent with displayed
    // options and the previously chosen garment is still preserved.
    const shirtFilters=page.getByRole("group",{name:"Filter shirt fabrics"});
    const formalFilter=page.getByRole("button",{name:/^Formal \d+/}).first();
    await formalFilter.click();
    assert.equal(await shirt.inputValue(),initialShirt);
    assert.equal(await pant.inputValue(),initialPant);
    const formalText=(await formalFilter.innerText()).trim();
    const formalCount=Number(formalText.match(/(\d+)$/)?.[1]||NaN);
    assert.ok(Number.isInteger(formalCount)&&formalCount>0);
    const optionCount=await shirt.locator("option").count();
    assert.ok(optionCount===formalCount||optionCount===formalCount+1,
      `Selected outside filter needs one extra visible option; options ${optionCount} vs ${formalCount}`);
    await page.getByRole("button",{name:/^All \d+/}).first().click();
    assert.equal(await shirt.inputValue(),initialShirt);
    assert.ok(await page.locator(".newDesignerFabricEvidence").count()>=2);
    assert.ok((await page.locator(".newDesignerFabricEvidence").allTextContents())
      .some(t=>t.includes("Scale not measured")));
    // Advanced tailoring must survive a REAL click, preserve valid legacy
    // photo controls and be sent to the *server* as stable canonical v2 IDs.
    const precision=page.locator(".newDesignerPrecisionCut");
    await precision.locator("summary").click();
    await page.getByRole("combobox",{name:"Sleeve length"}).selectOption("half_sleeve");
    await page.getByRole("combobox",{name:"Cuff construction"}).selectOption("open_short_hem_cuff");
    await page.getByRole("combobox",{name:"Trouser leg shape"}).selectOption("korean_straight_wide");
    assert.equal(await page.locator('select[aria-label="Shirt cuff"]').inputValue(),"Barrel Cuff (1-button)");
    await page.getByRole("button",{name:/Check this look/}).click();
    await page.waitForTimeout(100);
    assert.equal(capturedAssessments.length,1,"A real customer cut must reach the assessment API once");
    const submitted=capturedAssessments[0];
    assert.equal(submitted.styleSpec.shirt.sleeve,"half_sleeve");
    assert.equal(submitted.styleSpec.shirt.cuff,"open_short_hem_cuff");
    assert.equal(submitted.styleSpec.pant.fit,"korean_straight_wide");
    assert.equal(submitted.style.cuff,"Barrel Cuff (1-button)","Legacy photo preview stays a supported style");
    await page.screenshot({path:path.join(output,`designer-discovery-${width}.png`),fullPage:true});
    summary.devices.push({width,initialShirt,initialPant,shirtStock:allShirts,
      pantStock:allPants,initialVisibleShirts:visibleStart,
      formalCount,selectionStable:true,unverifiedScalePresented:true,
      advancedCutServerRoundTrip:true});
  }finally{await context.close();}
}

(async()=>{
  await fs.mkdir(output,{recursive:true});
  browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  await testViewport(390);
  await testViewport(1440);
  assert.equal(summary.paidCalls,0,"Fabric discovery must never invoke paid render API");
  assert.deepEqual(summary.consoleErrors,[],"No browser errors accepted");
  console.log("Deep Engine actual responsive fabric discovery verified. No supplier/drape approval claimed.");
})().catch(async e=>{
  summary.failure=e.stack||String(e);console.error(summary.failure);process.exitCode=1;
  if(activePage&&!activePage.isClosed())
    await activePage.screenshot({path:path.join(output,"failure.png"),fullPage:true}).catch(()=>{});
}).finally(async()=>{
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,"summary.json"),JSON.stringify(summary,null,2)+"\n");
  if(browser)await browser.close();
});
