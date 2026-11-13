"use strict";
// Signed actual React operator UI acceptance: an unchanged request UUID with a
// changed write epoch MUST NOT display a stale committed creation receipt.
// All receipts are synthetic in-browser data; no real production SQL or POST.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {createRequire}=require("node:module");
const {mkdir,writeFile}=require("node:fs/promises");
const path=require("node:path");

if(process.env.CI!=="true"||process.env.GITHUB_ACTIONS!=="true"){
  throw Error("M145 signed creation-receipt epoch browser QA is CI-only.");
}
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
assert.ok(runtime,"Pinned Playwright runtime is required.");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
assert.equal(base.protocol,"http:");
assert.ok(["127.0.0.1","localhost","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
const markerKey="linen-earth:production:unverified-write:v1";
const epochKey="linen-earth:production:write-epoch:v1";
const original="123e4567-e89b-42d3-a456-426614174100";
const before="123e4567-e89b-42d3-a456-426614174120";
const after="9b4216ea-8df6-45a4-8a5c-2f1f91ad283e";
const receipt="123e4567-e89b-42d3-a456-426614174010";
const out=path.resolve("artifacts/preview-lifecycle/creation-receipt-epoch");

function signedCookie(){
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+180_000})).toString("base64url");
  return {name:"linen_operator_session",
    value:payload+"."+createHmac("sha256",secret).update(payload).digest("base64url"),
    url:base.toString(),httpOnly:true,secure:false,sameSite:"Lax"};
}
async function assertStillHeld(page){
  const snapshot=await page.evaluate(({markerKey,epochKey})=>({
    marker:localStorage.getItem(markerKey),epoch:localStorage.getItem(epochKey),
  }),{markerKey,epochKey});
  assert.equal(snapshot.marker,original,"The original uncertain request UUID must be retained.");
  assert.equal(snapshot.epoch,after,"The later epoch must not be reversed by a lookup.");
  const review=page.getByRole("alert",{name:"Production write review required"});
  assert.equal(await review.isVisible(),true,"Operator review must remain visible.");
  for(const name of ["Create quote","Create order"]){
    assert.equal(await page.getByRole("button",{name}).isDisabled(),true,
      "Creation must remain disabled during unresolved review: "+name);
  }
}
async function runViewport(browser,width){
  const context=await browser.newContext({viewport:{width,height:880},reducedMotion:"reduce"});
  await context.addCookies([signedCookie()]);
  const page=await context.newPage();
  const browserErrors=[];
  const actualWrites=[];
  page.on("pageerror",err=>browserErrors.push(err.message));
  page.on("request",request=>{
    if(new URL(request.url()).pathname==="/api/operator/production"&&request.method()==="POST"){
      actualWrites.push(request.postData()||"");
    }
  });
  try{
    await page.addInitScript(({markerKey,epochKey,original,before})=>{
      localStorage.setItem(markerKey,original);
      localStorage.setItem(epochKey,before);
    },{markerKey,epochKey,original,before});
    await page.goto(new URL("/operator/production",base).toString(),{
      waitUntil:"domcontentloaded",timeout:20_000,
    });
    const review=page.getByRole("alert",{name:"Production write review required"});
    await review.waitFor({state:"visible",timeout:20_000});
    // Only start tests after signed backend history has loaded and the actual
    // React operator view has rendered its verified-generation review control.
    const acknowledge=page.getByRole("button",{name:"I reviewed history — enable writes"});
    await acknowledge.waitFor({state:"visible",timeout:20_000});
    await page.waitForFunction(()=>{
      const b=[...document.querySelectorAll("button")].find(
        x=>x.textContent?.includes("I reviewed history"));
      return b&&!b.disabled;
    },{},{timeout:20_000});

    await page.evaluate(receipt=>{
      const nativeFetch=window.fetch.bind(window);
      let deferred=false;
      let release=null;
      let intercepted=0;
      const reply=()=>new Response(JSON.stringify({
        receipts:[{action:"create_quote",receiptId:receipt}],
      }),{status:200,headers:{"content-type":"application/json"}});
      window.__m145Race={
        get intercepted(){return intercepted;},
        defer(){deferred=true;},
        release(){
          if(!release)throw Error("No deferred creation receipt request.");
          const complete=release;release=null;complete(reply());
        },
      };
      window.fetch=(input,init)=>{
        const raw=typeof input==="string"?input:input.url;
        const url=new URL(raw,location.href);
        let body=null;
        try{body=JSON.parse(init?.body);}catch{}
        if(url.pathname==="/api/operator/production"
          &&init?.method==="POST"&&body?.action==="creation_receipt_lookup"){
          intercepted++;
          return deferred
            ?new Promise(resolve=>{release=resolve;})
            :Promise.resolve(reply());
        }
        return nativeFetch(input,init);
      };
    },receipt);

    const lookup=page.getByRole("button",{name:"Find original quote/order receipt by request ID"});
    await lookup.waitFor({state:"visible",timeout:20_000});
    await lookup.click();
    const receipts=page.locator('[aria-label="Original committed creation receipts"]');
    await receipts.getByText("COMMITTED CREATION RECEIPTS").waitFor({
      state:"visible",timeout:15_000,
    });
    assert.match(await receipts.innerText(),new RegExp(receipt));

    await page.evaluate(()=>window.__m145Race.defer());
    await lookup.click();
    await page.waitForFunction(()=>window.__m145Race?.intercepted===2,{},{timeout:15_000});
    // Same UUID, changed epoch: the old request is still in localStorage,
    // but another write generation means this older response is not current.
    await page.evaluate(({epochKey,after})=>localStorage.setItem(epochKey,after),{
      epochKey,after,
    });
    await page.evaluate(()=>window.__m145Race.release());
    await page.getByRole("status").filter({
      hasText:"Original production receipt could not be verified",
    }).waitFor({state:"visible",timeout:15_000});
    assert.equal(await receipts.count(),0,
      "An older receipt must not be displayed for a superseded write generation.");
    await assertStillHeld(page);
    assert.deepEqual(actualWrites,[],
      "All creation receipt requests must be synthetic browser fixtures; no real production POST.");
    assert.deepEqual(browserErrors,[],"No browser JavaScript error.");
    await mkdir(out,{recursive:true});
    await page.screenshot({path:path.join(out,"epoch-veto-"+width+".png"),fullPage:true});
    return {width,positiveRendered:true,changedEpochVeto:true,originalHoldRetained:true,
      actualProductionPosts:0,syntheticOnly:true};
  }finally{await context.close();}
}
async function main(){
  const browser=await chromium.launch({headless:true});
  try{
    const viewports=[];
    for(const width of [390,768,1440])viewports.push(await runViewport(browser,width));
    await mkdir(out,{recursive:true});
    await writeFile(path.join(out,"summary.json"),JSON.stringify({
      source:"CI-only signed React operator browser with intercepted synthetic creation receipt",
      realOperatorEvidence:false,realSqlEvidence:false,physicalEvidence:false,viewports,
    },null,2));
    console.log("M145 signed Chromium creation receipt same-key epoch veto PASS.");
    console.log("No live SQL, real production write, private customer data or owner signoff.");
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
