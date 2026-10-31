"use strict";
// M120: Real Chromium UI proof that the optional physical-QC hint cannot hold
// ordinary production history hostage or revive an earlier delivery approval.
// All quote, order and QC results are CI-only synthetic data; NEVER human QC.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {createRequire}=require("node:module");
const {mkdir,writeFile}=require("node:fs/promises");
const path=require("node:path");
const {PRODUCTION_LISTS,ORDER_LIST_PATH}=require("./ci-verified-stock-fixture.cjs");
if(process.env.GITHUB_ACTIONS!=="true"||process.env.CI!=="true"){
  throw Error("M120 private Production Desk browser test only runs in disposable GitHub Actions.");
}
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
assert.ok(runtime,"Pinned independent Playwright runtime is required");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
assert.equal(base.protocol,"http:");
assert.ok(["127.0.0.1","localhost","[::1]"].includes(base.hostname),
  "Signed operator test cookie must never be sent to a non-loopback host.");
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);

const original=PRODUCTION_LISTS[ORDER_LIST_PATH][0];
assert.ok(original&&original.status==="created");
const fakeReady={...original,status:"ready"};
const positive={
  order_id:fakeReady.order_id,revision_id:fakeReady.revision_id,
  recipe_hash:fakeReady.recipe_hash,status:"ready",
  updated_at:fakeReady.updated_at,eligible:true,
};
const out=path.resolve("artifacts/preview-lifecycle/production-qc-hint-browser");

function cookie(){
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+180_000})).toString("base64url");
  const signature=createHmac("sha256",secret).update(payload).digest("base64url");
  return {name:"linen_operator_session",value:payload+"."+signature,url:base.toString(),
    httpOnly:true,secure:false,sameSite:"Lax"};
}

async function testViewport(browser,width){
  const ctx=await browser.newContext({viewport:{width,height:880},reducedMotion:"reduce"});
  await ctx.addCookies([cookie()]);
  let call=0,firstRelease,firstStarted;
  const firstIntercepted=new Promise(resolve=>{firstStarted=resolve;});
  const errors=[];
  const page=await ctx.newPage();
  page.on("pageerror",e=>errors.push(e.message));
  try{
    // Set only this browser's validated local order snapshot to READY. The
    // backend remains unchanged; no operator mutation or real QC is created.
    await ctx.route("**/api/operator/production",async route=>{
      const response=await route.fetch({timeout:15_000});
      assert.equal(response.status(),200,"Synthetic operator ledger should exist");
      const data=await response.json();
      assert.ok(Array.isArray(data.orders)&&data.orders.length===1);
      data.orders=[fakeReady];
      await route.fulfill({response,json:data});
    });
    await ctx.route("**/api/operator/production/delivery-eligibility",async route=>{
      call++;
      if(call===1){
        firstStarted();
        await new Promise(resolve=>{
          firstRelease=async()=>{
            await route.fulfill({status:200,json:{eligibility:[positive]}});
            resolve();
          };
        });
      }else if(call===2){
        await route.fulfill({status:503,json:{error:"Delivery verification unavailable."}});
      }else{
        await route.fulfill({status:200,json:{eligibility:[positive]}});
      }
    });
    await page.goto(new URL("/operator/production",base).toString(),{
      waitUntil:"domcontentloaded",timeout:20_000,
    });
    await Promise.race([
      firstIntercepted,
      new Promise((_,reject)=>setTimeout(()=>reject(Error("Optional SQL hint was never requested")),15_000)),
    ]);
    const order=page.locator("section.productionRecord").filter({
      hasText:"CI-only production order",
    });
    await order.waitFor({state:"visible",timeout:15_000});
    await page.getByText("CI-only stitched garment").first().waitFor({state:"visible",timeout:15_000});
    const select=order.locator("select").first();
    await select.waitFor({state:"visible",timeout:15_000});
    assert.equal(await order.locator('option[value="delivered"]').count(),0,
      "A stalled optional SQL proof must never show the delivery transition");

    // Refresh the verified ledger while the OLD positive hint is still
    // pending. A later 503 must not prevent history from appearing.
    const nextHint=page.waitForResponse(resp=>
      new URL(resp.url()).pathname==="/api/operator/production/delivery-eligibility"
        &&resp.status()===503,{timeout:15_000});
    await page.getByRole("button",{name:"Refresh production history"}).click();
    await nextHint;
    await order.waitFor({state:"visible",timeout:15_000});
    assert.equal(await order.locator('option[value="delivered"]').count(),0,
      "Missing current hint must fail closed without hiding production history");

    assert.equal(typeof firstRelease,"function");
    await firstRelease();
    await page.waitForTimeout(250);
    assert.equal(await order.locator('option[value="delivered"]').count(),0,
      "A stale positive answer from the previous read must never re-enable delivery");

    // Fresh matching SQL hint can update the UI, but no delivery mutation
    // may be sent from this synthetic browser test.
    const freshHint=page.waitForResponse(resp=>
      new URL(resp.url()).pathname==="/api/operator/production/delivery-eligibility"
        &&resp.status()===200,{timeout:15_000});
    await page.getByRole("button",{name:"Refresh production history"}).click();
    await freshHint;
    await order.locator('option[value="delivered"]').waitFor({state:"attached",timeout:15_000});
    assert.equal(call,3,"Expected stalled, failed and newly valid QC hint reads");
    assert.deepEqual(errors,[],"Production Desk must not crash on delayed QC reads");
    await mkdir(out,{recursive:true});
    await page.screenshot({path:path.join(out,"desk-"+width+".png"),fullPage:true});
    return {width,syntheticOnly:true,historyWhileHintPending:true,
      stalePositiveIgnored:true,freshPositiveVisible:true,deliveryPosted:false};
  }finally{
    await ctx.close();
  }
}
async function main(){
  const browser=await chromium.launch({headless:true});
  try{
    const viewports=[];
    for(const width of [390,1440])viewports.push(await testViewport(browser,width));
    await mkdir(out,{recursive:true});
    await writeFile(path.join(out,"summary.json"),JSON.stringify({
      model:"original, unchanged",physicalEvidence:false,
      supplierEvidence:false,source:"loopback-only mocked operator browser",
      viewports,
    },null,2));
    console.log("M120 Chromium production history remains responsive and delivery fail-closed under delayed, stale and fresh synthetic SQL hints PASS");
    console.log("No physical QC, customer, stock or delivery events were created.");
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
