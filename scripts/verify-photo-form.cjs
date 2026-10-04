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
    summary.viewports.push({width,overflow:false,realCataloguePreview:true});
    if(width===1440){
      await page.addScriptTag({content:`window.__photoFormBefore=${beforeBundle};window.__photoFormAfter=${afterBundle};`});
      summary.forms=await page.evaluate(async()=>{
        const results=[],W=1024,H=1536;
        const image=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
        const makeCanvas=()=>{const c=document.createElement("canvas");c.width=W;c.height=H;return c;};
        const control=document.createElement("canvas");control.width=control.height=64;const cc=control.getContext("2d");cc.fillStyle="#b46d58";cc.fillRect(0,0,64,64);const shirtImage=await image(control.toDataURL());cc.fillStyle="#b9afa0";cc.fillRect(0,0,64,64);const pantImage=await image(control.toDataURL());
        const engine=window.__photoFormAfter.engine,shirt={...engine.DESIGNER_SHIRTS[0],image:"/qa-solid-shirt.png",hex:"#b46d58",patternType:"Solid",renderScale:undefined},pant={...engine.DESIGNER_PANTS[0],image:"/qa-solid-pant.png",hex:"#b9afa0",patternType:"Solid",renderScale:undefined};
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
          window.__photoFormImages[template]=display.toDataURL("image/png");results.push({template,renderMs,folds,protectedChanges,wrongWaistPixels,waistExamples});
        }return results;
      });
      for(const result of summary.forms){await page.evaluate(template=>{const image=document.createElement("img");image.id="photo-form-comparison";image.src=window.__photoFormImages[template];image.style.width="1024px";document.body.append(image);},result.template);await page.locator("#photo-form-comparison").screenshot({path:path.join(out,`before-after-${result.template}.png`)});await page.locator("#photo-form-comparison").evaluate(image=>image.remove());}
      for(const result of summary.forms){assert.equal(result.protectedChanges,0,result.template+" must preserve skin, shoes, inner-leg gap and set");assert.equal(result.wrongWaistPixels,0,"source shirting must stay fully covered at the tucked waist");for(const fold of result.folds)assert.ok(fold.after.slope>fold.before.slope*1.15,`${result.template} ${fold.name}: depicted fold contrast must improve, ${fold.before.slope} -> ${fold.after.slope}`);}
      await page.getByRole("combobox",{name:"Shirt finish",exact:true}).selectOption("Untucked");await ready(page);await page.locator(".newDesignerPhoto").screenshot({path:path.join(out,"real-untucked.png")});
    }
    await context.close();
  }
  assert.equal(summary.paidCalls,0);assert.deepEqual(summary.errors,[]);fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(summary,null,2));console.log(`Photo form passed: ${summary.viewports.length} widths, ${summary.forms.length} photographed cuts, stronger folds and no protected-region/waist leaks.`);
}
run().catch(async error=>{summary.errors.push(error.stack||String(error));fs.mkdirSync(out,{recursive:true});if(activePage&&!activePage.isClosed())await activePage.screenshot({path:path.join(out,"failure.png"),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(summary,null,2));console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();});
