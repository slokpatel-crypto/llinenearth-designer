"use strict";
// M144: Exercise the actual operator React UI with a signed browser session.
// All status receipts and production history are synthetic CI loopback data.
// This test performs read-only lookup POSTs only. Never clear the human review hold.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {createRequire}=require("node:module");
const {mkdir,writeFile}=require("node:fs/promises");
const path=require("node:path");
const {FIXTURE_KEY}=require("./ci-verified-stock-fixture.cjs");

if(process.env.GITHUB_ACTIONS!=="true"||process.env.CI!=="true"){
  throw Error("M144 signed status-receipt browser test is GitHub Actions CI-only.");
}
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
assert.ok(runtime,"Pinned Playwright runtime is required");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
assert.equal(base.protocol,"http:");
assert.ok(["127.0.0.1","localhost","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
const holdKey="linen-earth:production:unverified-write:v1";
const originalKey="123e4567-e89b-42d3-a456-426614174070";
const changedKey="9b4216ea-8df6-45a4-8a5c-2f1f91ad283e";
const out=path.resolve("artifacts/preview-lifecycle/status-receipt-browser");

function cookie(){
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+180_000})).toString("base64url");
  return {name:"linen_operator_session",
    value:payload+"."+createHmac("sha256",secret).update(payload).digest("base64url"),
    url:base.toString(),httpOnly:true,secure:false,sameSite:"Lax"};
}
async function setMode(mode){
  const response=await fetch("http://127.0.0.1:54324/__fixture/status-receipt-mode",{
    method:"POST",cache:"no-store",signal:AbortSignal.timeout(10_000),
    headers:{apikey:FIXTURE_KEY,"content-type":"application/json"},
    body:JSON.stringify({mode}),
  });
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ciFixture:true,mode});
}
async function assertHold(page,key=originalKey){
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),holdKey),key,
    "Signed browser status receipt lookup must not clear or replace the pending write marker");
  assert.equal(await page.getByRole("alert",{name:"Production write review required"}).isVisible(),true,
    "The uncertain production write must remain under manual review");
  for(const name of ["Create quote","Create order"]){
    assert.equal(await page.getByRole("button",{name}).isDisabled(),true,
      name+" must remain unavailable during an uncertain production write");
  }
}
async function runViewport(browser,width){
  const ctx=await browser.newContext({viewport:{width,height:880},reducedMotion:"reduce"});
  await ctx.addCookies([cookie()]);
  const page=await ctx.newPage();
  const errors=[];
  const productionPostActions=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",request=>{
    if(request.method()==="POST"&&new URL(request.url()).pathname==="/api/operator/production"){
      let action="invalid";
      try{action=request.postDataJSON().action;}catch{}
      productionPostActions.push(action);
    }
  });
  try{
    await setMode("valid");
    await page.addInitScript(({holdKey,originalKey})=>{
      localStorage.setItem(holdKey,originalKey);
    },{holdKey,originalKey});
    await page.goto(new URL("/operator/production",base).toString(),{
      waitUntil:"domcontentloaded",timeout:20_000,
    });
    const lookup=page.getByRole("button",{name:"Find original status receipt by request ID"});
    await lookup.waitFor({state:"visible",timeout:20_000});
    // The initial authorized ledger GET must have independently validated and
    // rendered before receipt recovery begins. Otherwise a test can click while
    // React is still mounting its operator review state.
    const review=page.getByRole("button",{name:"I reviewed history — enable writes"});
    await review.waitFor({state:"visible",timeout:20_000});
    await page.waitForFunction(()=>{
      const button=[...document.querySelectorAll("button")]
        .find(item=>item.textContent?.includes("I reviewed history"));
      return button&&!button.disabled;
    },{},{timeout:20_000});
    await assertHold(page);

    // A committed receipt is information for manual comparison, NOT permission
    // to retry the write or remove its crash-recovery marker.
    await lookup.click();
    const receipts=page.locator('[aria-label="Original committed status receipts"]');
    await receipts.getByText("COMMITTED STATUS RECEIPTS").waitFor({state:"visible",timeout:15_000});
    const committedText=await receipts.innerText();
    assert.match(committedText,/123e4567-e89b-42d3-a456-426614174010/);
    assert.match(committedText,/committed status: accepted/);
    assert.match(committedText,/123e4567-e89b-42d3-a456-426614174011/);
    assert.match(committedText,/committed status: delivered/);
    await assertHold(page);

    // Absence in a bounded read is not proof a concurrent SQL transaction did
    // not commit; the browser must show the uncertainty and keep the hold.
    await setMode("empty");
    await lookup.click();
    await receipts.getByText("This is NOT proof that retrying is safe",{exact:false})
      .waitFor({state:"visible",timeout:15_000});
    assert.doesNotMatch(await receipts.innerText(),/COMMITTED STATUS RECEIPTS/);
    await assertHold(page);

    // An upstream failure must remove the older success from the screen and
    // retain the original request key for independent investigation.
    await setMode("upstream");
    await lookup.click();
    await page.getByRole("status").filter({
      hasText:"Original status receipt could not be verified",
    }).waitFor({state:"visible",timeout:15_000});
    assert.equal(await receipts.count(),0,"A failed lookup must revoke the previous receipt display");
    await assertHold(page);

    // Defer the actual React lookup fetch. Change the anonymous marker in the
    // same tab while the SQL receipt response is pending. The old result must
    // never be displayed as evidence for the new marker.
    await setMode("valid");
    await page.evaluate(()=>{
      const nativeFetch=window.fetch.bind(window);
      let release=null;
      let intercepted=0;
      window.__titanStatusReceiptRace={
        get intercepted(){return intercepted;},
        release(){
          if(!release)throw Error("No pending status receipt fetch");
          const next=release;release=null;next();
        },
      };
      window.fetch=(input,options)=>{
        const raw=typeof input==="string"?input:input.url;
        const url=new URL(raw,location.href);
        let payload;
        try{payload=JSON.parse(options&&options.body);}catch{}
        if(url.pathname==="/api/operator/production"&&options?.method==="POST"
          &&payload?.action==="status_receipt_lookup"){
          intercepted++;
          return new Promise((resolve,reject)=>{
            release=()=>nativeFetch(input,options).then(resolve,reject);
          });
        }
        return nativeFetch(input,options);
      };
    });
    await lookup.click();
    await page.waitForFunction(()=>window.__titanStatusReceiptRace?.intercepted===1,
      {},{timeout:15_000});
    await page.evaluate(({holdKey,changedKey})=>{
      localStorage.setItem(holdKey,changedKey);
    },{holdKey,changedKey});
    await page.waitForFunction(()=>{
      const button=[...document.querySelectorAll("button")]
        .find(item=>item.textContent?.includes("Find original status receipt by request ID"));
      return button&&button.disabled;
    },{},{timeout:15_000});
    assert.equal(await lookup.isDisabled(),true,"Deferred lookup must still hold the UI action lock");
    await page.evaluate(()=>window.__titanStatusReceiptRace.release());
    await page.waitForFunction(()=>{
      const button=[...document.querySelectorAll("button")]
        .find(item=>item.textContent?.includes("Find original status receipt by request ID"));
      return button&&!button.disabled;
    },{},{timeout:15_000});
    await page.getByRole("status").filter({
      hasText:"Original status receipt could not be verified",
    }).waitFor({state:"visible",timeout:15_000});
    assert.equal(await receipts.count(),0,
      "A receipt for the superseded marker must never be shown as a committed fact");
    await assertHold(page,changedKey);

    assert.ok(productionPostActions.length>=4);
    assert.ok(productionPostActions.every(action=>action==="status_receipt_lookup"),
      "No create/status mutation POST may leave this signed synthetic browser");
    assert.deepEqual(errors,[],"No browser JavaScript exceptions");
    await mkdir(out,{recursive:true});
    await page.screenshot({path:path.join(out,"review-"+width+".png"),fullPage:true});
    return {width,committedShown:true,emptyStillHeld:true,upstreamFailClosed:true,
      changedMarkerVeto:true,writeMutations:0,syntheticOnly:true};
  }finally{await ctx.close();}
}
async function main(){
  const browser=await chromium.launch({headless:true});
  try{
    const viewports=[];
    for(const width of [390,768,1440])viewports.push(await runViewport(browser,width));
    await mkdir(out,{recursive:true});
    await writeFile(path.join(out,"summary.json"),JSON.stringify({
      source:"CI-only signed loopback operator browser",
      realOperatorEvidence:false,physicalEvidence:false,stockEvidence:false,
      realSqlReceiptEvidence:false,viewports,
    },null,2));
    console.log("M144 signed Chromium status-receipt UI hold and changed-marker veto PASS");
    console.log("No production write, live SQL, customer data or human signoff.");
  }finally{
    await setMode("valid");
    await browser.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
