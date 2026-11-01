"use strict";
// M147: actual signed operator React browser -> built-Next POST -> synthetic
// loopback SQL creation receipt. No interception of positive or failure HTTP.
// Never clear a production write hold; no real create or status mutation.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {createRequire}=require("node:module");
const {mkdir,writeFile}=require("node:fs/promises");
const path=require("node:path");
const {FIXTURE_KEY}=require("./ci-verified-stock-fixture.cjs");

if(process.env.CI!=="true"||process.env.GITHUB_ACTIONS!=="true")
  throw Error("M147 signed creation receipt React/HTTP browser acceptance is CI-only.");
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
assert.ok(runtime,"Pinned Playwright runtime is required.");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
// Keep the browser origin canonical: server CSRF protection is NOT bypassed.
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://localhost:3000");
assert.equal(base.protocol,"http:");
assert.ok(["localhost","127.0.0.1","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
const holdKey="linen-earth:production:unverified-write:v1";
const epochKey="linen-earth:production:write-epoch:v1";
const requestKey="123e4567-e89b-42d3-a456-426614174071";
const beforeEpoch="123e4567-e89b-42d3-a456-426614174120";
const afterEpoch="9b4216ea-8df6-45a4-8a5c-2f1f91ad283e";
const quoteId="123e4567-e89b-42d3-a456-426614174010";
const orderId="123e4567-e89b-42d3-a456-426614174011";
const out=path.resolve("artifacts/preview-lifecycle/creation-receipt-http-browser");

function cookie(){
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+180000})).toString("base64url");
  return {name:"linen_operator_session",
    value:payload+"."+createHmac("sha256",secret).update(payload).digest("base64url"),
    url:base.toString(),httpOnly:true,secure:false,sameSite:"Lax"};
}
async function setMode(mode){
  const r=await fetch("http://127.0.0.1:54324/__fixture/creation-receipt-mode",{
    method:"POST",cache:"no-store",signal:AbortSignal.timeout(10000),
    headers:{apikey:FIXTURE_KEY,"content-type":"application/json"},
    body:JSON.stringify({mode}),
  });
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{ciFixture:true,mode});
}
async function assertReview(page,epoch=beforeEpoch){
  const values=await page.evaluate(({holdKey,epochKey})=>({
    hold:localStorage.getItem(holdKey),epoch:localStorage.getItem(epochKey),
  }),{holdKey,epochKey});
  assert.deepEqual(values,{hold:requestKey,epoch},
    "Original request UUID and write epoch must survive read-only recovery");
  assert.equal(await page.getByRole("alert",{name:"Production write review required"}).isVisible(),true);
  for(const name of ["Create quote","Create order"]){
    assert.equal(await page.getByRole("button",{name}).isDisabled(),true,
      "No original write can be retried during review: "+name);
  }
}
async function runViewport(browser,width){
  const context=await browser.newContext({viewport:{width,height:880},reducedMotion:"reduce"});
  await context.addCookies([cookie()]);
  const page=await context.newPage();
  const actualPosts=[];
  const postStatuses=[];
  const browserErrors=[];
  page.on("pageerror",e=>browserErrors.push(e.message));
  page.on("request",r=>{
    if(r.method()==="POST"&&new URL(r.url()).pathname==="/api/operator/production"){
      let action="invalid";
      try{action=r.postDataJSON()?.action;}catch{}
      actualPosts.push(action);
    }
  });
  page.on("response",r=>{
    if(r.request().method()==="POST"&&new URL(r.url()).pathname==="/api/operator/production")
      postStatuses.push(r.status());
  });
  try{
    await setMode("valid");
    await page.addInitScript(({holdKey,epochKey,requestKey,beforeEpoch})=>{
      localStorage.setItem(holdKey,requestKey);
      localStorage.setItem(epochKey,beforeEpoch);
    },{holdKey,epochKey,requestKey,beforeEpoch});
    await page.goto(new URL("/operator/production",base).toString(),{
      waitUntil:"domcontentloaded",timeout:20000,
    });
    const review=page.getByRole("alert",{name:"Production write review required"});
    await review.waitFor({state:"visible",timeout:20000});
    const approve=page.getByRole("button",{name:"I reviewed history — enable writes"});
    await approve.waitFor({state:"visible",timeout:20000});
    await page.waitForFunction(()=>{
      const b=[...document.querySelectorAll("button")]
        .find(x=>x.textContent?.includes("I reviewed history"));
      return b&&!b.disabled;
    },{},{timeout:20000});
    await assertReview(page);

    const lookup=page.getByRole("button",{name:"Find original quote/order receipt by request ID"});
    const receipts=page.locator('[aria-label="Original committed creation receipts"]');
    await lookup.click();
    try{
      await receipts.getByText("COMMITTED CREATION RECEIPTS").waitFor({
        state:"visible",timeout:15000,
      });
    }catch(error){
      const state=await page.evaluate(()=>({
        message:document.querySelector("p.productionMessage[role=status]")?.textContent||"",
        locationPath:location.pathname,
        reviewVisible:!!document.querySelector('[aria-label="Production write review required"]'),
      }));
      throw Error("M147 real signed creation receipt browser transport mismatch: "+
        JSON.stringify({width,state,actualPosts,postStatuses,browserErrors})+
        "; original: "+String(error));
    }
    const committed=await receipts.innerText();
    assert.match(committed,new RegExp(quoteId));
    assert.match(committed,new RegExp(orderId));
    assert.doesNotMatch(committed,/DO-NOT-LEAK-CI-|customerPhone|private_/i);
    await assertReview(page);

    await setMode("empty");
    await lookup.click();
    await receipts.getByText("No committed creation receipt found for this request ID yet",{
      exact:false,
    }).waitFor({state:"visible",timeout:15000});
    assert.doesNotMatch(await receipts.innerText(),/COMMITTED CREATION RECEIPTS/);
    await assertReview(page);

    await setMode("upstream");
    await lookup.click();
    await page.getByRole("status").filter({
      hasText:"Original production receipt could not be verified",
    }).waitFor({state:"visible",timeout:15000});
    assert.equal(await receipts.count(),0,
      "After a failed receipt lookup, prior success/empty state cannot remain as evidence.");
    await assertReview(page);

    // Deliberately defer the browser's *actual* native fetch, then keep the
    // original UUID but change the write epoch. A stale successful SQL reply
    // must be rejected by React's generation snapshot.
    await setMode("valid");
    await page.evaluate(()=>{
      const nativeFetch=window.fetch.bind(window);
      let release=null,intercepted=0;
      window.__m147CreationRace={
        get intercepted(){return intercepted;},
        release(){if(!release)throw Error("Missing deferred receipt lookup.");
          const next=release;release=null;next();
        },
      };
      window.fetch=(input,init)=>{
        const url=new URL(typeof input==="string"?input:input.url,location.href);
        let body=null;
        try{body=JSON.parse(init?.body);}catch{}
        if(url.pathname==="/api/operator/production"&&init?.method==="POST"
          &&body?.action==="creation_receipt_lookup"){
          intercepted++;
          return new Promise((resolve,reject)=>{
            release=()=>nativeFetch(input,init).then(resolve,reject);
          });
        }
        return nativeFetch(input,init);
      };
    });
    await lookup.click();
    await page.waitForFunction(()=>window.__m147CreationRace?.intercepted===1,
      {},{timeout:15000});
    await page.evaluate(({epochKey,afterEpoch})=>localStorage.setItem(epochKey,afterEpoch),
      {epochKey,afterEpoch});
    assert.equal(await lookup.isDisabled(),true,"Pending lookup must remain busy");
    await page.evaluate(()=>window.__m147CreationRace.release());
    await page.getByRole("status").filter({
      hasText:"Original production receipt could not be verified",
    }).waitFor({state:"visible",timeout:15000});
    await page.waitForFunction(()=>{
      const b=[...document.querySelectorAll("button")]
        .find(x=>x.textContent?.includes("Find original quote/order receipt by request ID"));
      return b&&!b.disabled;
    },{},{timeout:15000});
    assert.equal(await receipts.count(),0,
      "Old same-key receipt must not be presented after an epoch change");
    await assertReview(page,afterEpoch);

    assert.ok(actualPosts.length>=4,"Expected genuine built-Next read-only lookup HTTP requests");
    assert.ok(actualPosts.every(action=>action==="creation_receipt_lookup"),
      "A signed CI browser must NEVER issue quote/order/status mutation POSTs");
    assert.ok(postStatuses.includes(200)&&postStatuses.includes(409),
      "Genuine successful and failed transport responses must be exercised");
    assert.deepEqual(browserErrors,[],"No browser JavaScript exception");
    await mkdir(out,{recursive:true});
    await page.screenshot({path:path.join(out,"hold-"+width+".png"),fullPage:true});
    return {width,signedHttpPositive:true,emptyStillHeld:true,upstreamFailClosed:true,
      changedEpochVeto:true,productionMutations:0,syntheticOnly:true};
  }finally{await context.close();}
}
async function main(){
  const browser=await chromium.launch({headless:true});
  try{
    const widths=[];
    for(const width of [390,768,1440])widths.push(await runViewport(browser,width));
    await mkdir(out,{recursive:true});
    await writeFile(path.join(out,"summary.json"),JSON.stringify({
      source:"CI-only real signed built-Next React creation lookup browser",
      realOperatorEvidence:false,realSqlEvidence:false,physicalEvidence:false,
      realSupplierStock:false,widths,
    },null,2));
    console.log("M147 signed Chromium real creation receipt HTTP and unchanged hold PASS.");
    console.log("No real production order, mutation, supplier stock, human QC or paid AI.");
  }finally{
    await setMode("valid");
    await browser.close();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
