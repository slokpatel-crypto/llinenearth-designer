"use strict";
// M135: signed, loopback-only two-tab Chromium regression. No production POST,
// real supplier stock, real customer design or paid-provider calls.
const assert=require("node:assert/strict");
const {createHmac,createHash}=require("node:crypto");
const {createRequire}=require("node:module");
const {readFile,mkdir,writeFile}=require("node:fs/promises");
const path=require("node:path");
if(process.env.GITHUB_ACTIONS!=="true"||process.env.CI!=="true"){
  throw Error("M135 signed two-tab packet browser regression only runs in GitHub Actions.");
}
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
assert.ok(runtime,"Pinned Playwright runtime required");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
assert.equal(base.protocol,"http:");
assert.ok(["127.0.0.1","localhost","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
const out=path.resolve("artifacts/preview-lifecycle/production-packet-cross-tab");
const holdKey="linen-earth:production:unverified-write:v1";
const epochKey="linen-earth:production:write-epoch:v1";
const token="6ab32c09-283e-4521-81e5-6b4c2d2f9001";
function canonicalize(value){
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==="object")return Object.fromEntries(
    Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
      .map(([key,item])=>[key,canonicalize(item)]));
  return value;
}
function syntheticRevision(){
  const fabric="synthetic-m135-shirt";
  const spec={
    version:"linen-earth-garment-spec-v1",status:"draft",
    source:{designerRuleSetVersion:"rules-1",fitConstructionVersion:null,fitEaseSource:null,
      fitEaseTableVersion:null,measurementProfileVersion:null,blockStrategyVersion:null,styleSchemaVersion:null},
    styleSpec:null,bodyProfile:null,
    context:{occasion:"Semi-Formal",climate:"Not specified",intention:"Balanced"},
    fabrics:{
      shirt:{id:fabric,name:fabric,line:"Synthetic CI fabric",source:"catalogue",verifiedMaterialFacts:0},
      trouser:{id:"synthetic-m135-trouser",name:"Synthetic trouser",line:"Synthetic CI",source:"catalogue",verifiedMaterialFacts:0},
    },
    shirt:{fit:"Regular",wear:"Tucked",collar:"Point",collarFinish:"Self-fabric",cuff:"Barrel",
      placket:"Standard",button:"Corozo",finishedTargets:[]},
    trouser:{shape:"Pleated",rise:"Mid Rise",waistband:"Side Adjuster",break:"Slight Break",finishedTargets:[]},
    creative:null,decision:{designFitScore:80,confidenceScore:72,fitConstructionScore:null,
      brandLanguageScore:null,blockStrategyScore:null},
    blockStrategy:null,constructionChecks:[],unresolved:["Synthetic CI only"],
    readiness:{visualization:"supported_with_current_template",tailoring:"insufficient_measurements",
      materialVerification:"verification_required"},caveats:["Not real inventory"],
  };
  const recipeHash=createHash("sha256").update(JSON.stringify(canonicalize(spec))).digest("hex");
  return {version:"linen-earth-design-lock-v1",
    revisionId:"LE-LOCK-20261031200000-"+recipeHash.slice(0,12).toUpperCase()+"-1111111111111111",
    parentRevisionId:null,recipeHash,lockedAt:"2026-10-31T20:00:00.000Z",garmentSpec:spec};
}
const revision=syntheticRevision();
function cookie(){
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+180_000})).toString("base64url");
  return {name:"linen_operator_session",
    value:payload+"."+createHmac("sha256",secret).update(payload).digest("base64url"),
    url:base.toString(),httpOnly:true,secure:false,sameSite:"Lax"};
}
async function runViewport(browser,width){
  const ctx=await browser.newContext({viewport:{width,height:850},acceptDownloads:true,reducedMotion:"reduce"});
  await ctx.addCookies([cookie()]);
  const page=await ctx.newPage();
  const errors=[],posts=[],downloads=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("download",download=>downloads.push(download.suggestedFilename()));
  page.on("request",request=>{
    if(request.method()==="POST"&&new URL(request.url()).pathname==="/api/operator/production")posts.push(request.url());
  });
  try{
    await page.addInitScript(({revision})=>{
      const original=window.fetch.bind(window);
      let held=null,holdNext=false;
      window.__titanPacketRace={
        holdNext(){holdNext=true;},
        get pending(){return held!==null;},
        release(){if(!held)throw Error("Packet history GET was not held");
          const fn=held;held=null;fn();},
      };
      window.fetch=(input,init)=>{
        const raw=typeof input==="string"?input:input.url;
        const url=new URL(raw,location.href);
        if(url.pathname==="/api/designer/vault"&&init?.method==="POST"){
          return Promise.resolve(new Response(JSON.stringify({revision}),{
            status:200,headers:{"content-type":"application/json"}}));
        }
        if(url.pathname==="/api/operator/production"&&init?.method!=="POST"&&holdNext){
          holdNext=false;
          return new Promise((resolve,reject)=>{
            held=()=>original(input,init).then(resolve,reject);
          });
        }
        return original(input,init);
      };
    },{revision});
    await page.goto(new URL("/operator/production",base).toString(),{waitUntil:"domcontentloaded",timeout:20_000});
    await page.locator(".productionLoadForm textarea").fill("lev1.synthetic-m135-only");
    await page.getByRole("button",{name:"Load locked design"}).click();
    await page.getByText("synthetic-m135-shirt",{exact:true}).waitFor({timeout:15_000});
    const packetButton=page.getByRole("button",{name:"Export production packet"});
    await page.waitForFunction(()=>{
      const b=[...document.querySelectorAll("button")]
        .find(x=>x.textContent?.includes("Export production packet"));
      return b&&!b.disabled;
    },{}, {timeout:15_000});

    // Positive control: the exact synthetic lock and fixture ledger really
    // produce a packet. Otherwise a blocked race could pass vacuously.
    const positivePromise=page.waitForEvent("download",{timeout:15_000});
    await packetButton.click();
    const positive=await positivePromise;
    const packet=JSON.parse(await readFile(await positive.path(),"utf8"));
    assert.equal(packet.revisionId,revision.revisionId);
    assert.equal(downloads.length,1);
    await page.waitForFunction(()=>{
      const b=[...document.querySelectorAll("button")]
        .find(x=>x.textContent?.includes("Export production packet"));
      return b&&!b.disabled;
    },{}, {timeout:15_000});

    // Hold the next authenticated GET after the packet handler has captured
    // its clean epoch. A SECOND same-origin tab begins and confirms a write,
    // removing the pending marker before the first tab's GET resumes.
    await page.evaluate(()=>window.__titanPacketRace.holdNext());
    await packetButton.click();
    await page.waitForFunction(()=>window.__titanPacketRace.pending,{}, {timeout:15_000});
    const second=await ctx.newPage();
    await second.goto(new URL("/operator/production",base).toString(),{waitUntil:"domcontentloaded",timeout:20_000});
    await second.evaluate(({holdKey,epochKey,token})=>{
      localStorage.setItem(holdKey,token);
      localStorage.setItem(epochKey,token);
      localStorage.removeItem(holdKey);
    },{holdKey,epochKey,token});
    assert.equal(await second.evaluate(key=>localStorage.getItem(key),holdKey),null,
      "Second tab must have confirmed and cleared its pending marker");
    await page.evaluate(()=>window.__titanPacketRace.release());
    await page.getByText("production writes changed in another tab during packet export",{
      exact:false,
    }).waitFor({timeout:15_000});
    await page.waitForTimeout(200);
    assert.equal(downloads.length,1,
      "No stale packet may download after another tab's already-completed write");

    // A completed remote write has already removed its hold. The operator
    // must first refresh the latest history, then explicitly acknowledge the
    // cross-tab warning without trying to delete a non-existent marker.
    const review=page.getByRole("button",{name:"I reviewed history — enable writes"});
    await review.waitFor({state:"visible",timeout:15_000});
    assert.equal(await review.isDisabled(),true,
      "Cross-tab storage changes must synchronously revoke stale review permission");
    const refresh=page.getByRole("button",{name:"Refresh production history"});
    await refresh.click();
    await page.waitForFunction(()=>{
      const b=[...document.querySelectorAll("button")]
        .find(x=>x.textContent?.includes("I reviewed history"));
      return b&&!b.disabled;
    },{}, {timeout:15_000});

    // A NEW marker after that read cannot be acknowledged using the stale
    // verified snapshot, even when a previously rendered button is clicked.
    const token2="6ab32c09-283e-4521-81e5-6b4c2d2f9002";
    await second.evaluate(({holdKey,epochKey,token2})=>{
      localStorage.setItem(holdKey,token2);
      localStorage.setItem(epochKey,token2);
    },{holdKey,epochKey,token2});
    await page.evaluate(()=>{
      const b=[...document.querySelectorAll("button")]
        .find(x=>x.textContent?.includes("I reviewed history"));
      if(!b)throw Error("Review button missing");
      b.click();
    });
    assert.equal(await second.evaluate(key=>localStorage.getItem(key),holdKey),token2,
      "An acknowledgement from stale history must not erase another tab's new hold");
    await second.evaluate(key=>localStorage.removeItem(key),holdKey);
    // Let the cross-tab storage event invalidate the old generation before
    // starting the new authenticated read, avoiding timing-dependent retries.
    await page.waitForTimeout(100);
    await refresh.click();
    await page.waitForFunction(()=>{
      const b=[...document.querySelectorAll("button")]
        .find(x=>x.textContent?.includes("I reviewed history"));
      return b&&!b.disabled;
    },{}, {timeout:15_000});
    // M139: the first review click must independently refresh history while
    // holding the full production-session lock. It may NOT clear the warning
    // based on a GET that could have overlapped an in-flight remote SQL write.
    await review.click();
    await page.getByRole("alert",{name:"Production write review required"})
      .waitFor({state:"visible",timeout:15_000});
    await page.waitForFunction(()=>{
      const b=[...document.querySelectorAll("button")]
        .find(x=>x.textContent?.includes("I reviewed history"));
      return document.body.textContent?.includes("Production history rechecked with no active browser write")
        &&b&&!b.disabled;
    },{}, {timeout:15_000});
    await review.click();
    await page.getByRole("alert",{name:"Production write review required"})
      .waitFor({state:"hidden",timeout:15_000});
    assert.equal(await second.evaluate(key=>localStorage.getItem(key),holdKey),null,
      "Completed cross-tab review must not recreate a hold");
    assert.deepEqual(posts,[],"No production POST is allowed in synthetic browser verification");
    assert.deepEqual(errors,[],"No browser JavaScript exceptions");
    await mkdir(out,{recursive:true});
    await page.screenshot({path:path.join(out,"cross-tab-"+width+".png"),fullPage:true});
    return {width,positivePacket:true,completedCrossTabWriteBlocked:true,
      staleReviewBlocked:true,completedRemoteReviewRecovered:true,
      postSessionTwoStepReview:true,
      stalePackets:0,productionPosts:0,syntheticOnly:true};
  }finally{await ctx.close();}
}
(async()=>{
  await mkdir(out,{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    const viewports=[];
    for(const width of [390,1440])viewports.push(await runViewport(browser,width));
    await writeFile(path.join(out,"summary.json"),JSON.stringify({
      synthetic:true,humanEvidence:false,stockEvidence:false,physicalEvidence:false,viewports,
    },null,2)+"\n");
    console.log("M135 signed Chromium two-tab packet epoch safety PASS",viewports);
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
