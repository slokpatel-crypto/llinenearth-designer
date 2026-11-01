"use strict";
// M133: signed, loopback-only Chromium regression for an operator safety race.
// All production history comes from the disposable CI fixture. No POST is sent.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {createRequire}=require("node:module");
const path=require("node:path");
const {mkdir,writeFile}=require("node:fs/promises");
if(process.env.GITHUB_ACTIONS!=="true"||process.env.CI!=="true"){
  throw Error("M133 signed operator browser regression only runs in GitHub Actions.");
}
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
assert.ok(runtime,"Pinned Playwright runtime required");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
assert.equal(base.protocol,"http:");
assert.ok(["127.0.0.1","localhost","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
const holdKey="linen-earth:production:unverified-write:v1";
const holdUuid="9b4216ea-8df6-45a4-8a5c-2f1f91ad283e";
const out=path.resolve("artifacts/preview-lifecycle/production-ledger-refresh-barrier");

function cookie(){
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+180_000})).toString("base64url");
  return {name:"linen_operator_session",
    value:payload+"."+createHmac("sha256",secret).update(payload).digest("base64url"),
    url:base.toString(),httpOnly:true,secure:false,sameSite:"Lax"};
}
async function runViewport(browser,width){
  const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:"reduce"});
  await ctx.addCookies([cookie()]);
  const page=await ctx.newPage();
  const errors=[];
  const productionPosts=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",request=>{
    if(request.method()==="POST"&&new URL(request.url()).pathname==="/api/operator/production"){
      productionPosts.push(request.url());
    }
  });
  try{
    await page.addInitScript(({holdKey,holdUuid})=>{
      localStorage.setItem(holdKey,holdUuid);
      const originalFetch=window.fetch.bind(window);
      let reads=0;
      let releaseSecond=null;
      window.__titanLedgerRefreshRace={
        get reads(){return reads;},
        releaseSecond(){
          if(!releaseSecond)throw Error("Second history read not held");
          const release=releaseSecond;releaseSecond=null;release();
        },
      };
      window.fetch=(input,init)=>{
        const raw=typeof input==="string"?input:input.url;
        const url=new URL(raw,location.href);
        if(url.pathname!=="/api/operator/production"||(init&&init.method==="POST")){
          return originalFetch(input,init);
        }
        reads++;
        if(reads===2)return new Promise((resolve,reject)=>{
          releaseSecond=()=>originalFetch(input,init).then(resolve,reject);
        });
        return originalFetch(input,init);
      };
    },{holdKey,holdUuid});
    await page.goto(new URL("/operator/production",base).toString(),{
      waitUntil:"domcontentloaded",timeout:20_000,
    });
    const review=page.getByRole("button",{name:"I reviewed history — enable writes"});
    await review.waitFor({state:"visible",timeout:15_000});
    await page.waitForFunction(()=>{
      const b=[...document.querySelectorAll("button")]
        .find(x=>x.textContent?.includes("I reviewed history"));
      return b&&!b.disabled;
    },{}, {timeout:15_000});

    // Two clicks in the SAME JS event turn: React has not yet rendered
    // setConfigured(false). The synchronous generation gate must still refuse
    // acknowledgement, leaving the anonymous uncertainty marker intact.
    const result=await page.evaluate((key)=>{
      const buttons=[...document.querySelectorAll("button")];
      const refresh=buttons.find(x=>x.textContent?.includes("Refresh production history"));
      const acknowledge=buttons.find(x=>x.textContent?.includes("I reviewed history"));
      if(!refresh||!acknowledge||refresh.disabled||acknowledge.disabled){
        throw Error("Expected previously verified history and review controls");
      }
      refresh.click();
      acknowledge.click();
      return {marker:localStorage.getItem(key),reads:window.__titanLedgerRefreshRace.reads};
    },holdKey);
    assert.equal(result.marker,holdUuid,
      "Same-turn acknowledgement must not clear an uncertain write during refresh");
    assert.equal(result.reads,2,"Second ledger GET must be pending");

    await page.evaluate(()=>window.__titanLedgerRefreshRace.releaseSecond());
    await page.waitForFunction(()=>{
      const b=[...document.querySelectorAll("button")]
        .find(x=>x.textContent?.includes("I reviewed history"));
      return b&&!b.disabled;
    },{}, {timeout:15_000});
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),holdKey),holdUuid,
      "A completed GET cannot silently acknowledge the prior uncertain write");
    // M139: even a previously rendered GET may have overlapped a remote SQL
    // write. First click must fetch history AGAIN while holding the full
    // production-session Web Lock; only a second deliberate click may clear.
    await review.click();
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),holdKey),holdUuid,
      "First acknowledgement must not clear a marker before post-session history verification");
    await page.waitForFunction(()=>{
      const button=[...document.querySelectorAll("button")]
        .find(x=>x.textContent?.includes("I reviewed history"));
      return window.__titanLedgerRefreshRace.reads>=3
        &&document.body.textContent?.includes("Production history rechecked with no active browser write")
        &&button&&!button.disabled;
    },{}, {timeout:15000});
    await review.click();
    await page.waitForFunction(key=>localStorage.getItem(key)===null,holdKey,{timeout:15000});
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),holdKey),null,
      "Only the second explicit acknowledgement after a post-session GET may clear the marker");
    assert.deepEqual(productionPosts,[],"Browser race test must never mutate production");
    assert.deepEqual(errors,[],"No JavaScript errors");
    await mkdir(out,{recursive:true});
    await page.screenshot({path:path.join(out,"review-"+width+".png"),fullPage:true});
    return {width,sameTurnAcknowledgementBlocked:true,explicitAfterRenderRequired:true,postSessionRefreshAndSecondClickRequired:true,
      productionPosts:0,syntheticOnly:true};
  }finally{await ctx.close();}
}
async function main(){
  const browser=await chromium.launch({headless:true});
  try{
    const viewports=[];
    for(const width of [390,1440])viewports.push(await runViewport(browser,width));
    await mkdir(out,{recursive:true});
    await writeFile(path.join(out,"summary.json"),JSON.stringify({
      source:"signed loopback disposable operator fixture",humanEvidence:false,
      physicalEvidence:false,stockEvidence:false,viewports,
    },null,2));
    console.log("M133 Chromium synchronous ledger refresh/review safety PASS");
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
