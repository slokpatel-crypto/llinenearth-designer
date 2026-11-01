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
              assert.equal(helper.releaseProductionWriteHold(localStorage,token),true);
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
      if(ok)assert.equal(h.releaseProductionWriteHold(localStorage,token),true);
      return ok;
    },secondId);
    assert.equal(recovered,true,"Freshly verified history must permit a later claim");
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
    console.log("M138 native two-tab Web Locks safety PASS",viewports);
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
