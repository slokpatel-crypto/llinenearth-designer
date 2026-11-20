"use strict";
// Built-Next, real-Chromium synthetic customer journey. No customer/stock
// backend traffic and no production mutations or paid AI calls.
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const path=require("node:path");
const crypto=require("node:crypto");
const {createRequire}=require("node:module");
const {load}=require("./designer-test-loader.cjs");
const engine=load("src/lib/designer/engine.ts");
const {fromLegacyStyle}=load("src/lib/designer/style-spec-v2.ts");
const {DEFAULT_CRAFT_PREFERENCES}=load("src/lib/designer/creative-spec.ts");
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
if(!runtime)throw Error("Set LINEN_BROWSER_QA_RUNTIME");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const origin=process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000";
const output=path.resolve("artifacts/preview-lifecycle/customer-vault");
const vaultId="550e8400-e29b-41d4-a716-446655440000";
const shirt=engine.DESIGNER_SHIRTS[0],pant=engine.DESIGNER_PANTS[0];
const style=engine.designerStyleForOccasion("Semi-Formal");
const spec={
  version:"linen-earth-garment-spec-v1",status:"draft",
  source:{styleSchemaVersion:2,designerRuleSetVersion:"synthetic",fitConstructionVersion:null},
  styleSpec:fromLegacyStyle(style),bodyProfile:null,
  context:{occasion:"Semi-Formal",climate:"Hot / humid",intention:"Balanced"},
  fabrics:{shirt:{id:shirt.id,name:shirt.name,line:shirt.line,source:shirt.source,verifiedMaterialFacts:0},
    trouser:{id:pant.id,name:pant.name,line:pant.line,source:pant.source,verifiedMaterialFacts:0}},
  shirt:{fit:style.shirtFit,wear:style.shirtWear,collar:style.collar,collarFinish:style.collarFinish,cuff:style.cuff,placket:style.placket,button:style.button,finishedTargets:[]},
  trouser:{shape:style.trouser,rise:style.rise,waistband:style.waistband,break:style.break,finishedTargets:[]},
  creative:null,unresolved:[],constructionChecks:[],caveats:[],
};
function canonical(value){
  return Array.isArray(value)?value.map(canonical):value&&typeof value==="object"
    ?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;
}
const hash=crypto.createHash("sha256").update(JSON.stringify(canonical(spec))).digest("hex");
const revision={version:"linen-earth-design-lock-v1",revisionId:"LE-LOCK-20261120100000-"+hash.slice(0,12).toUpperCase(),
  parentRevisionId:null,recipeHash:hash,lockedAt:"2026-11-20T10:00:00.000Z",garmentSpec:spec};
const metadata={vaultId,revisionId:revision.revisionId,recipeHash:hash,createdAt:"2026-11-20T10:00:00Z",expiresAt:"2027-02-20T10:00:00Z"};
const summary={fixture:"synthetic-only",realCustomerEvidence:false,physicalEvidence:false,widths:[],errors:[],requests:[]};

async function verify(browser,width){
  const context=await browser.newContext({viewport:{width,height:970},reducedMotion:"reduce"});
  const page=await context.newPage();
  page.on("pageerror",e=>summary.errors.push(e.message));
  // Mock every customer/data request in the browser. No production RPC is called.
  await context.route("**/api/**",async route=>{
    const url=new URL(route.request().url());
    const path=url.pathname;
    summary.requests.push(path);
    const body=route.request().method()==="POST"?JSON.parse(route.request().postData()||"{}"):{};
    let data={};
    let status=200;
    if(path==="/api/customer-auth/session")data={customer:{id:"synthetic-browser-only",email:"synthetic@example.invalid"}};
    else if(path==="/api/designer/vault"){
      if(body.action==="listOwned")data={designs:[metadata],customer:{email:"synthetic@example.invalid"}};
      else if(body.action==="loadOwned") {
        assert.equal(body.vaultId,vaultId,"only owner-scoped UUID is transmitted");
        data={revision,expiresAt:metadata.expiresAt};
      } else throw Error("Unexpected vault write: "+body.action);
    }
    else if(path==="/api/measurements/vault")data={profiles:[]};
    else if(path==="/api/customer-account/production")data={quotes:[],orders:[],orderEvents:[],outcomes:[]};
    else if(path==="/api/designer/share") {assert.equal(body.recipeHash,hash);data={token:"synthetic-only",expiresInDays:30,audited:false};}
    else if(path==="/api/designer/enquiry"){assert.equal(body.recipeHash,hash);data={href:"https://wa.me/919999999999?text=synthetic",audited:false};}
    else if(path==="/api/designer/catalog")data={shirts:engine.DESIGNER_SHIRTS,pants:engine.DESIGNER_PANTS};
    else if(path==="/api/designer/assess")data={error:"Synthetic: manually reassess before lock"} ,status=503;
    // Creative profile is a *read-only preference lookup*, not a paid render.
    // Explicitly mock its GET and reject writes to avoid synthetic customer records.
    else if(path==="/api/designer/creative-profile"){
      assert.equal(route.request().method(),"GET","synthetic journey must not write creative preferences");
      data={authenticated:false,owner:null,configured:false,preferences:DEFAULT_CRAFT_PREFERENCES,reviewCount:0};
    }
    // Fail closed for actual costly image operations. Do not suppress them.
    else if(/^\/api\/designer\/(?:creative-(?:generate|inspect|render|repair)|look-(?:render|inspect)|fashn(?:-[^/]+)?)(?:\/|$)/.test(path))
      throw Error("Paid render must not run: "+path);
    await route.fulfill({status,contentType:"application/json",body:JSON.stringify(data)});
  });
  await page.goto(origin+"/account",{waitUntil:"domcontentloaded"});
  await page.getByRole("heading",{name:/My private design account/}).waitFor();
  const view=page.getByRole("button",{name:"View & share"});
  await view.waitFor();
  await view.click();
  await page.getByRole("region",{name:"Saved design details"}).waitFor();
  await page.getByText("Integrity-verified locked revision").waitFor();
  await page.getByRole("button",{name:"Create 30-day share link"}).click();
  await page.getByRole("link",{name:"Open shared recipe"}).waitFor();
  await page.getByRole("button",{name:"Prepare WhatsApp enquiry"}).click();
  const wa=page.getByRole("link",{name:"Open prepared WhatsApp message"});
  await wa.waitFor();
  assert.match(await wa.getAttribute("href"),/^https:\/\/wa\.me\//);
  const resume=page.getByRole("link",{name:"Edit as next revision"});
  const href=await resume.getAttribute("href");
  const url=new URL(href,origin);
  assert.equal(url.searchParams.get("resumeVault"),vaultId);
  assert.equal([...url.searchParams.keys()].length,1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await fs.mkdir(output,{recursive:true});
  await page.screenshot({path:path.join(output,"account-"+width+".png"),fullPage:true});
  await resume.click();
  await page.waitForURL(url=>url.pathname==="/designer-studio");
  await page.getByText("An editable descendant draft is ready.",{exact:false}).waitFor({timeout:30000});
  await page.waitForFunction(({shirtId,pantId})=>{
    const raw=localStorage.getItem("linen-earth:real-designer-draft:v2");
    if(!raw)return false;
    const draft=JSON.parse(raw);
    return draft.shirtId===shirtId&&draft.pantId===pantId&&draft.styleSpec?.styleSchemaVersion===2;
  },{shirtId:shirt.id,pantId:pant.id});
  assert.equal(await page.getByRole("combobox",{name:"Shirt type",exact:true}).inputValue(),spec.styleSpec.shirt.type);
  assert.equal(await page.getByRole("combobox",{name:"Trouser type",exact:true}).inputValue(),spec.styleSpec.pant.type);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await page.screenshot({path:path.join(output,"designer-"+width+".png"),fullPage:true});
  summary.widths.push({width,vaultRecipeHash:hash.slice(0,12),noOverflow:true,reopenedAsNewDraft:true,shareAndEnquiryMocked:true});
  await context.close();
}
async function unauthorized(browser){
  const context=await browser.newContext({viewport:{width:390,height:800}});
  const page=await context.newPage();
  page.on("pageerror",e=>summary.errors.push(e.message));
  await context.route("**/api/**",async route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(pathname==="/api/designer/vault")return route.fulfill({status:401,json:{error:"Customer sign-in is required."}});
    return route.fulfill({status:200,json:pathname==="/api/designer/catalog"?{shirts:engine.DESIGNER_SHIRTS,pants:engine.DESIGNER_PANTS}:{}});
  });
  await page.goto(origin+"/designer-studio?resumeVault="+vaultId,{waitUntil:"domcontentloaded"});
  await page.getByText("Customer sign-in is required.").waitFor();
  assert.equal(await page.getByText(revision.revisionId).count(),0);
  await context.close();
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of [390,768,1440])await verify(browser,width);
    await unauthorized(browser);
    assert.deepEqual(summary.errors,[],"new UI must have no JS runtime errors");
    await fs.writeFile(path.join(output,"summary.json"),JSON.stringify(summary,null,2));
    console.log("Verified synthetic account→vault→share/enquiry→Designer at three widths; unauthorized vault denied.");
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
