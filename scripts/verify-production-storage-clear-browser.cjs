"use strict";
// M150: real signed operator React browser must fail closed if another tab
// clears localStorage. StorageEvent.key is null for clear(), not a named key.
// Synthetic CI-only production ledger; no mutation POST, real order or stock.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {createRequire}=require("node:module");
const {mkdir,writeFile}=require("node:fs/promises");
const path=require("node:path");
if(process.env.CI!=="true"||process.env.GITHUB_ACTIONS!=="true")
  throw Error("M150 storage-clear operator browser acceptance is CI-only.");
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
assert.ok(runtime,"Pinned Playwright runtime required");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://localhost:3000");
assert.equal(base.protocol,"http:");
assert.ok(["localhost","127.0.0.1","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
const epochKey="linen-earth:production:write-epoch:v1";
const initialEpoch="123e4567-e89b-42d3-a456-426614174120";
const out=path.resolve("artifacts/preview-lifecycle/production-storage-clear");
function cookie(){
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+180000})).toString("base64url");
  return {name:"linen_operator_session",
    value:payload+"."+createHmac("sha256",secret).update(payload).digest("base64url"),
    url:base.toString(),httpOnly:true,secure:false,sameSite:"Lax"};
}
async function runViewport(browser,width){
  const ctx=await browser.newContext({viewport:{width,height:880},reducedMotion:"reduce"});
  await ctx.addCookies([cookie()]);
  await ctx.addInitScript(({epochKey,initialEpoch})=>{
    if(localStorage.getItem(epochKey)===null)localStorage.setItem(epochKey,initialEpoch);
  },{epochKey,initialEpoch});
  const a=await ctx.newPage(),b=await ctx.newPage();
  const errors=[],productionPosts=[];
  for(const page of [a,b]){
    page.on("pageerror",e=>errors.push(e.message));
    page.on("request",request=>{
      if(request.method()==="POST"&&new URL(request.url()).pathname==="/api/operator/production")
        productionPosts.push(request.postData()||"");
    });
  }
  try{
    await a.goto(new URL("/operator/production",base).toString(),{
      waitUntil:"domcontentloaded",timeout:20000,
    });
    const select=a.locator("section.productionRecord select").first();
    await select.waitFor({state:"visible",timeout:20000});
    await a.waitForFunction(()=>{
      const select=document.querySelector("section.productionRecord select");
      return select&&!select.disabled;
    },{},{timeout:20000});
    assert.equal(await a.getByRole("alert",{name:"Production write review required"}).count(),0,
      "Operator must begin with a verified usable synthetic ledger");
    await b.goto(new URL("/",base).toString(),{waitUntil:"domcontentloaded",timeout:20000});
    assert.equal(await b.evaluate(key=>localStorage.getItem(key),epochKey),initialEpoch);
    // A cross-tab clear emits StorageEvent.key === null; the original handler
    // ignored it and left stale configured history authorized for writes.
    await b.evaluate(()=>localStorage.clear());
    await a.getByRole("alert",{name:"Production write review required"})
      .waitFor({state:"visible",timeout:15000});
    assert.equal(await select.isDisabled(),true,
      "Storage clear must synchronously invalidate the operator write controls");
    await a.getByRole("status").filter({
      hasText:"Production writes changed in another tab",
    }).waitFor({state:"visible",timeout:15000});
    assert.equal(await a.evaluate(key=>localStorage.getItem(key),epochKey),null);
    await a.getByRole("button",{name:"Refresh production history"}).click();
    await a.getByRole("alert",{name:"Production write review required"})
      .waitFor({state:"visible",timeout:15000});
    assert.equal(await select.isDisabled(),true,
      "A fresh GET alone must not clear a storage-loss uncertainty hold");
    assert.deepEqual(productionPosts,[],"No production mutation POST may leave signed CI browser");
    assert.deepEqual(errors,[],"No JavaScript exceptions");
    await mkdir(out,{recursive:true});
    await a.screenshot({path:path.join(out,"storage-clear-"+width+".png"),fullPage:true});
    return {width,storageClearVeto:true,reviewHoldRetained:true,
      mutationPosts:0,syntheticOnly:true};
  }finally{await ctx.close();}
}
async function main(){
  const browser=await chromium.launch({headless:true});
  try{
    const widths=[];
    for(const width of [390,768,1440])widths.push(await runViewport(browser,width));
    await mkdir(out,{recursive:true});
    await writeFile(path.join(out,"summary.json"),JSON.stringify({
      source:"CI-only signed cross-tab localStorage.clear React regression",
      realOperatorEvidence:false,realSqlEvidence:false,physicalEvidence:false,widths,
    },null,2));
    console.log("M150 signed Chromium cross-tab storage-clear write veto PASS.");
    console.log("No live SQL, real production mutation, supplier stock or human approval.");
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
