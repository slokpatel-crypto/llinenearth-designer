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
  // Control optional fetch promises inside this browser document. Holding a
  // Playwright route callback open can serialize route handlers on some
  // Chromium/Playwright versions and makes the later refresh unobservable.
  // The independent M117 test still exercises the real signed HTTP endpoint.
  const firstRelease=()=>page.evaluate(()=>window.__titanQcHints.releaseFirst());
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
    await page.addInitScript(({positive})=>{
      const originalFetch=window.fetch.bind(window);
      let calls=0;
      let completeFirst=null;
      window.__titanQcHints={
        get calls(){return calls;},
        releaseFirst(){
          if(!completeFirst)throw Error("First synthetic QC hint was never held");
          completeFirst(new Response(JSON.stringify(positive),{
            status:200,headers:{"content-type":"application/json"},
          }));
          completeFirst=null;
        },
      };
      window.fetch=(input,options)=>{
        const raw=typeof input==="string"?input:input.url;
        if(new URL(raw,location.href).pathname!=="/api/operator/production/delivery-eligibility"){
          return originalFetch(input,options);
        }
        calls++;
        if(calls===1)return new Promise(resolve=>{completeFirst=resolve;});
        if(calls===2)return Promise.resolve(new Response(JSON.stringify({
          error:"Delivery verification unavailable.",
        }),{status:503,headers:{"content-type":"application/json"}}));
        return Promise.resolve(new Response(JSON.stringify(positive),{
          status:200,headers:{"content-type":"application/json"},
        }));
      };
    },{positive:{eligibility:[positive]}});
    await page.goto(new URL("/operator/production",base).toString(),{
      waitUntil:"domcontentloaded",timeout:20_000,
    });
    const firstIntercepted=page.waitForFunction(
      ()=>window.__titanQcHints?.calls>=1,{},{timeout:15_000});
    await firstIntercepted;
    // M131: the operator must not be able to type an invented revision or
    // recipe hash. Only a verified recovery token may unlock either create.
    const immutableFields=page.locator('input[readonly][aria-readonly="true"]');
    await immutableFields.first().waitFor({state:"visible",timeout:15_000});
    assert.equal(await immutableFields.count(),4,
      "Quote and order each require read-only verified revision and recipe");
    assert.equal(await page.getByRole("button",{name:"Create quote"}).isDisabled(),true,
      "No quote without verified locked design");
    assert.equal(await page.getByRole("button",{name:"Create order"}).isDisabled(),true,
      "No order without verified locked design");
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
    await page.getByRole("button",{name:"Refresh production history"}).click();
    await page.waitForFunction(()=>window.__titanQcHints?.calls>=2,{}, {timeout:15_000});
    await order.waitFor({state:"visible",timeout:15_000});
    assert.equal(await order.locator('option[value="delivered"]').count(),0,
      "Missing current hint must fail closed without hiding production history");

    await firstRelease();
    await page.waitForTimeout(250);
    assert.equal(await order.locator('option[value="delivered"]').count(),0,
      "A stale positive answer from the previous read must never re-enable delivery");

    // Fresh matching SQL hint can update the UI, but no delivery mutation
    // may be sent from this synthetic browser test.
    await page.getByRole("button",{name:"Refresh production history"}).click();
    await page.waitForFunction(()=>window.__titanQcHints?.calls>=3,{}, {timeout:15_000});
    await order.locator('option[value="delivered"]').waitFor({state:"attached",timeout:15_000});
    assert.equal(await page.evaluate(()=>window.__titanQcHints.calls),3,
      "Expected stalled, failed and newly valid QC hint reads");
    assert.deepEqual(errors,[],"Production Desk must not crash on delayed QC reads");
    await mkdir(out,{recursive:true});
    await page.screenshot({path:path.join(out,"desk-"+width+".png"),fullPage:true});
    return {width,syntheticOnly:true,historyWhileHintPending:true,
      stalePositiveIgnored:true,freshPositiveVisible:true,lockedFieldsReadOnly:true,deliveryPosted:false};
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
