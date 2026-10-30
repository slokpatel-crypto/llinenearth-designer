// Designer Studio's full visible option-selection browser matrix. Uses the
// original photographed model, real local fabric tiles and no paid render API.
// This is functional/visual evidence, NOT approval of unphotographed cuts.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createRequire}=require("node:module");
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
if(!runtime)throw Error("Set LINEN_BROWSER_QA_RUNTIME to a Playwright installation.");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const base=process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000";
const output=path.resolve("artifacts/preview-lifecycle/designer-option-accuracy");
const groups=[
  ["shirtWear","Shirt finish"],
  ["collar","Shirt collar"],
  ["cuff","Shirt cuff"],
  ["placket","Shirt placket"],
  ["trouser","Trouser shape"],
];
const summary={browser:"Chromium",originalModelOnly:true,physicalAcceptance:false,paidCalls:0,groups:{},responsive:[],errors:[],actualOptionChecks:0};
let browser,page;
async function ready(){
  await page.locator('.newDesignerPhotoStage[data-ready="true"]').waitFor({timeout:30000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator(".newDesignerPhotoError").count(),0);
}
async function change(label,value){
  await page.locator('select[aria-label="'+label+'"]').selectOption(value);
  await ready();
}
async function pixelSignature(){
  return page.locator(".newDesignerPhotoStage canvas").first().evaluate(canvas=>{
    const ctx=canvas.getContext("2d"),{width,height}=canvas;
    // Sample the *real* canvas, not control state or a synthetic illustration.
    const rgba=ctx.getImageData(0,0,width,height).data;
    let hash=2166136261>>>0;
    for(let y=180;y<height-100;y+=29)for(let x=235;x<width-235;x+=19){
      const i=(y*width+x)*4;
      for(let channel=0;channel<3;channel++){hash^=rgba[i+channel];hash=Math.imul(hash,16777619);}
    }
    return (hash>>>0).toString(16);
  });
}
async function matchCount(){
  const text=await page.locator(".newDesignerPhotoMatch p").innerText();
  const numbers=text.match(/(\d+)\/(\d+) selected details directly match/);
  assert(numbers,"missing truthful photo-match breakdown: "+text);
  return {exact:Number(numbers[1]),total:Number(numbers[2])};
}
async function screenshot(name){
  await page.locator(".newDesignerPhoto").screenshot({path:path.join(output,name+".png")});
}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  browser=await chromium.launch({headless:true});
  for(const width of [390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:1000}});
    page=await context.newPage();
    page.on("pageerror",error=>summary.errors.push(error.message));
    await context.route("**/api/**",route=>{
      const url=new URL(route.request().url()).pathname;
      if(/look-render|look-inspect|creative-render|creative-inspect/.test(url))summary.paidCalls++;
      return route.fulfill({status:200,json:url.includes("photo-calibration")?{verified:false}:{}});
    });
    await page.goto(base+"/designer-studio",{waitUntil:"networkidle"});
    await page.locator(".brandIntro").waitFor({state:"hidden"});
    await ready();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,"horizontal overflow at "+width);
    assert.equal(await page.locator(".newDesignerPhoto canvas").count()>0,true);
    await screenshot("original-model-"+width);
    const studio=page.locator(".newDesignerStyleBlock");
    await studio.locator("summary").first().click();
    const startingWear=await page.locator('select[aria-label="Shirt finish"]').inputValue();
    const startingTrouser=await page.locator('select[aria-label="Trouser shape"]').inputValue();
    const startPixels=await pixelSignature();
    const wear=startingWear==="Tucked"?"Untucked":"Tucked";
    await change("Shirt finish",wear);
    const wearPixels=await pixelSignature();
    assert.notEqual(wearPixels,startPixels,"tuck change must switch photographic silhouette at "+width);
    await screenshot("shirt-wear-"+wear.toLowerCase()+"-"+width);
    await change("Shirt finish","Untucked");
    await change("Trouser shape","Pleated Trouser");
    const pleatedPixels=await pixelSignature();
    await change("Trouser shape","Wide-leg / Relaxed Drape Trouser");
    const widePixels=await pixelSignature();
    assert.notEqual(pleatedPixels,widePixels,"untucked wide-leg must change photographed trousers at "+width);
    await screenshot("untucked-wide-"+width);
    summary.responsive.push({width,originalModel:true,overflow:false,tuckChangesPixels:wearPixels!==startPixels,wideChangesPixels:pleatedPixels!==widePixels});
    if(width===1440){
      // Exhaust every actual selectable value from the rendered customer UI.
      // This catches drift between the library and UI without a hard-coded count.
      for(const [key,label] of groups){
        const select=page.locator('select[aria-label="'+label+'"]');
        const values=await select.locator("option").evaluateAll(options=>options.filter(o=>!o.disabled).map(o=>o.value));
        assert.equal(new Set(values).size,values.length,"duplicate choices: "+label);
        assert(values.length>0,"empty choices: "+label);
        const records=[];
        for(const value of values){
          // Keep the widest trouser reference available for its own option.
          if(key==="trouser")await change("Shirt finish","Untucked");
          await change(label,value);
          const match=await matchCount();
          const pixels=await pixelSignature();
          assert(match.total>0 && match.exact<=match.total,"invalid preview count for "+key+"="+value);
          assert.equal(await select.inputValue(),value,"selected value reverted: "+key+"="+value);
          const filename=key+"-"+records.length;
          await screenshot(filename);
          records.push({option:value,exactCount:match.exact,total:match.total,pixelSignature:pixels,screenshot:filename+".png"});
          summary.actualOptionChecks++;
        }
        summary.groups[key]=records;
      }
      // Unphotographed collars, cuffs and plackets must not masquerade as
      // geometry changes: the accurate specification and limitation are visible.
      await change("Shirt finish","Untucked");
      await change("Trouser shape","Pleated Trouser");
      for(const [,label] of groups.filter(([key])=>["collar","cuff","placket"].includes(key))){
        const select=page.locator('select[aria-label="'+label+'"]');
        const values=await select.locator("option").evaluateAll(options=>options.map(o=>o.value));
        await change(label,values[0]);const first=await pixelSignature();
        await change(label,values[values.length-1]);const last=await pixelSignature();
        assert.equal(first,last,"unphotographed "+label+" changes must not fake a new photoreal cut");
      }
      // Actual context-aware wide-leg support: it is exact only when untucked.
      await change("Trouser shape","Wide-leg / Relaxed Drape Trouser");
      await change("Shirt finish","Untucked");const untucked=await matchCount();
      await change("Shirt finish","Tucked");const tucked=await matchCount();
      assert.equal(untucked.exact,tucked.exact+1,"tucked wide-leg should lose exact photo-match status");
      await screenshot("tucked-wide-is-not-exact");
      summary.contextualWideLeg={untuckedExact:untucked.exact,tuckedExact:tucked.exact};
    }
    await context.close();
  }
  assert.equal(summary.paidCalls,0,"no paid AI/provider calls permitted");
  assert.deepEqual(summary.errors,[],"no client-side exceptions permitted");
  fs.writeFileSync(path.join(output,"summary.json"),JSON.stringify(summary,null,2));
  console.log("PASS designer option browser matrix: "+summary.actualOptionChecks+" values, 3 viewport sizes, original model preserved, no paid calls.");
})().catch(async error=>{
  summary.errors.push(error.stack||String(error));
  if(page&&!page.isClosed())await page.screenshot({path:path.join(output,"failure.png"),fullPage:true}).catch(()=>{});
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,"summary.json"),JSON.stringify(summary,null,2));
  console.error(error);process.exitCode=1;
}).finally(async()=>{await browser?.close();});
