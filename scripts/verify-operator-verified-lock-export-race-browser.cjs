"use strict";
// CI-only signed loopback browser proof. Vault revisions are synthetic and
// never persisted. No operator production POST, supplier stock or paid AI.
const assert=require("node:assert/strict");
const {createHmac,createHash}=require("node:crypto");
const {createRequire}=require("node:module");
const {readFile,mkdir,writeFile}=require("node:fs/promises");
const path=require("node:path");
if(process.env.GITHUB_ACTIONS!=="true"||process.env.CI!=="true"){
  throw Error("M134 operator lock browser regression only runs in GitHub Actions.");
}
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
assert.ok(runtime,"Pinned Playwright runtime required");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
assert.equal(base.protocol,"http:");
assert.ok(["127.0.0.1","localhost","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
const out=path.resolve("artifacts/preview-lifecycle/operator-verified-lock-export-race");
function canonicalize(value){
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==="object")return Object.fromEntries(
    Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
      .map(([key,item])=>[key,canonicalize(item)]));
  return value;
}
function revision(fabric){
  const spec={
    version:"linen-earth-garment-spec-v1",status:"draft",
    source:{designerRuleSetVersion:"rules-1",fitConstructionVersion:null,fitEaseSource:null,
      fitEaseTableVersion:null,measurementProfileVersion:null,blockStrategyVersion:null,styleSchemaVersion:null},
    styleSpec:null,bodyProfile:null,
    context:{occasion:"Semi-Formal",climate:"Not specified",intention:"Balanced"},
    fabrics:{
      shirt:{id:fabric,name:fabric,line:"Synthetic CI fabric",source:"catalogue",verifiedMaterialFacts:0},
      trouser:{id:"synthetic-trouser",name:"Synthetic trouser",line:"Synthetic CI",source:"catalogue",verifiedMaterialFacts:0},
    },
    shirt:{fit:"Regular",wear:"Tucked",collar:"Point",collarFinish:"Self-fabric",cuff:"Barrel",
      placket:"Standard",button:"Corozo",finishedTargets:[]},
    trouser:{shape:"Pleated",rise:"Mid Rise",waistband:"Side Adjuster",break:"Slight Break",finishedTargets:[]},
    creative:null,decision:{designFitScore:80,confidenceScore:72,fitConstructionScore:null,
      brandLanguageScore:null,blockStrategyScore:null},
    blockStrategy:null,constructionChecks:[],unresolved:["Synthetic CI only"],
    readiness:{visualization:"supported_with_current_template",tailoring:"insufficient_measurements",
      materialVerification:"verification_required"},caveats:["Not real inventory"],
  };
  const recipeHash=createHash("sha256").update(JSON.stringify(canonicalize(spec))).digest("hex");
  const lockedAt="2026-10-31T20:00:00.000Z";
  return {version:"linen-earth-design-lock-v1",
    revisionId:"LE-LOCK-20261031200000-"+recipeHash.slice(0,12).toUpperCase()+"-1111111111111111",
    parentRevisionId:null,recipeHash,lockedAt,garmentSpec:spec};
}
const A=revision("synthetic-shirt-A"),B=revision("synthetic-shirt-B");
function cookie(){
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+180_000})).toString("base64url");
  return {name:"linen_operator_session",
    value:payload+"."+createHmac("sha256",secret).update(payload).digest("base64url"),
    url:base.toString(),httpOnly:true,secure:false,sameSite:"Lax"};
}
async function runViewport(browser,width){
  const ctx=await browser.newContext({viewport:{width,height:850},acceptDownloads:true,reducedMotion:"reduce"});
  await ctx.addCookies([cookie()]);
  const page=await ctx.newPage();
  const errors=[],posts=[],downloads=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("download",d=>downloads.push(d.suggestedFilename()));
  page.on("request",r=>{
    if(r.method()==="POST"&&new URL(r.url()).pathname==="/api/operator/production")posts.push(r.url());
  });
  try{
    await page.addInitScript(({A,B})=>{
      const original=window.fetch.bind(window);
      let calls=0,releaseSecond=null;
      window.__titanVaultRace={
        get calls(){return calls;},
        releaseSecond(){if(!releaseSecond)throw Error("Second vault read not pending");
          const fn=releaseSecond;releaseSecond=null;fn();},
      };
      window.fetch=(input,init)=>{
        const raw=typeof input==="string"?input:input.url;
        const url=new URL(raw,location.href);
        if(url.pathname!=="/api/designer/vault"||init?.method!=="POST")return original(input,init);
        calls++;
        const response=()=>new Response(JSON.stringify({revision:calls===1?A:B}),
          {status:200,headers:{"content-type":"application/json"}});
        if(calls===2)return new Promise(resolve=>{releaseSecond=()=>resolve(response());});
        return Promise.resolve(response());
      };
    },{A,B});
    await page.goto(new URL("/operator/production",base).toString(),{waitUntil:"domcontentloaded",timeout:20_000});
    const token=page.locator(".productionLoadForm textarea");
    const load=page.getByRole("button",{name:"Load locked design"});
    const handoff=page.getByRole("button",{name:"Export tailor handoff"});
    await token.fill("lev1.synthetic-CI-token");
    // Wait for the React token state to commit before the first recovery click.
    // A slower CI render can leave this button disabled for a short interval.
    await page.waitForFunction(()=>{
      const b=[...document.querySelectorAll("button")]
        .find(x=>x.textContent?.includes("Load locked design"));
      return b&&!b.disabled;
    },{}, {timeout:15000});
    await load.click();
    await page.getByText("synthetic-shirt-A",{exact:true}).waitFor({timeout:15_000});
    // Positive control: this exact synthetic verified lock really is exportable.
    const firstDownload=page.waitForEvent("download",{timeout:15_000});
    await handoff.click();
    const first=await firstDownload;
    assert.equal(JSON.parse(await readFile(await first.path(),"utf8")).designRevisionId,A.revisionId);
    assert.equal(downloads.length,1);
    await page.waitForFunction(()=>{
      const button=[...document.querySelectorAll("button")]
        .find(b=>b.textContent?.includes("Export production packet"));
      return button&&!button.disabled;
    },{}, {timeout:15_000});

    // Same JS turn: begin a second asynchronous vault recovery, then click
    // all three stale export buttons before React has committed its clear.
    const sameTurn=await page.evaluate(()=>{
      const buttons=[...document.querySelectorAll("button")];
      const get=text=>buttons.find(b=>b.textContent?.includes(text));
      const reload=get("Load locked design");
      const handoff=get("Export tailor handoff");
      const tech=get("Export tech pack");
      const packet=get("Export production packet");
      if(!reload||!handoff||!tech||!packet||[reload,handoff,tech,packet].some(b=>b.disabled)){
        throw Error("Expected enabled original locked design export controls");
      }
      reload.click();handoff.click();tech.click();packet.click();
      return window.__titanVaultRace.calls;
    });
    assert.equal(sameTurn,2,"Second vault recovery must remain unresolved");
    await page.waitForTimeout(250);
    assert.equal(downloads.length,1,"Old locked design must not export while a new recovery is in flight");
    await page.evaluate(()=>window.__titanVaultRace.releaseSecond());
    await page.getByText("synthetic-shirt-B",{exact:true}).waitFor({timeout:15_000});
    const secondDownload=page.waitForEvent("download",{timeout:15_000});
    await handoff.click();
    const second=await secondDownload;
    assert.equal(JSON.parse(await readFile(await second.path(),"utf8")).designRevisionId,B.revisionId,
      "After recovery, export must use the new verified revision, never the old one");
    await token.fill("lev1.changed-token");
    await page.locator(".productionLoadedRecipe").waitFor({state:"hidden",timeout:10_000});
    assert.equal(downloads.length,2);
    assert.deepEqual(posts,[],"No production mutation is allowed in the synthetic browser test");
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(out,"verified-lock-"+width+".png"),fullPage:true});
    return {width,positiveExports:2,staleExports:0,productionPosts:0};
  }finally{await ctx.close();}
}
(async()=>{
  await mkdir(out,{recursive:true});
  const browser=await chromium.launch({headless:true});
  const results=[];
  try{
    for(const width of [390,1440])results.push(await runViewport(browser,width));
    await writeFile(path.join(out,"summary.json"),JSON.stringify({synthetic:true,results},null,2)+"\n");
    console.log("M134 signed Chromium stale locked-revision export barrier PASS",results);
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
