// Real Chromium + local photographs/Canvas. API fixtures preserve the current
// cut/base exactly, allowing pixel checks to isolate craft. No paid provider.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),{load}=require("./designer-test-loader.cjs");
const e=load("src/lib/designer/engine.ts"),c=load("src/lib/designer/creative-engine.ts"),s=load("src/lib/designer/creative-spec.ts"),p=load("src/lib/designer/photo-craft.ts");
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;if(!runtime)throw Error("Set LINEN_BROWSER_QA_RUNTIME");
const {chromium}=Module.createRequire(path.join(runtime,"package.json"))("playwright"),base=process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000",out=path.resolve("artifacts/preview-lifecycle/photo-craft");
const summary={browser:"Chromium",physicalAcceptance:false,paidCalls:0,viewports:[],placements:[],regressions:[],errors:[]};let browser,activePage;
async function frame(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function ready(page){await page.locator('.newDesignerPhotoStage[data-ready="true"]').waitFor();await frame(page);await page.locator('.newDesignerPhotoStage[data-ready="true"]').waitFor();}
async function snapshot(page,key){return page.locator(".newDesignerPhoto canvas").evaluate((canvas,key)=>{window.__craftPixels??={};window.__craftPixels[key]=canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data;},key);}
async function diff(page,key,areas){return page.locator(".newDesignerPhoto canvas").evaluate((canvas,{key,areas})=>{
  const before=window.__craftPixels[key],after=canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data;let changed=0,outside=0,left=0,right=0;
  for(let i=0;i<after.length;i+=4){if(after[i]===before[i]&&after[i+1]===before[i+1]&&after[i+2]===before[i+2])continue;
    changed++;const x=(i/4)%canvas.width,y=Math.floor(i/4/canvas.width);if(x<512)left++;else right++;
    if(!areas.some(a=>x>=a.x&&x<a.x+a.width&&y>=a.y&&y<a.y+a.height))outside++;
  }return {changed,outside,left,right};
},{key,areas});}
async function run(){fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({headless:true});
  for(const width of [390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true}),page=await context.newPage();activePage=page;let serial=0,latest,override={};
    page.on("pageerror",err=>summary.errors.push(err.message));page.on("console",m=>{if(m.type()==="error")summary.errors.push(m.text());});
    await context.route("**/api/**",async route=>{const req=route.request(),url=new URL(req.url()),b=req.postDataJSON()||{};
      if(/creative-render|creative-inspect|look-render|look-inspect/.test(url.pathname)){summary.paidCalls++;return route.fulfill({status:200,json:{}});}
      if(url.pathname==="/api/designer/creative-generate"){
        const shirt=e.DESIGNER_SHIRTS.find(f=>f.id===b.shirtId),pant=e.DESIGNER_PANTS.find(f=>f.id===b.pantId);
        const seed=c.generateCreativeDirections({shirt,pant,style:b.style,occasion:b.occasion,context:b.context,limit:1})[0];
        seed.id="creative:photo-qa:"+(++serial);seed.name="QA craft "+serial;seed.recommendation={...seed.recommendation,shirt,pant,style:b.style};seed.treatments=[];seed.pattern=undefined;
        latest=s.attachCreativeCraft([seed],{...b.craft,brief:""},e.DESIGNER_FABRICS.find(f=>f.id===b.craft.accentId))[0];
        if(latest.craft.decoration)Object.assign(latest.craft.decoration,override);
        return route.fulfill({status:200,json:{concepts:[latest]}});
      }
      return route.fulfill({status:200,json:url.pathname.includes("photo-calibration")?{verified:false}:{}});
    });
    await page.goto(base+"/designer-studio",{waitUntil:"networkidle"});await page.locator(".brandIntro").waitFor({state:"hidden"});await ready(page);
    const lab=page.locator("#designerCreativeLab");
    async function apply({zone="cuff",surface="plain",accent="",motif="line",extra={}}={}){
      override=extra;await lab.getByRole("combobox",{name:"Craft placement",exact:true}).selectOption(zone);
      await lab.getByRole("combobox",{name:"Accent fabric",exact:true}).selectOption(accent);
      await lab.getByRole("combobox",{name:"Craft surface",exact:true}).selectOption(surface);
      await lab.getByRole("combobox",{name:"Craft motif",exact:true}).selectOption(motif);
      const expected="QA craft "+(serial+1);await lab.getByRole("button",{name:"Create ideas ✦",exact:true}).click();await lab.getByText(expected,{exact:true}).waitFor();
      const first=lab.locator(".creativeCards article").first();await first.getByRole("button",{name:"Try this",exact:true}).click();await first.locator('button').filter({hasText:/^Selected$/}).waitFor();await ready(page);return latest;
    }
    await page.getByRole("combobox",{name:"Shirt finish",exact:true}).selectOption("Tucked");await ready(page);
    await apply();await snapshot(page,"base");
    const baseShirt=latest.recommendation.shirt.id,accent=e.DESIGNER_SHIRTS.find(f=>f.id!==baseShirt).id;
    const started=Date.now();const combined=await apply({surface:"embroidery",accent,motif:"leaf"});
    const check=await diff(page,"base",p.photoCraftZone("cuff",combined.recommendation.style).areas);
    assert.ok(check.changed>300,"real swatch + thread must be visible");assert.equal(check.outside,0,"craft cannot change skin/set/base cloth outside its zone");assert.ok(check.left>0&&check.right>0,"both cuffs show craft");
    assert.match(await page.locator(".newDesignerPhotoCreative").textContent(),/Craft placement is proposed/);
    assert.equal(await page.locator(".newDesignerPhotoCraftNote").isVisible(),true,"the sample/scale disclosure must be visibly readable");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`overflow at ${width}`);
    await page.locator(".newDesignerPhoto").screenshot({path:path.join(out,`model-craft-${width}.png`)});
    summary.viewports.push({width,overflow:false,applyMs:Date.now()-started,...check});
    if(width===1440){
      const patterned=e.DESIGNER_SHIRTS.find(f=>f.patternType.toLowerCase()!=="solid");assert.ok(patterned);
      await apply({surface:"plain",accent:patterned.id});
      const scaleNote=page.locator(".newDesignerPhoto>.newDesignerPhotoApproximation");
      assert.match(await scaleNote.textContent(),/pattern scale is still approximate/);
      assert.ok((await scaleNote.textContent()).includes(patterned.name));
      summary.regressions.push("unverified visible accent repeat cannot inherit verified base-cloth scale");
      for(const zone of s.CRAFT_ZONES){
        const direction=await apply({zone,surface:"thread"}),placement=p.photoCraftZone(zone,direction.recommendation.style),pixels=await diff(page,"base",placement.areas);
        assert.equal(pixels.outside,0,zone+" must remain clipped");assert.equal(pixels.changed>0,placement.status==="approximate",zone+" support disclosure must match pixels");summary.placements.push({zone,status:placement.status,...pixels});
      }
      for(const motif of s.CRAFT_MOTIFS){await apply({zone:"shirt-body",surface:"embroidery",motif});const pixels=await diff(page,"base",p.photoCraftZone("shirt-body",latest.recommendation.style).areas);assert.ok(pixels.changed>0);assert.equal(pixels.outside,0);await page.locator(".newDesignerPhoto canvas").screenshot({path:path.join(out,`motif-${motif}.png`)});}
      await apply({zone:"shirt-body",surface:"embroidery",motif:"diamond",extra:{stitch:"chain",coverage:3,repeatMm:10}});await snapshot(page,"quiet");
      await apply({zone:"shirt-body",surface:"embroidery",motif:"diamond",extra:{stitch:"satin",coverage:35,repeatMm:32}});assert.ok((await diff(page,"quiet",p.photoCraftZone("shirt-body",latest.recommendation.style).areas)).changed>0);summary.regressions.push("motifs, stitch treatment, density and repeat alter the local preview");
      await page.getByRole("combobox",{name:"Shirt finish",exact:true}).selectOption("Untucked");await ready(page);await apply();await snapshot(page,"untucked");
      for(const zone of ["collar","cuff","placket","shirt-body","waistband","pleat","trouser-leg"]){const d=await apply({zone,surface:"thread"}),placement=p.photoCraftZone(zone,d.recommendation.style),pixels=await diff(page,"untucked",placement.areas);assert.equal(pixels.outside,0);assert.equal(pixels.changed>0,placement.status==="approximate");}
      summary.regressions.push("untucked visible zones and hidden waistband/pleats match disclosed support");
      // Hold a previously unused accent tile across a new applied recipe. The
      // old image promise must not overwrite the newer committed canvas.
      const delayed=e.DESIGNER_SHIRTS.find(f=>f.id!==baseShirt&&f.id!==accent),stem=path.basename(delayed.image).replace(/\.webp$/,"");let held;
      await context.route(`**/fabric-tiles/${stem}.webp`,route=>{held=route;});
      override={};await lab.getByRole("combobox",{name:"Craft placement",exact:true}).selectOption("cuff");await lab.getByRole("combobox",{name:"Accent fabric",exact:true}).selectOption(delayed.id);await lab.getByRole("combobox",{name:"Craft surface",exact:true}).selectOption("plain");
      const expected="QA craft "+(serial+1);await lab.getByRole("button",{name:"Create ideas ✦",exact:true}).click();await lab.getByText(expected,{exact:true}).waitFor();await lab.locator(".creativeCards article").first().getByRole("button",{name:"Try this",exact:true}).click();
      for(let i=0;i<30&&!held;i++)await page.waitForTimeout(50);assert.ok(held,"accent image must still be in flight");
      assert.equal(await page.locator(".newDesignerPhoto").getByRole("button",{name:"Render selected idea ✦",exact:true}).isDisabled(),true,"pending cloth cannot be treated as a ready render");
      await apply({surface:"thread",motif:"wave"});await snapshot(page,"current");await held.continue();await page.waitForTimeout(250);assert.equal((await diff(page,"current",[])).changed,0,"late tile cannot overwrite current craft");summary.regressions.push("late accent image cannot repaint a newer design");
      const downloadPromise=page.waitForEvent("download");await page.locator(".newDesignerPhoto").getByRole("button",{name:"Save",exact:true}).click();const download=await downloadPromise;await download.saveAs(path.join(out,"selected-craft.png"));assert.ok(fs.statSync(path.join(out,"selected-craft.png")).size>10000);summary.regressions.push("Save includes deterministic applied craft with no provider request");
    }
    await context.close();
  }
  // Catalogue metadata arrives after the initial static preview. A replacement
  // reference under the same ID must replace the cached textile, not its name
  // alone. This stays an isolated fixture, never a production catalogue write.
  const catalogContext=await browser.newContext({viewport:{width:1440,height:1000}}),catalogPage=await catalogContext.newPage();activePage=catalogPage;let catalogue;
  catalogPage.on("pageerror",err=>summary.errors.push(err.message));catalogPage.on("console",m=>{if(m.type()==="error")summary.errors.push(m.text());});
  await catalogContext.route("**/api/**",async route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(pathname==="/api/designer/catalog"){catalogue=route;return;}
    if(/creative-render|creative-inspect|look-render|look-inspect/.test(pathname))summary.paidCalls++;
    return route.fulfill({status:200,json:pathname.includes("photo-calibration")?{verified:false}:{}});
  });
  await catalogPage.goto(base+"/designer-studio",{waitUntil:"domcontentloaded"});await catalogPage.locator(".brandIntro").waitFor({state:"hidden"});await ready(catalogPage);assert.ok(catalogue);await snapshot(catalogPage,"original-reference");
  const old=e.DESIGNER_SHIRTS.find(f=>f.id===e.DESIGNER_REVIEWED_PAIRING.shirtId),replacement=e.DESIGNER_SHIRTS.find(f=>f.id!==old.id),updated={...old,image:replacement.image,hex:replacement.hex,patternType:replacement.patternType};
  await catalogue.fulfill({status:200,json:{shirts:e.DESIGNER_SHIRTS.map(f=>f.id===old.id?updated:f),pants:e.DESIGNER_PANTS}});
  await catalogPage.waitForFunction(src=>document.querySelector(".newDesignerHeroFabric img")?.getAttribute("src")===src,replacement.image);await ready(catalogPage);
  const replacementPixels=await diff(catalogPage,"original-reference",[{x:277,y:173,width:462,height:543}]);assert.ok(replacementPixels.changed>50000,"new real reference must replace the old tile under the same ID");assert.equal(replacementPixels.outside,0,"reference update preserves model skin and set");
  summary.regressions.push("same-ID reference replacement refreshes cached textile while preserving model/set");await catalogContext.close();
  assert.equal(summary.paidCalls,0);assert.deepEqual(summary.errors,[]);fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(summary,null,2));console.log(`Photographic craft passed: ${summary.viewports.length} widths, ${summary.placements.length} zones, ${summary.regressions.length} regressions, zero paid calls.`);
}
run().catch(async error=>{summary.errors.push(error.stack||String(error));fs.mkdirSync(out,{recursive:true});if(activePage&&!activePage.isClosed())await activePage.screenshot({path:path.join(out,"failure.png"),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(summary,null,2));console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();});
