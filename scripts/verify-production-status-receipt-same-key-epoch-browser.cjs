"use strict";
// M149 signed actual React + real read-only Next HTTP regression.
// A same-UUID write epoch change during status receipt recovery MUST veto the
// old committed receipt. All upstream evidence is isolated CI loopback SQL.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {createRequire}=require("node:module");
const {mkdir,writeFile}=require("node:fs/promises");
const path=require("node:path");
const {FIXTURE_KEY}=require("./ci-verified-stock-fixture.cjs");
if(process.env.CI!=="true"||process.env.GITHUB_ACTIONS!=="true")
  throw Error("M149 same-key status receipt browser gate is GitHub Actions CI only.");
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
assert.ok(runtime,"Pinned Playwright runtime is required.");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://localhost:3000");
assert.equal(base.protocol,"http:");
assert.ok(["localhost","127.0.0.1","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
const holdKey="linen-earth:production:unverified-write:v1";
const epochKey="linen-earth:production:write-epoch:v1";
const key="123e4567-e89b-42d3-a456-426614174070";
const oldEpoch="123e4567-e89b-42d3-a456-426614174120";
const newEpoch="9b4216ea-8df6-45a4-8a5c-2f1f91ad283e";
const out=path.resolve("artifacts/preview-lifecycle/status-receipt-epoch");
function sessionCookie(){
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+180000})).toString("base64url");
  return {name:"linen_operator_session",
    value:payload+"."+createHmac("sha256",secret).update(payload).digest("base64url"),
    url:base.toString(),httpOnly:true,secure:false,sameSite:"Lax"};
}
async function setMode(mode){
  const result=await fetch("http://127.0.0.1:54324/__fixture/status-receipt-mode",{
    method:"POST",cache:"no-store",signal:AbortSignal.timeout(10000),
    headers:{apikey:FIXTURE_KEY,"content-type":"application/json"},
    body:JSON.stringify({mode}),
  });
  assert.equal(result.status,200);
  assert.deepEqual(await result.json(),{ciFixture:true,mode});
}
async function runViewport(browser,width){
  const context=await browser.newContext({viewport:{width,height:880},reducedMotion:"reduce"});
  await context.addCookies([sessionCookie()]);
  const page=await context.newPage();
  const actions=[],httpStatuses=[],browserErrors=[];
  page.on("pageerror",e=>browserErrors.push(e.message));
  page.on("request",request=>{
    if(request.method()==="POST"&&new URL(request.url()).pathname==="/api/operator/production"){
      let action="invalid";
      try{action=request.postDataJSON()?.action;}catch{}
      actions.push(action);
    }
  });
  page.on("response",response=>{
    if(response.request().method()==="POST"&&
      new URL(response.url()).pathname==="/api/operator/production")
      httpStatuses.push(response.status());
  });
  try{
    await setMode("valid");
    await page.addInitScript(({holdKey,epochKey,key,oldEpoch})=>{
      localStorage.setItem(holdKey,key);localStorage.setItem(epochKey,oldEpoch);
    },{holdKey,epochKey,key,oldEpoch});
    await page.goto(new URL("/operator/production",base).toString(),{
      waitUntil:"domcontentloaded",timeout:20000,
    });
    const alert=page.getByRole("alert",{name:"Production write review required"});
    await alert.waitFor({state:"visible",timeout:20000});
    const verified=page.getByRole("button",{name:"I reviewed history — enable writes"});
    await verified.waitFor({state:"visible",timeout:20000});
    await page.waitForFunction(()=>{
      const button=[...document.querySelectorAll("button")]
        .find(item=>item.textContent?.includes("I reviewed history"));
      return button&&!button.disabled;
    },{},{timeout:20000});

    // Defer the genuine browser POST until after a different write generation
    // appears; the original pending UUID is intentionally left unchanged.
    await page.evaluate(()=>{
      const nativeFetch=window.fetch.bind(window);
      let complete=null,intercepted=0;
      window.__m149StatusRace={
        get intercepted(){return intercepted;},
        release(){if(!complete)throw Error("No pending status receipt fetch.");
          const go=complete;complete=null;go();
        },
      };
      window.fetch=(input,options)=>{
        const url=new URL(typeof input==="string"?input:input.url,location.href);
        let body=null;
        try{body=JSON.parse(options?.body);}catch{}
        if(url.pathname==="/api/operator/production"&&options?.method==="POST"
          &&body?.action==="status_receipt_lookup"){
          intercepted++;
          return new Promise((resolve,reject)=>{
            complete=()=>nativeFetch(input,options).then(resolve,reject);
          });
        }
        return nativeFetch(input,options);
      };
    });
    const lookup=page.getByRole("button",{
      name:"Find original status receipt by request ID",
    });
    await lookup.click();
    await page.waitForFunction(()=>window.__m149StatusRace?.intercepted===1,
      {},{timeout:15000});
    assert.equal(await lookup.isDisabled(),true,"Receipt recovery is locked while POST is pending");
    await page.evaluate(({epochKey,newEpoch})=>localStorage.setItem(epochKey,newEpoch),
      {epochKey,newEpoch});
    await page.evaluate(()=>window.__m149StatusRace.release());
    await page.getByRole("status").filter({
      hasText:"Original status receipt could not be verified",
    }).waitFor({state:"visible",timeout:15000});
    await page.waitForFunction(()=>{
      const button=[...document.querySelectorAll("button")]
        .find(item=>item.textContent?.includes("Find original status receipt by request ID"));
      return button&&!button.disabled;
    },{},{timeout:15000});
    const receipts=page.locator('[aria-label="Original committed status receipts"]');
    assert.equal(await receipts.count(),0,
      "An earlier committed status may not appear after same-key epoch changed");
    const state=await page.evaluate(({holdKey,epochKey})=>({
      hold:localStorage.getItem(holdKey),epoch:localStorage.getItem(epochKey),
    }),{holdKey,epochKey});
    assert.deepEqual(state,{hold:key,epoch:newEpoch},
      "Read-only lookup must never replace pending UUID or new epoch");
    assert.equal(await alert.isVisible(),true);
    for(const name of ["Create quote","Create order"]){
      assert.equal(await page.getByRole("button",{name}).isDisabled(),true,
        "No production write may resume without manual review: "+name);
    }
    assert.deepEqual(actions,["status_receipt_lookup"],
      "No quote/order/status mutation must leave the browser");
    assert.deepEqual(httpStatuses,[200],
      "A real signed successful Next response must be vetoed as stale by React");
    assert.deepEqual(browserErrors,[]);
    await mkdir(out,{recursive:true});
    await page.screenshot({path:path.join(out,"same-key-epoch-"+width+".png"),fullPage:true});
    return {width,originalUuidUnchanged:true,epochChanged:true,
      signedReadOnlyHttp:true,staleReceiptVeto:true,writeHoldRetained:true,
      productionMutations:0,syntheticOnly:true};
  }finally{await context.close();}
}
async function main(){
  const browser=await chromium.launch({headless:true});
  try{
    const widths=[];
    for(const width of [390,768,1440])widths.push(await runViewport(browser,width));
    await mkdir(out,{recursive:true});
    await writeFile(path.join(out,"summary.json"),JSON.stringify({
      source:"CI-only signed status receipt same-key write epoch test",
      realOperatorEvidence:false,realSqlEvidence:false,physicalEvidence:false,widths,
    },null,2));
    console.log("M149 signed Chromium status receipt same-key epoch veto PASS.");
    console.log("No real production write, live SQL, supplier stock, model QA or human signoff.");
  }finally{
    await setMode("valid");
    await browser.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
