// Actual exported compositors, real photographs and Chromium Canvas. The old
// release is the baseline; uniform colour controls isolate shape from weave.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),ts=require("typescript"),{execFileSync}=require("node:child_process");
const BASE="5126ebb6f82179b7fe25106e71f234248af3a677",component="src/components/PhotoOutfitPreview.tsx";
function bundle(revision){
  const modules=new Map();
  // Generated tiles are identical inputs for both renderers; the generator
  // and scale evidence are unchanged by this correction.
  const read=file=>revision&&!file.startsWith("public/fabric-tiles/")?execFileSync("git",["show",`${revision}:${file}`],{encoding:"utf8",maxBuffer:8e6,stdio:["ignore","pipe","pipe"]}):fs.readFileSync(file,"utf8");
  function resolve(from,request){
    const stem=request.startsWith("@/")?path.posix.join("src",request.slice(2)):request.startsWith(".")?path.posix.normalize(path.posix.join(path.posix.dirname(from),request)):null;
    if(!stem)throw Error("Unexpected non-browser compositor import: "+request);
    for(const file of [stem,stem+".ts",stem+".tsx",stem+".json"])try{read(file);return file;}catch{}
    throw Error("Missing compositor dependency "+request);
  }
  function add(file){
    if(modules.has(file))return;
    let source=read(file);if(file===component)source=source.slice(0,source.indexOf("export function StyleDirectorRealModelPreview"));
    const code=file.endsWith(".json")?"module.exports="+source+";":ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    const mapping={};modules.set(file,{code,mapping});
    for(const m of code.matchAll(/require\("([^"]+)"\)/g)){const dependency=resolve(file,m[1]);mapping[m[1]]=dependency;add(dependency);}
  }
  add(component);add("src/lib/designer/engine.ts");
  return `(()=>{const modules={${[...modules].map(([file,{code,mapping}])=>`${JSON.stringify(file)}:[function(module,exports,require){${code}\n},${JSON.stringify(mapping)}]`).join(",")}},cache={};function load(file){if(cache[file])return cache[file].exports;const module={exports:{}};cache[file]=module;const [run,mapping]=modules[file];run(module,module.exports,request=>load(mapping[request]));return module.exports;}return {compose:load(${JSON.stringify(component)}).composePhotoOutfit,engine:load("src/lib/designer/engine.ts")};})()`;
}
const beforeBundle=bundle(BASE),afterBundle=bundle();
if(process.argv.includes("--bundle-only")){console.log(`Photo-form test bundles valid: baseline ${beforeBundle.length} bytes, current ${afterBundle.length} bytes.`);process.exit(0);}
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;if(!runtime)throw Error("Set LINEN_BROWSER_QA_RUNTIME");
const {chromium}=Module.createRequire(path.join(runtime,"package.json"))("playwright"),base=process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000",out=path.resolve("artifacts/preview-lifecycle/photo-form");
const summary={baseline:BASE,browser:"Chromium",physicalAcceptance:false,paidCalls:0,viewports:[],forms:[],errors:[]};let browser,activePage;
async function ready(page){await page.locator('.newDesignerPhotoStage[data-ready="true"]').waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.locator('.newDesignerPhotoStage[data-ready="true"]').waitFor();}
async function actualPhotoPixelHash(page) {
  return page.locator(".newDesignerPhotoStage>canvas").evaluate(canvas=>{
    const context=canvas.getContext("2d");
    if(!context)throw Error("Studio 2D canvas unavailable");
    const bytes=context.getImageData(0,0,canvas.width,canvas.height).data;
    // Fixed sample stride and two channels. Detect changed pixels without
    // shipping the whole image over Playwright transport.
    let hash=2166136261;
    for(let i=0;i<bytes.length;i+=16){
      hash=Math.imul(hash^bytes[i],16777619)>>>0;
      hash=Math.imul(hash^bytes[i+1],16777619)>>>0;
      hash=Math.imul(hash^bytes[i+2],16777619)>>>0;
    }
    return hash;
  });
}
async function run(){
  fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({headless:true});
  for(const width of [390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();activePage=page;
    page.on("pageerror",err=>summary.errors.push(err.message));page.on("console",m=>{if(m.type()==="error")summary.errors.push(m.text());});
    await context.route("**/api/**",route=>{const name=new URL(route.request().url()).pathname;if(/look-render|look-inspect|creative-render|creative-inspect/.test(name))summary.paidCalls++;return route.fulfill({status:200,json:name.includes("photo-calibration")?{verified:false}:{}});});
    await page.goto(base+"/designer-studio",{waitUntil:"networkidle"});await page.locator(".brandIntro").waitFor({state:"hidden"});await ready(page);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    const dark=await page.locator("#designer-shirt option").evaluateAll(options=>options.find(o=>/Black - Jute Feel/.test(o.textContent))?.value);assert.ok(dark);
    await page.locator("#designer-shirt").selectOption(dark);await ready(page);
    await page.locator(".newDesignerPhoto").screenshot({path:path.join(out,`dark-tucked-${width}.png`)});
    // Source comparison must explain whose garment photograph is being shown
    // before the photo, rather than presenting an unrendered design as source.
    await page.getByRole("button",{name:"Compare",exact:true}).click();
    const initialSourceNote=page.locator('.newDesignerPhoto > [data-photo-source-comparison="studio"]');
    await initialSourceNote.waitFor();
    assert.match(await initialSourceNote.textContent(),/original unchanged studio photograph/i);
    assert.equal(await page.locator('[data-photo-construction-mismatch="true"]').count(),0);
    assert.match(await page.locator(".newDesignerPhotoTag").textContent(),/SOURCE \/ STUDIO PHOTO/);
    await page.locator(".newDesignerPhoto").screenshot({path:path.join(out,`studio-source-compared-${width}.png`)});
    await page.getByRole("button",{name:"Show design",exact:true}).click();
    assert.equal(await initialSourceNote.count(),0);
    // Real-photo screenshot gates at each required responsive width. No paid
    // rendering service or replacement model is involved.
    await page.getByRole("combobox",{name:"Shirt finish",exact:true}).selectOption("Untucked");
    await ready(page);
    // The source untucked photograph has a curved shirttail, whereas the
    // selected versioned shirt can request a straight hem. Never claim a photo
    // reconstruction that did not happen; verify the warning in real Chromium.
    const fidelity=page.locator('[data-photo-construction-mismatch="true"]');
    await fidelity.waitFor();
    assert.match(await fidelity.textContent(),/shirt hem/i);
    // A fixed-position contact bar can overlap lower explanations on narrow
    // screens. The on-photo status must still disclose approximation upfront.
    assert.match(await page.locator(".newDesignerPhotoTag").textContent(),/CUTS APPROX\./);
    await page.locator(".newDesignerPhoto").screenshot({path:path.join(out,`dark-untucked-${width}.png`)});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    summary.viewports.push({width,overflow:false,realCataloguePreview:true,tuckedAndUntuckedScreenshots:true});
    // Exercise the ACTUAL customer controls, not just pure IDs. Advanced v2
    // sleeve/pleat specifications may be valid tailor instructions while the
    // original fixed photograph continues to show full sleeves/single pleats.
    const beforeSpecOnlyPixels=await actualPhotoPixelHash(page);
    const precision=page.locator("details.newDesignerPrecisionCut");
    await precision.locator("summary").click();
    await page.getByRole("combobox",{name:"Sleeve length",exact:true}).selectOption("half_sleeve");
    await page.waitForFunction(()=>document.querySelector('[data-photo-construction-mismatch="true"]')?.textContent?.includes("sleeve length"));
    await page.getByRole("combobox",{name:"Trouser pleats",exact:true}).selectOption("double_pleat_forward");
    await page.waitForFunction(()=>document.querySelector('[data-photo-construction-mismatch="true"]')?.textContent?.includes("trouser pleats"));
    const advancedNote=await fidelity.textContent();
    assert.match(advancedNote,/sleeve length/i);
    assert.match(advancedNote,/trouser pleats/i);
    assert.equal(await page.getByRole("combobox",{name:"Sleeve length",exact:true}).inputValue(),"half_sleeve");
    assert.equal(await page.getByRole("combobox",{name:"Trouser pleats",exact:true}).inputValue(),"double_pleat_forward");
    await ready(page);
    assert.equal(await actualPhotoPixelHash(page),beforeSpecOnlyPixels,
      "advanced spec-only sleeve/pleat options must not repaint the fixed real photo as if new geometry existed");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    await page.locator(".newDesignerPhoto").screenshot({path:path.join(out,`advanced-construction-disclosed-${width}.png`)});
    summary.viewports[summary.viewports.length-1].advancedConstructionDisclosed=true;
    summary.viewports[summary.viewports.length-1].specOnlyPhotoPixelsUnchanged=true;
    // Changing selected buttons is specification-only, never photo reconstruction.
    const cutDrawer=page.locator("details.newDesignerTechnicalDrawer").filter({has:page.locator("summary",{hasText:"More cut options"})});
    if(!(await cutDrawer.evaluate(element=>element.open)))await cutDrawer.locator("summary").click();
    await page.getByRole("combobox",{name:"Button material",exact:true}).selectOption("Mother-of-Pearl");
    await page.waitForFunction(()=>document.querySelector('[data-photo-construction-mismatch="true"]')?.textContent?.includes("button material"));
    assert.equal(await page.getByRole("combobox",{name:"Button material",exact:true}).inputValue(),"Mother-of-Pearl");
    await ready(page);
    assert.equal(await actualPhotoPixelHash(page),beforeSpecOnlyPixels,
      "button material must not repaint photographic buttons as if new geometry existed");
    // The fixed contact dock used to cover the construction explanation at the
    // bottom of the photographic card. Its full text must now be visible above
    // the source image, without requiring a customer to dodge fixed controls.
    const notice=page.locator('.newDesignerPhoto > [data-photo-construction-mismatch="true"]');
    assert.equal(await notice.count(),1);
    await notice.scrollIntoViewIfNeeded();
    const noticeBox=await notice.boundingBox();
    const contactDock=page.locator(".floatingContactDock");
    const dockBox=await contactDock.boundingBox();
    assert.ok(noticeBox && noticeBox.width>0 && noticeBox.height>0,"construction notice must be visible");
    const viewport=page.viewportSize();
    assert.ok(viewport && noticeBox.y>=0 && noticeBox.y+noticeBox.height<=viewport.height,
      "construction notice must fit vertically within the visible viewport");
    if(dockBox){
      const overlap=noticeBox.x<dockBox.x+dockBox.width && noticeBox.x+noticeBox.width>dockBox.x
        && noticeBox.y<dockBox.y+dockBox.height && noticeBox.y+noticeBox.height>dockBox.y;
      assert.equal(overlap,false,"fixed contact dock must not obscure construction notice");
    }
    assert.match(await notice.textContent(),/button material/);
    await page.locator(".newDesignerPhoto").screenshot({path:path.join(out,`construction-notice-readable-${width}.png`)});
    await page.locator(".newDesignerPhoto").screenshot({path:path.join(out,`button-material-disclosed-${width}.png`)});
    summary.viewports[summary.viewports.length-1].buttonMaterialDisclosed=true;
    summary.viewports[summary.viewports.length-1].constructionNoticeUnobstructed=true;
    if(width===1440) {
      // Legacy controls also must not claim that unphotographed collar,
      // cuff or placket geometry has appeared in the trusted source image.
      await page.getByRole("combobox",{name:"Shirt collar",exact:true}).selectOption("Mandarin / Band Collar");
      await page.waitForFunction(()=>document.querySelector('[data-photo-construction-mismatch="true"]')?.textContent?.includes("collar shape"));
      if(!(await cutDrawer.evaluate(element=>element.open)))await cutDrawer.locator("summary").click();
      await page.getByRole("combobox",{name:"Shirt cuff",exact:true}).selectOption("French / Double Cuff");
      await page.getByRole("combobox",{name:"Shirt placket",exact:true}).selectOption("Hidden / Fly-front");
      await page.waitForFunction(()=> {
        const text=document.querySelector('[data-photo-construction-mismatch="true"]')?.textContent||"";
        return text.includes("collar shape") && text.includes("cuff shape") && text.includes("placket");
      });
      await page.locator(".newDesignerPhoto").screenshot({path:path.join(out,"collar-cuff-placket-disclosed-1440.png")});
      summary.viewports[summary.viewports.length-1].collarCuffPlacketDisclosed=true;
    }
    if(width===1440){
      await page.addScriptTag({content:`window.__photoFormBefore=${beforeBundle};window.__photoFormAfter=${afterBundle};`});
      summary.forms=await page.evaluate(async()=>{
        const results=[],W=1024,H=1536;
        const image=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
        const makeCanvas=()=>{const c=document.createElement("canvas");c.width=W;c.height=H;return c;};
        const control=document.createElement("canvas");control.width=control.height=64;const cc=control.getContext("2d");cc.fillStyle="#b46d58";cc.fillRect(0,0,64,64);const shirtImage=await image(control.toDataURL());cc.fillStyle="#b9afa0";cc.fillRect(0,0,64,64);const pantImage=await image(control.toDataURL());
        const engine=window.__photoFormAfter.engine,shirt={...engine.DESIGNER_SHIRTS[0],image:"/qa-solid-shirt.png",hex:"#b46d58",patternType:"Solid",renderScale:undefined},pant={...engine.DESIGNER_PANTS[0],image:"/qa-solid-pant.png",hex:"#b9afa0",patternType:"Solid",renderScale:undefined};
        // Synthetic stripe TEST TILE only; it is never shown as a customer
        // fabric or passed to a provider. Actual mannequin images stay intact.
        // Use a full-size QA textile tile: swatchTile crops/expands stripes.
        // A 64px fixture stretches three bands across an entire trouser leg
        // and could "pass" even when real stripe alternation is absent.
        control.width=control.height=320;
        cc.fillStyle="#efeee2";cc.fillRect(0,0,320,320);
        for(let x=0;x<320;x+=8){cc.fillStyle="#17485b";cc.fillRect(x,0,3,320);}
        const stripedImage=await image(control.toDataURL());
        const stripedFabric={...shirt,image:"/qa-stripe.png",patternType:"Pin Stripe",patternScale:"Fine",renderScale:undefined};
        const stripedPant={...pant,image:"/qa-stripe-pant.png",patternType:"Pin Stripe",patternScale:"Fine",renderScale:undefined};
        const style={collar:"Point (Standard) Collar",collarFinish:"Self-fabric",cuff:"Barrel Cuff (1-button)",placket:"Standard (visible stitch)",shirtFit:"Regular / Classic Fit",shirtWear:"Tucked",trouser:"Pleated Trouser",rise:"Mid Rise",waistband:"Belt Loops",break:"Slight Break",button:"Plastic / Resin"};
        function stats(source,render,box,limit){let count=0,sx=0,sy=0,sxx=0,sxy=0;for(let y=box.y;y<box.y+box.h;y+=2)for(let x=box.x;x<box.x+box.w;x+=2){const i=(y*W+x)*4;if(Math.max(source[i],source[i+1],source[i+2])>limit)continue;const a=.2126*source[i]+.7152*source[i+1]+.0722*source[i+2],b=.2126*render[i]+.7152*render[i+1]+.0722*render[i+2];count++;sx+=a;sy+=b;sxx+=a*a;sxy+=a*b;}return {count,slope:(sxy-sx*sy/count)/(sxx-sx*sx/count)};}
        window.__photoFormImages={};
        for(const template of ["tucked","pleated","wide"]){
          const model=await image(`/designer/studio-${template==="tucked"?"tucked":"pleated"}.webp`),trouser=await image(`/designer/studio-${template}.webp`),selected={...style,shirtWear:template==="tucked"?"Tucked":"Untucked",trouser:template==="wide"?"Wide-leg / Relaxed Drape Trouser":"Pleated Trouser"};
          const source=makeCanvas(),before=makeCanvas(),after=makeCanvas();source.getContext("2d").drawImage(model,0,0);const raw=source.getContext("2d").getImageData(0,0,W,H).data;
          window.__photoFormBefore.compose(before.getContext("2d"),model,trouser,shirtImage,pantImage,shirt,pant,selected);
          const start=performance.now();window.__photoFormAfter.compose(after.getContext("2d"),model,trouser,shirtImage,pantImage,shirt,pant,selected);const renderMs=performance.now()-start;
          const old=before.getContext("2d").getImageData(0,0,W,H).data,current=after.getContext("2d").getImageData(0,0,W,H).data;
          const regions=[{name:"body",x:397,y:280,w:220,h:235,limit:165},{name:"left sleeve",x:298,y:350,w:61,h:270,limit:165},{name:"right sleeve",x:672,y:350,w:44,h:270,limit:165}];
          const legSource=makeCanvas();legSource.getContext("2d").drawImage(trouser,0,0);const legRaw=legSource.getContext("2d").getImageData(0,0,W,H).data;
          regions.push({name:"left leg",x:389,y:800,w:61,h:480,limit:225},{name:"right leg",x:575,y:800,w:57,h:480,limit:225});
          const folds=regions.map(region=>{const original=region.name.includes("leg")?legRaw:raw;return {name:region.name,before:stats(original,old,region,region.limit),after:stats(original,current,region,region.limit)};});
          const protectedRegions=[{x:350,y:0,w:325,h:155},{x:282,y:716,w:55,h:95},{x:672,y:716,w:51,h:95},{x:505,y:1010,w:17,h:270},{x:0,y:1400,w:W,h:136}];let protectedChanges=0;
          // Wide trousers intentionally come from the alternate photograph;
          // compare hands/head/center gap/floor, which remain the base model.
          for(const r of protectedRegions)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){const i=(y*W+x)*4;if(current[i]!==raw[i]||current[i+1]!==raw[i+1]||current[i+2]!==raw[i+2])protectedChanges++;}
          // This photographed source has cool shirt and warm trousers. Find
          // their actual edge on each column instead of assuming a flat waist.
          let wrongWaistPixels=0;const waistExamples=[];
          if(template==="tucked")for(let y=537;y<566;y++)for(let x=405;x<610;x++){
            const i=(y*W+x)*4,r=raw[i],g=raw[i+1],b=raw[i+2];
            if(g-r>=2&&b-r>=3&&Math.max(r,g,b)<130&&current[i]<current[i+1]*1.15){wrongWaistPixels++;if(waistExamples.length<20)waistExamples.push({x,y,source:[r,g,b],render:[current[i],current[i+1],current[i+2]]});}
          }
          const display=makeCanvas();display.width=W*2;display.getContext("2d").drawImage(before,0,0);display.getContext("2d").drawImage(after,W,0);
          // Pixel regression using the real fixed photographs: striping must
          // paint BOTH a body panel and an angled sleeve, not a blank overlay.
          const striped=makeCanvas();
          window.__photoFormAfter.compose(striped.getContext("2d"),model,trouser,stripedImage,pantImage,stripedFabric,pant,selected);
          const stripeData=striped.getContext("2d").getImageData(0,0,W,H).data;
          // The previous visual suite used a stripe SHIRT with solid trousers.
          // Exercise each photographed trouser cut with real browser pixels too:
          // a bad per-leg canvas transform must not silently pass unit tests.
          const pantStriped=makeCanvas();
          window.__photoFormAfter.compose(pantStriped.getContext("2d"),model,trouser,shirtImage,stripedImage,shirt,stripedPant,selected);
          const pantStripeData=pantStriped.getContext("2d").getImageData(0,0,W,H).data;
          function changes(pixels,box){
            let count=0;
            for(let y=box.y;y<box.y+box.h;y+=4)for(let x=box.x;x<box.x+box.w;x+=4){
              const i=(y*W+x)*4;
              if(Math.abs(pixels[i]-current[i])+Math.abs(pixels[i+1]-current[i+1])+Math.abs(pixels[i+2]-current[i+2])>15)count++;
            }
            return count;
          }
          const stripeBody=changes(stripeData,{x:414,y:310,w:180,h:176});
          const stripeSleeve=changes(stripeData,{x:307,y:356,w:38,h:190});
          const pantStripeLeft=changes(pantStripeData,{x:389,y:800,w:61,h:480});
          const pantStripeRight=changes(pantStripeData,{x:575,y:800,w:57,h:480});
          // Detect actual dark-blue textile bands, not merely a different
          // uniform dye from the solid control. Each photographed leg must
          // display the QA weave's alternating stripe colour.
          function blueStripePixels(box){
            let count=0;
            for(let y=box.y;y<box.y+box.h;y+=4)for(let x=box.x;x<box.x+box.w;x+=2){
              const i=(y*W+x)*4,r=pantStripeData[i],g=pantStripeData[i+1],b=pantStripeData[i+2];
              if(b>r+15&&b>g+8)count++;
            }
            return count;
          }
          const pantStripeLeftBlue=blueStripePixels({x:389,y:800,w:61,h:480});
          const pantStripeRightBlue=blueStripePixels({x:575,y:800,w:57,h:480});
          let protectedPantChanges=0;
          for(const r of protectedRegions)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){
            const i=(y*W+x)*4;
            if(pantStripeData[i]!==current[i]||pantStripeData[i+1]!==current[i+1]||pantStripeData[i+2]!==current[i+2])protectedPantChanges++;
          }
          const stripeCanvas=makeCanvas();stripeCanvas.width=W*2;
          stripeCanvas.getContext("2d").drawImage(after,0,0);
          stripeCanvas.getContext("2d").drawImage(striped,W,0);
          const pantStripeCanvas=makeCanvas();pantStripeCanvas.width=W*2;
          pantStripeCanvas.getContext("2d").drawImage(after,0,0);
          pantStripeCanvas.getContext("2d").drawImage(pantStriped,W,0);
          window.__photoFormImages["stripe-"+template]=stripeCanvas.toDataURL("image/png");
          window.__photoFormImages["pant-stripe-"+template]=pantStripeCanvas.toDataURL("image/png");
          window.__photoFormImages[template]=display.toDataURL("image/png");
          results.push({template,renderMs,folds,protectedChanges,protectedPantChanges,wrongWaistPixels,waistExamples,stripeBody,stripeSleeve,pantStripeLeft,pantStripeRight,pantStripeLeftBlue,pantStripeRightBlue});
        }return results;
      });
      for(const result of summary.forms){
        for(const name of [result.template,"stripe-"+result.template,"pant-stripe-"+result.template]){
          await page.evaluate(name=>{const image=document.createElement("img");image.id="photo-form-comparison";image.src=window.__photoFormImages[name];image.style.width="1024px";document.body.append(image);},name);
          await page.locator("#photo-form-comparison").screenshot({path:path.join(out,`before-after-${name}.png`)});
          await page.locator("#photo-form-comparison").evaluate(image=>image.remove());
        }
      }
      for(const result of summary.forms){
        assert.equal(result.protectedChanges,0,result.template+" must preserve skin, shoes, inner-leg gap and set");
        assert.equal(result.wrongWaistPixels,0,"source shirting must stay fully covered at the tucked waist");
        assert.ok(result.stripeBody>400,result.template+" photo body must render the selected striped tile");
        assert.ok(result.stripeSleeve>50,result.template+" photo sleeve must render the selected striped tile");
        assert.ok(result.pantStripeLeft>50,result.template+" left trouser must render the selected striped cloth");
        assert.ok(result.pantStripeRight>50,result.template+" right trouser must render the selected striped cloth");
        assert.ok(result.pantStripeLeftBlue>40,result.template+" left trouser must retain visibly blue stripe bands");
        assert.ok(result.pantStripeRightBlue>40,result.template+" right trouser must retain visibly blue stripe bands");
        assert.equal(result.protectedPantChanges,0,result.template+" striped trousers must preserve skin, shoes, inner-leg gap and set");
        for(const fold of result.folds)assert.ok(fold.after.slope>fold.before.slope*1.15,`${result.template} ${fold.name}: depicted fold contrast must improve, ${fold.before.slope} -> ${fold.after.slope}`);
      }
      await page.getByRole("combobox",{name:"Shirt finish",exact:true}).selectOption("Untucked");await ready(page);await page.locator(".newDesignerPhoto").screenshot({path:path.join(out,"real-untucked.png")});
    }
    // Customer Compare must display the photographed wide trouser SOURCE,
    // not an unrelated pleated/straight-leg source image. The source note
    // makes clear that the shirt is composed from the pleated studio photo.
    await page.getByRole("combobox",{name:"Shirt finish",exact:true}).selectOption("Untucked");
    await page.getByRole("combobox",{name:"Trouser shape",exact:true}).selectOption("Wide-leg / Relaxed Drape Trouser");
    await ready(page);
    // These contours annotate only the deterministic Canvas garment masks.
    // They must never be overlaid on a raw source photograph or final photoreal.
    const previewTools=page.locator("details.newDesignerPreviewTools");
    if(!(await previewTools.evaluate(element=>element.open)))await previewTools.locator("summary").click();
    await page.getByRole("button",{name:"Boundary QA",exact:true}).click();
    assert.equal(await page.locator(".newDesignerBoundaryQa").count(),1,
      "boundary QA must annotate the live deterministic selected-design preview");
    // Zoom Fit changes Canvas scale; the diagnostic outline must follow the
    // exact same affine transform or the on-screen contours point at wrong seams.
    await page.getByRole("button",{name:"Zoom fit",exact:true}).click();
    await page.waitForTimeout(400);
    const zoomTransforms=await page.locator(".newDesignerPhotoStage").evaluate(stage=>{
      const photo=stage.querySelector("canvas"),boundary=stage.querySelector("svg.newDesignerBoundaryQa");
      const c=getComputedStyle(photo),b=getComputedStyle(boundary);
      return {canvas:c.transform,boundary:b.transform,canvasOrigin:c.transformOrigin,boundaryOrigin:b.transformOrigin};
    });
    assert.notEqual(zoomTransforms.canvas,"none");
    assert.equal(zoomTransforms.boundary,zoomTransforms.canvas,"Zoom Fit outlines must follow photographed garment scale");
    assert.equal(zoomTransforms.boundaryOrigin,zoomTransforms.canvasOrigin,"Zoom Fit origins must match source photo");
    await page.getByRole("button",{name:"Full view",exact:true}).click();
    await page.waitForTimeout(400);
    await page.getByRole("button",{name:"Compare",exact:true}).click();
    assert.equal(await page.locator(".newDesignerBoundaryQa").count(),0,
      "source Compare must never inherit selected-preview garment boundary geometry");
    assert.equal(await page.getByRole("button",{name:"Hide boundaries",exact:true}).isDisabled(),true);
    const original=page.locator(".newDesignerPhotoOriginal");
    await original.waitFor();
    assert.equal(await page.getByRole("button",{name:"Show design to save",exact:true}).isDisabled(),true,
      "source Compare must not silently save a different selected-design canvas");
    const finalLock=page.getByRole("button",{name:"Lock final design",exact:true});
    if(await finalLock.count())assert.equal(await finalLock.isDisabled(),true,
      "source comparison must be closed before locking the selected design");
    assert.equal(new URL(await original.getAttribute("src"),base).pathname,"/designer/studio-wide.webp");
    assert.match(await original.getAttribute("alt"),/separate pleated studio source photograph/);
    assert.match(await page.locator(".newDesignerPhotoTag").textContent(),/SOURCE \/ WIDE TROUSER PHOTO/);
    const wideSourceNotice=page.locator('.newDesignerPhoto > [data-photo-source-comparison="wide"]');
    assert.equal(await wideSourceNotice.count(),1);
    assert.match(await wideSourceNotice.textContent(),/shirt in the instant preview comes from the separate pleated studio photograph/);
    assert.equal(await page.locator('[data-photo-construction-mismatch="true"]').count(),0,
      "original photo must not show the customer's selected cut warning as if it were reconstructed");
    await wideSourceNotice.scrollIntoViewIfNeeded();
    const sourceNoticeBox=await wideSourceNotice.boundingBox();
    const sourceDockBox=await page.locator(".floatingContactDock").boundingBox();
    assert.ok(sourceNoticeBox && sourceNoticeBox.width>0 && sourceNoticeBox.height>0);
    if(sourceDockBox){
      const collides=sourceNoticeBox.x<sourceDockBox.x+sourceDockBox.width && sourceNoticeBox.x+sourceNoticeBox.width>sourceDockBox.x
        && sourceNoticeBox.y<sourceDockBox.y+sourceDockBox.height && sourceNoticeBox.y+sourceNoticeBox.height>sourceDockBox.y;
      assert.equal(collides,false,"original wide source provenance must remain readable above photograph");
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    await page.locator(".newDesignerPhoto").screenshot({path:path.join(out,`wide-source-compared-${width}.png`)});
    summary.viewports[summary.viewports.length-1].wideSourceComparisonVerified=true;
    summary.viewports[summary.viewports.length-1].boundaryQaSourceIsolationVerified=true;
    summary.viewports[summary.viewports.length-1].boundaryQaZoomAligned=true;
    await page.getByRole("button",{name:"Show design",exact:true}).click();
    assert.equal(await original.count(),0);
    assert.equal(await page.locator(".newDesignerBoundaryQa").count(),1,
      "returning from source Compare must restore the selected design's QA contours");
    await page.getByRole("button",{name:"Hide boundaries",exact:true}).click();
    assert.equal(await page.locator(".newDesignerBoundaryQa").count(),0);
    assert.equal(await page.getByRole("button",{name:"Save",exact:true}).isEnabled(),true,
      "returning to the actual selected design must restore its Save action");
    // Race two ACTUAL shirt selections against an uncached, delayed catalogue
    // image. The previous look and raw source image must never be displayed as
    // the newly selected fabric while that new tile is still pending.
    const unseen=await page.locator("#designer-shirt option").evaluateAll(options=>
      options.filter(option=>option.value && option.value!==document.querySelector("#designer-shirt")?.value).map(option=>option.value).at(-1));
    assert.ok(unseen && unseen!==dark,"need a distinct customer fabric for rapid-switch QA");
    let delayedImageRequests=0;
    await page.route("**/*.webp",async route=>{
      delayedImageRequests++;
      await new Promise(resolve=>setTimeout(resolve,850));
      await route.continue();
    });
    await page.getByRole("button",{name:"Compare",exact:true}).click();
    await original.waitFor();
    await page.locator("#designer-shirt").selectOption(unseen);
    await page.locator('.newDesignerPhotoStage[data-ready="false"]').waitFor();
    assert.equal(await page.locator(".newDesignerPhotoStage>canvas").evaluate(canvas=>getComputedStyle(canvas).visibility),"hidden",
      "old canvas must be hidden while the new fabric is pending");
    assert.equal(await original.count(),0,"source overlay from previous selection must close on fabric change");
    await page.locator("#designer-shirt").selectOption(dark);
    await ready(page);
    assert.equal(await page.locator(".newDesignerPhotoStage>canvas").evaluate(canvas=>getComputedStyle(canvas).visibility),"visible");
    const settledHash=await actualPhotoPixelHash(page);
    await page.waitForTimeout(1000);
    assert.equal(await actualPhotoPixelHash(page),settledHash,
      "late image loading from an abandoned fabric must not overwrite the last selected look");
    assert.ok(delayedImageRequests>0,"the browser must exercise a real delayed fabric-image request");
    assert.equal(await page.locator("#designer-shirt").inputValue(),dark);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    summary.viewports[summary.viewports.length-1].rapidFabricSwitchStable=true;
    await page.locator(".newDesignerPhoto").screenshot({path:path.join(out,`rapid-fabric-switch-settled-${width}.png`)});
    await context.close();
  }
  assert.equal(summary.paidCalls,0);assert.deepEqual(summary.errors,[]);fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(summary,null,2));console.log(`Photo form passed: ${summary.viewports.length} widths, ${summary.forms.length} photographed cuts, striped shirt and both trouser legs, stronger folds and no protected-region/waist leaks.`);
}
run().catch(async error=>{summary.errors.push(error.stack||String(error));fs.mkdirSync(out,{recursive:true});if(activePage&&!activePage.isClosed())await activePage.screenshot({path:path.join(out,"failure.png"),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(summary,null,2));console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();});
