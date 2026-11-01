"use strict";
// M138: native Chromium Web Locks contention on the actual TypeScript helper.
// Signed loopback CI only. Synthetic POST counter; never sends a production POST.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {createRequire}=require("node:module");
const {readFileSync}=require("node:fs");
const {mkdir,writeFile}=require("node:fs/promises");
const path=require("node:path");
const ts=require("typescript");
if(process.env.GITHUB_ACTIONS!=="true"||process.env.CI!=="true")
  throw Error("M138 browser proof is restricted to signed GitHub Actions CI.");
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
assert.ok(runtime,"Pinned Playwright runtime required");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
assert.equal(base.protocol,"http:");
assert.ok(["127.0.0.1","localhost","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
const out=path.resolve("artifacts/preview-lifecycle/production-native-web-locks");
const source=readFileSync("src/lib/designer/production-write-hold.ts","utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText;
// Execute the production helper itself in Chromium, not a rewritten mock.
const initScript="(()=>{const exports={};\n"+compiled+
  "\nwindow.__titanHold=exports;})();";
const firstId="6ab32c09-283e-4521-81e5-6b4c2d2f9101";
const secondId="6ab32c09-283e-4521-81e5-6b4c2d2f9102";
function cookie(){
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+180000})).toString("base64url");
  return {name:"linen_operator_session",value:payload+"."+
    createHmac("sha256",secret).update(payload).digest("base64url"),
    url:base.toString(),httpOnly:true,secure:false,sameSite:"Lax"};
}
async function runViewport(browser,width){
  const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:"reduce"});
  await ctx.addCookies([cookie()]);
  await ctx.addInitScript({content:initScript});
  const a=await ctx.newPage(),b=await ctx.newPage();
  const errors=[],productionPosts=[];
  for(const page of [a,b]){
    page.on("pageerror",e=>errors.push(e.message));
    page.on("request",r=>{
      if(r.method()==="POST"&&new URL(r.url()).pathname==="/api/operator/production")
        productionPosts.push(r.url());
    });
  }
  try{
    await Promise.all([a,b].map(p=>p.goto(new URL("/operator/production",base).toString(),
      {waitUntil:"domcontentloaded",timeout:20000})));
    assert.equal(await a.evaluate(()=>typeof navigator.locks?.request),"function",
      "Native Chromium Web Locks must be supported; no simulated lock fallback");
    const expected=await b.evaluate(()=>
      window.__titanHold.captureProductionWriteReviewSnapshot(localStorage));
    assert.deepEqual(expected,{holdToken:null,epoch:""});
    // Tab A claims the real lock and marker, then simulates a pending POST.
    // Keep the native lock held while tab B queues behind it.
    await a.evaluate(token=>{
      const helper=window.__titanHold;
      const state={started:false,finished:false,syntheticPosts:0,claimResult:null};
      state.gate=new Promise(resolve=>{state.release=resolve;});
      window.__titanRace=state;
      state.promise=helper.beginProductionWriteHoldAtomically(
        localStorage,token,
        claim=>navigator.locks.request(helper.PRODUCTION_WRITE_LOCK_NAME,
          {mode:"exclusive"},async()=>{
            const ok=claim();
            state.started=true;
            state.claimResult=ok;
            await state.gate;
            if(ok){
              state.syntheticPosts+=1; // No HTTP or real supplier/order mutation.
              if(!helper.releaseProductionWriteHold(localStorage,token))throw Error("Synthetic hold release failed");
            }
            return ok;
          }),
        helper.captureProductionWriteReviewSnapshot(localStorage),
      ).then(result=>{state.finished=true;state.result=result;});
    },firstId);
    await a.waitForFunction(()=>window.__titanRace?.started,{}, {timeout:10000});
    assert.equal(await a.evaluate(()=>window.__titanRace.claimResult),true);
    // Tab B's previously captured snapshot is deliberately stale; its
    // actual helper call must queue on native Web Locks, not race the marker.
    await b.evaluate(({token,expected})=>{
      const helper=window.__titanHold;
      const state={completed:false,claimCallbacks:0,syntheticPosts:0};
      window.__titanRace=state;
      state.promise=helper.beginProductionWriteHoldAtomically(
        localStorage,token,
        claim=>navigator.locks.request(helper.PRODUCTION_WRITE_LOCK_NAME,
          {mode:"exclusive"},()=>{
            state.claimCallbacks+=1;
            const ok=claim();
            if(ok)state.syntheticPosts+=1;
            return ok;
          }),expected,
      ).then(result=>{state.completed=true;state.result=result;});
    },{token:secondId,expected});
    await b.waitForFunction(async()=>{
      const name=window.__titanHold.PRODUCTION_WRITE_LOCK_NAME;
      const state=await navigator.locks.query();
      return state.pending.some(lock=>lock.name===name);
    },{}, {timeout:10000});
    assert.equal(await b.evaluate(()=>window.__titanRace.completed),false,
      "Tab B must wait for the native exclusive lock");
    // Tab A completes its synthetic write AND removes the hold before B
    // enters the critical section. Only the retained epoch reveals the race.
    await a.evaluate(()=>window.__titanRace.release());
    await a.waitForFunction(()=>window.__titanRace.finished,{}, {timeout:10000});
    await b.waitForFunction(()=>window.__titanRace.completed,{}, {timeout:10000});
    assert.equal(await a.evaluate(()=>window.__titanRace.result),true);
    assert.equal(await b.evaluate(()=>window.__titanRace.result),false,
      "Stale epoch must reject tab B even after tab A's hold disappears");
    assert.equal(await b.evaluate(()=>window.__titanRace.claimCallbacks),1);
    assert.equal(await a.evaluate(()=>window.__titanRace.syntheticPosts),1);
    assert.equal(await b.evaluate(()=>window.__titanRace.syntheticPosts),0);
    const state=await b.evaluate(()=>{
      const h=window.__titanHold;
      return {pending:localStorage.getItem(h.PRODUCTION_WRITE_HOLD_KEY),
        epoch:localStorage.getItem(h.PRODUCTION_WRITE_EPOCH_KEY)};
    });
    assert.deepEqual(state,{pending:null,epoch:firstId});
    // Positive recovery: a fresh snapshot after the completed write may
    // acquire a NEW exclusive claim. Otherwise the test could pass vacuously.
    const recovered=await b.evaluate(async token=>{
      const h=window.__titanHold;
      const snapshot=h.captureProductionWriteReviewSnapshot(localStorage);
      const ok=await h.beginProductionWriteHoldAtomically(
        localStorage,token,
        claim=>navigator.locks.request(h.PRODUCTION_WRITE_LOCK_NAME,{mode:"exclusive"},claim),
        snapshot);
      if(ok&&!h.releaseProductionWriteHold(localStorage,token))throw Error("Fresh claim release failed");
      return ok;
    },secondId);
    assert.equal(recovered,true,"Freshly verified history must permit a later claim");
    // Chromium can deliver a cross-tab localStorage removal after the writer\'s
    // Promise resolves. Do not start the NEXT synthetic session against a stale
    // storage view: wait for both tabs to observe the confirmed release/epoch.
    await a.waitForFunction(token=>{
      const h=window.__titanHold;
      return localStorage.getItem(h.PRODUCTION_WRITE_HOLD_KEY)===null
        &&localStorage.getItem(h.PRODUCTION_WRITE_EPOCH_KEY)===token;
    },secondId,{timeout:10000});
    // M139: an in-flight production POST holds a separate Web Lock until
    // SQL result/readback settles. A second tab must NOT acknowledge its
    // marker even after a stale (capped) history GET appeared successful.
    await a.evaluate(token=>{
      const h=window.__titanHold;
      const prior={pending:localStorage.getItem(h.PRODUCTION_WRITE_HOLD_KEY),
        epoch:localStorage.getItem(h.PRODUCTION_WRITE_EPOCH_KEY),token};
      if(!h.beginProductionWriteHold(localStorage,token))
        throw Error("Synthetic active marker missing: "+JSON.stringify(prior));
      const state={held:false,finished:false};
      state.gate=new Promise(resolve=>{state.release=resolve;});
      window.__titanSession=state;
      state.promise=navigator.locks.request(h.PRODUCTION_WRITE_SESSION_LOCK_NAME,
        {mode:"exclusive"},async()=>{
          state.held=true;
          await state.gate; // Synthetic pending SQL, never an actual HTTP POST.
        }).then(()=>{state.finished=true;});
    },firstId);
    await a.waitForFunction(()=>window.__titanSession?.held,{}, {timeout:10000});
    const blockedAck=await b.evaluate(token=>{
      const h=window.__titanHold;
      return navigator.locks.request(h.PRODUCTION_WRITE_SESSION_LOCK_NAME,
        {mode:"exclusive",ifAvailable:true},lock=>
          lock? h.acknowledgeProductionWriteHold(localStorage,token):false);
    },firstId);
    assert.equal(blockedAck,false,
      "Second tab must not acknowledge an actively in-flight production write");
    assert.equal(await b.evaluate(()=>localStorage.getItem(
      window.__titanHold.PRODUCTION_WRITE_HOLD_KEY)),firstId);
    await a.evaluate(()=>window.__titanSession.release());
    await a.waitForFunction(()=>window.__titanSession.finished,{}, {timeout:10000});
    // A fresh post-session review is now allowed to clear the exact marker.
    // ProductionClient independently requires a NEW verified GET and click.
    const recoveredAck=await b.evaluate(token=>{
      const h=window.__titanHold;
      return navigator.locks.request(h.PRODUCTION_WRITE_SESSION_LOCK_NAME,
        {mode:"exclusive",ifAvailable:true},lock=>
          lock? h.acknowledgeProductionWriteHold(localStorage,token):false);
    },firstId);
    assert.equal(recoveredAck,true,
      "A completed session must allow deliberate recovery of its exact marker");
    assert.equal(await b.evaluate(()=>localStorage.getItem(
      window.__titanHold.PRODUCTION_WRITE_HOLD_KEY)),null);
    // M140: exercise the REAL React order-status handler, not only the helper.
    // The fetch is intercepted in tab A before any HTTP request reaches Next.
    // Tab B must not acknowledge A's pending marker during the deferred POST.
    await Promise.all([a,b].map(page=>page.reload({
      waitUntil:"domcontentloaded",timeout:20000,
    })));
    const statusSelect=a.locator("section.productionRecord select").first();
    await statusSelect.waitFor({state:"visible",timeout:15000});
    await a.waitForFunction(()=>{
      const select=document.querySelector("section.productionRecord select");
      return select&&!select.disabled;
    },{}, {timeout:15000});
    await a.evaluate(()=>{
      const original=window.fetch.bind(window);
      const state={started:false,requests:0,release:null};
      window.__titanUiDeferredPost=state;
      window.fetch=(input,init)=>{
        const url=new URL(typeof input==="string"?input:input.url,location.href);
        if(url.pathname==="/api/operator/production"&&init?.method==="POST"){
          state.started=true;
          state.requests++;
          return new Promise(resolve=>{
            state.release=()=>resolve(new Response(
              JSON.stringify({error:"Synthetic prewrite denial; no SQL was called."}),
              {status:400,headers:{"content-type":"application/json"}},
            ));
          });
        }
        return original(input,init);
      };
    });
    await statusSelect.selectOption("cloth_reserved");
    await a.waitForFunction(()=>window.__titanUiDeferredPost?.started
      &&typeof window.__titanUiDeferredPost.release==="function",{}, {timeout:15000});
    const activeMarker=await a.evaluate(()=>
      localStorage.getItem(window.__titanHold.PRODUCTION_WRITE_HOLD_KEY));
    assert.match(activeMarker,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
    assert.equal(await a.evaluate(async()=>{
      const h=window.__titanHold;
      const locks=await navigator.locks.query();
      return locks.held.some(lock=>lock.name===h.PRODUCTION_WRITE_SESSION_LOCK_NAME);
    }),true,"Actual React production handler must hold the native session lock while POST is deferred");
    await b.waitForFunction(token=>localStorage.getItem(
      window.__titanHold.PRODUCTION_WRITE_HOLD_KEY)===token,activeMarker,{timeout:15000});
    await b.getByRole("button",{name:"Refresh production history"}).click();
    const reviewButton=b.getByRole("button",{name:"I reviewed history — enable writes"});
    await reviewButton.waitFor({state:"visible",timeout:15000});
    await b.waitForFunction(()=>{
      const button=[...document.querySelectorAll("button")]
        .find(el=>el.textContent?.includes("I reviewed history"));
      return button&&!button.disabled;
    },{}, {timeout:15000});
    await reviewButton.click();
    await b.getByText("Another tab has an active production write",{
      exact:false,
    }).waitFor({timeout:15000});
    assert.equal(await b.evaluate(()=>
      localStorage.getItem(window.__titanHold.PRODUCTION_WRITE_HOLD_KEY)),activeMarker,
    "Real React review must not clear a different tab's deferred production POST");
    await a.evaluate(()=>window.__titanUiDeferredPost.release());
    await a.waitForFunction(async()=>{
      const h=window.__titanHold;
      const locks=await navigator.locks.query();
      return localStorage.getItem(h.PRODUCTION_WRITE_HOLD_KEY)===null
        &&!locks.held.some(lock=>lock.name===h.PRODUCTION_WRITE_SESSION_LOCK_NAME);
    },{}, {timeout:15000});
    await b.waitForFunction(()=>localStorage.getItem(
      window.__titanHold.PRODUCTION_WRITE_HOLD_KEY)===null,{}, {timeout:15000});
    assert.equal(await a.evaluate(()=>window.__titanUiDeferredPost.requests),1,
      "Exactly one synthetic UI POST was intercepted");
    assert.deepEqual(productionPosts,[],
      "Real UI contention test must never send a production POST over HTTP");
    // Unavailable lock must fail closed without any new pending marker.
    assert.equal(await b.evaluate(async()=>{
      const h=window.__titanHold;
      return h.beginProductionWriteHoldAtomically(localStorage,
        "6ab32c09-283e-4521-81e5-6b4c2d2f9103",null,
        h.captureProductionWriteReviewSnapshot(localStorage));
    }),false);
    assert.deepEqual(productionPosts,[],"No real production POST in synthetic CI");
    assert.deepEqual(errors,[],"No uncaught browser exceptions");
    await mkdir(out,{recursive:true});
    await b.screenshot({path:path.join(out,"native-web-locks-"+width+".png"),fullPage:true});
    return {width,nativeWebLocks:true,queuedBehindExclusiveLock:true,
      completedEpochBlocksStaleClaim:true,syntheticPostsFirst:1,
      syntheticPostsSecond:0,freshRecovery:true,unsupportedLockFailsClosed:true,
      activeSessionAcknowledgementBlocked:true,postSessionAcknowledgementRecovered:true,
      realProductionPosts:0,syntheticOnly:true};
  }finally{await ctx.close();}
}
(async()=>{
  await mkdir(out,{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    const viewports=[];
    for(const width of [390,1440])viewports.push(await runViewport(browser,width));
    await writeFile(path.join(out,"summary.json"),JSON.stringify({
      synthetic:true,humanEvidence:false,stockEvidence:false,physicalEvidence:false,
      browserNativeLocks:true,viewports,
    },null,2)+"\n");
    console.log("M138/M139 native two-tab Web Locks safety PASS",viewports);
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
