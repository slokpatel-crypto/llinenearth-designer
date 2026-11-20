// Synthetic-only account -> owned vault -> Designer resume -> share/enquiry.
// Real built Next.js + Chromium at 390/768/1440; no customer/cloud writes.
const assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path");
const {createRequire}=require("node:module");
const {load}=require("./designer-test-loader.cjs");
const {chromium}=createRequire(path.join(process.env.LINEN_BROWSER_QA_RUNTIME||"/missing","package.json"))("playwright");
const engine=load("src/lib/designer/engine.ts");
const {fromLegacyStyle}=load("src/lib/designer/style-spec-v2.ts");
const {lockGarmentSpec}=load("src/lib/designer/design-lock.ts");
const {summaryForOwnedLockedDesign}=load("src/lib/designer/owned-design-summary.ts");
const {toLegacyStyle}=load("src/lib/designer/style-spec-v2.ts");
const {assessFitConstruction}=load("src/lib/designer/fit-construction.ts");
const {assessBlockStrategy}=load("src/lib/designer/block-strategy.ts");
const {evaluateLinenEarthBrandLanguage}=load("src/lib/designer/brand-language.ts");
const {buildDesignerNegotiation}=load("src/lib/designer/constraint-negotiation.ts");
const {buildCanonicalGarmentSpec}=load("src/lib/designer/garment-spec.ts");
const base=process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000";
const output=path.resolve("artifacts/preview-lifecycle/customer-journey");
const vaultId="b287e470-0e90-4fd4-b5fb-976eecebd244";
const followupVaultId="d474f5a0-3ac5-4f76-b187-a1547df04c61";
const draftKey="linen-earth:real-designer-draft:v2";
const summary={evidence:"synthetic HTTP fixtures; no real customer, stock or production data",viewports:[],errors:[],paid:[],actions:[]};

async function syntheticRevision(){
  const style=engine.designerStyleForOccasion("Semi-Formal");
  const styleSpec=fromLegacyStyle(style);
  styleSpec.shirt.type="overshirt";
  const spec={
    version:"linen-earth-garment-spec-v1",
    status:"review_required",
    source:{designerRuleSetVersion:"SYNTHETIC",styleSchemaVersion:2},
    styleSpec,bodyProfile:null,
    context:{occasion:"Semi-Formal",climate:"Not specified",intention:"Balanced"},
    fabrics:{
      shirt:{id:engine.DESIGNER_SHIRTS[0].id,name:"Synthetic shirt",line:"CI fixture",source:"synthetic",verifiedMaterialFacts:0},
      trouser:{id:engine.DESIGNER_PANTS[0].id,name:"Synthetic trouser",line:"CI fixture",source:"synthetic",verifiedMaterialFacts:0},
    },
    shirt:{fit:style.shirtFit,wear:style.shirtWear,collar:style.collar,collarFinish:style.collarFinish,
      cuff:style.cuff,placket:style.placket,button:style.button,finishedTargets:[]},
    trouser:{shape:style.trouser,rise:style.rise,waistband:style.waistband,break:style.break,finishedTargets:[]},
    creative:null,decision:{designFitScore:0,confidenceScore:0},blockStrategy:null,constructionChecks:[],
    unresolved:["Synthetic fixture"],readiness:{},caveats:[],
  };
  return lockGarmentSpec(spec,{lockedAt:"2026-11-20T15:00:00.000Z",parentRevisionId:"LE-LOCK-SYNTHETIC-GRANDPARENT"});
}

function assessmentFixture(body){
  assert.equal(body.styleSpec.shirt.type,"overshirt","saved advanced v2 cut must survive reassessment");
  const shirt=engine.DESIGNER_SHIRTS.find(f=>f.id===body.shirtId);
  const pant=engine.DESIGNER_PANTS.find(f=>f.id===body.pantId);
  assert.ok(shirt&&pant);
  const style=toLegacyStyle(body.styleSpec);
  const recommendation=engine.evaluateDesignerCombo(shirt,pant,body.occasion,style,undefined,body.context);
  const fitConstruction=assessFitConstruction(body.measurements,style,{climate:body.context.climate,shirtFabric:shirt,trouserFabric:pant,observations:body.observations});
  const blockStrategy=assessBlockStrategy(body.measurements,style,body.observations);
  const brandLanguage=evaluateLinenEarthBrandLanguage(shirt,pant,style,body.occasion,body.context);
  return {assessment:{
    recommendation,fitConstruction,blockStrategy,brandLanguage,
    negotiation:buildDesignerNegotiation(recommendation,fitConstruction),
    garmentSpec:buildCanonicalGarmentSpec(recommendation,fitConstruction,body.measurements,brandLanguage,blockStrategy,null,null,body.styleSpec,body.bodyProfile),
  }};
}

async function syntheticFollowup(revision){
  const spec=structuredClone(revision.garmentSpec);
  spec.fabrics.shirt.id=engine.DESIGNER_SHIRTS[1].id;
  spec.fabrics.shirt.name="Alternative synthetic shirt";
  spec.styleSpec.shirt.type="dress_shirt";
  return lockGarmentSpec(spec,{
    lockedAt:"2026-11-20T15:01:00.000Z",
    parentRevisionId:revision.revisionId,
  });
}

function savedVaultRow(vaultId,revision){
  return {
    vaultId,revisionId:revision.revisionId,recipeHash:revision.recipeHash,
    parentRevisionId:revision.parentRevisionId,
    summary:summaryForOwnedLockedDesign(revision),
    createdAt:revision.lockedAt,expiresAt:"2027-05-19T15:00:00.000Z",
  };
}

async function visit(browser,width,revision,followup){
  const context=await browser.newContext({viewport:{width,height:980},reducedMotion:"reduce",acceptDownloads:true});
  const page=await context.newPage();
  page.on("pageerror",error=>summary.errors.push(error.message));
  const requests=[];
  let unauthorized=false;
  await context.route("**/api/**",route=>{
    const url=new URL(route.request().url()),pathname=url.pathname;
    const input=JSON.parse(route.request().postData()||"{}");
    requests.push({pathname,action:input.action||null});
    if(/look-render|creative-render|fashn|visualization/.test(pathname))summary.paid.push(pathname);
    if(pathname==="/api/customer-auth/session")return route.fulfill({status:200,json:{customer:{id:"synthetic-owner",email:"owner@example.invalid"}}});
    if(pathname==="/api/designer/vault"){
      if(input.action==="listOwned")return route.fulfill({status:200,json:{designs:[
        savedVaultRow(vaultId,revision),savedVaultRow(followupVaultId,followup),
      ]}});
      if(input.action==="loadOwned")return route.fulfill({
        status:unauthorized?401:200,json:unauthorized?{error:"Unauthorized"}:{
          revision:input.vaultId===followupVaultId?followup:revision,
        },
      });
      throw Error("Unexpected vault action: "+input.action);
    }
    if(pathname==="/api/designer/assess"){
      summary.actions.push("assess");
      return route.fulfill({status:200,json:assessmentFixture(input)});
    }
    if(pathname==="/api/designer/share"){
      assert.equal(input.recipeHash,revision.recipeHash);
      summary.actions.push("share");
      return route.fulfill({status:200,json:{token:"synthetic-signed-token",expiresInDays:30,audited:false}});
    }
    if(pathname==="/api/designer/enquiry"){
      assert.equal(input.recipeHash,revision.recipeHash);
      summary.actions.push("enquiry");
      return route.fulfill({status:200,json:{href:"https://wa.me/15550000000?text=SYNTHETIC",audited:false}});
    }
    if(pathname==="/api/designer/catalog")return route.fulfill({status:200,json:{
      shirts:engine.DESIGNER_SHIRTS,pants:engine.DESIGNER_PANTS,
    }});
    return route.fulfill({status:200,json:{}});
  });
  await page.goto(base+"/account",{waitUntil:"domcontentloaded"});
  const item=page.getByText(revision.revisionId,{exact:true});
  await item.waitFor({state:"visible"});
  await page.getByText("Shirt: Synthetic shirt · Trouser: Synthetic trouser",{exact:true}).waitFor({state:"visible"});
  await page.getByText(/Saved occasion: Semi-Formal · Fabric labels from the locked recipe/).waitFor({state:"visible"});
  await page.getByText("Continues recorded revision "+revision.parentRevisionId,{exact:true}).waitFor({state:"visible"});
  await page.getByRole("checkbox",{name:"Select saved revision "+revision.revisionId+" for comparison"}).check();
  await page.getByRole("checkbox",{name:"Select saved revision "+followup.revisionId+" for comparison"}).check();
  await page.getByRole("button",{name:"Compare selected saved designs"}).click();
  await page.getByRole("heading",{name:"Saved design comparison"}).waitFor({state:"visible"});
  await page.getByText("The second revision directly continues the first.").waitFor({state:"visible"});
  await page.getByText("Shirt fabric",{exact:true}).waitFor({state:"visible"});
  await page.getByText("Shirt type",{exact:true}).waitFor({state:"visible"});
  await page.getByText("Alternative synthetic shirt",{exact:false}).first().waitFor({state:"visible"});
  await page.getByRole("button",{name:"Copy secure share link"}).first().click();
  await page.getByText(/Signed design-only link/).waitFor({state:"visible"});
  await page.getByRole("button",{name:"Prepare WhatsApp enquiry"}).first().click();
  const send=page.getByRole("link",{name:/Open WhatsApp to review and send/});
  await send.waitFor({state:"visible"});
  assert.ok((await send.getAttribute("href")).startsWith("https://wa.me/"));
  const edit=page.getByRole("link",{name:"Continue in Designer"}).first();
  const href=await edit.getAttribute("href");
  assert.equal(new URL(href,base).searchParams.get("resumeVault"),vaultId);
  assert.ok(!href.includes("lev1.")&&!href.includes(revision.recipeHash),"URL holds opaque vault ID only");
  await edit.click();
  await page.waitForURL(url=>url.pathname==="/designer-studio");
  await page.getByText(/ACCOUNT DESIGN \/ EDITABLE CHILD/).waitFor({state:"visible",timeout:30000});
  await page.waitForFunction(({shirtId,pantId,parent,draftKey})=>{
    const draft=JSON.parse(localStorage.getItem(draftKey)||"null");
    return draft?.shirtId===shirtId&&draft?.pantId===pantId&&
      draft.styleSpec?.shirt?.type==="overshirt"&&
      document.body.textContent.includes(parent);
  },{shirtId:revision.garmentSpec.fabrics.shirt.id,pantId:revision.garmentSpec.fabrics.trouser.id,parent:revision.revisionId,draftKey});
  assert.equal(await page.getByRole("combobox",{name:"Shirt type",exact:true}).inputValue(),"overshirt");
  await page.getByRole("button",{name:"Reassess this saved look"}).click();
  // The recipe actions are inside a collapsed <details>; first wait for
  // the assessed result, then open the drawer before finding its buttons.
  const drawer=page.locator(".newDesignerTechnicalDrawer.newDesignerAdvancedResult");
  await drawer.waitFor({state:"attached",timeout:30000});
  await drawer.locator("summary").click();
  await page.getByRole("button",{name:/Lock recipe revision/}).waitFor({state:"visible"});
  // The original remains immutable; the exported child must reference it
  // and retain the exact StyleSpec v2 construction and fabric IDs.
  const downloaded=page.waitForEvent("download");
  await page.getByRole("button",{name:/Lock recipe revision/}).click();
  const file=await downloaded;
  const child=JSON.parse(await fs.readFile(await file.path(),"utf8"));
  assert.equal(child.parentRevisionId,revision.revisionId);
  assert.equal(child.garmentSpec.styleSpec.shirt.type,"overshirt");
  assert.equal(child.garmentSpec.fabrics.shirt.id,revision.garmentSpec.fabrics.shirt.id);
  assert.equal(child.garmentSpec.fabrics.trouser.id,revision.garmentSpec.fabrics.trouser.id);
  assert.notEqual(child.revisionId,revision.revisionId);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,"no horizontal overflow");
  assert.ok(requests.some(x=>x.pathname==="/api/designer/vault"&&x.action==="loadOwned"));
  assert.ok(requests.some(x=>x.pathname==="/api/designer/assess"),"reassessment must use the existing deterministic engine");
  await page.screenshot({path:path.join(output,"owned-design-"+width+".png"),fullPage:true});
  summary.viewports.push({width,ownerVaultLoad:true,savedV2Style:true,savedPairSummary:true,privateVersionComparison:true,actualNewLockParentVerified:true,shareAndEnquiryPrepared:true,noOverflow:true});
  await context.close();
}

async function negativeComparison(browser,revision,followup){
  const context=await browser.newContext({viewport:{width:390,height:980}});
  const page=await context.newPage();
  let denied=0;
  await context.route("**/api/**",route=>{
    const pathname=new URL(route.request().url()).pathname;
    const input=JSON.parse(route.request().postData()||"{}");
    if(pathname==="/api/customer-auth/session")return route.fulfill({status:200,json:{customer:{id:"synthetic-owner",email:"owner@example.invalid"}}});
    if(pathname==="/api/designer/vault"){
      if(input.action==="listOwned")return route.fulfill({status:200,json:{designs:[
        savedVaultRow(vaultId,revision),savedVaultRow(followupVaultId,followup),
      ]}});
      if(input.action==="loadOwned"){
        if(input.vaultId===followupVaultId){denied++;return route.fulfill({status:403,json:{error:"Revision not accessible"}});}
        return route.fulfill({status:200,json:{revision}});
      }
    }
    return route.fulfill({status:200,json:{}});
  });
  await page.goto(base+"/account",{waitUntil:"domcontentloaded"});
  await page.getByRole("checkbox",{name:"Select saved revision "+revision.revisionId+" for comparison"}).check();
  await page.getByRole("checkbox",{name:"Select saved revision "+followup.revisionId+" for comparison"}).check();
  await page.getByRole("button",{name:"Compare selected saved designs"}).click();
  await page.getByText("Revision not accessible").waitFor({state:"visible"});
  assert.ok(denied>0,"one comparison revision is forbidden by owner scope");
  assert.equal(await page.getByRole("heading",{name:"Saved design comparison"}).count(),0,"no partial private compare display");
  await context.close();
}

async function negative(browser,revision){
  const context=await browser.newContext({viewport:{width:768,height:980}});
  const page=await context.newPage();
  await context.route("**/api/**",route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(pathname==="/api/designer/vault")return route.fulfill({status:401,json:{error:"Sign-in required"}});
    if(pathname==="/api/designer/catalog")return route.fulfill({status:200,json:{shirts:engine.DESIGNER_SHIRTS,pants:engine.DESIGNER_PANTS}});
    return route.fulfill({status:200,json:{}});
  });
  await page.addInitScript(({draftKey,shirtId,pantId})=>localStorage.setItem(draftKey,JSON.stringify({
    shirtId,pantId,
  })),{draftKey,shirtId:engine.DESIGNER_REVIEWED_PAIRING.shirtId,pantId:engine.DESIGNER_REVIEWED_PAIRING.pantId});
  await page.goto(base+"/designer-studio?resumeVault="+vaultId,{waitUntil:"domcontentloaded"});
  await page.getByText(/ACCOUNT DESIGN \/ NOT APPLIED/).waitFor({state:"visible",timeout:30000});
  assert.equal(await page.locator("#designer-shirt").inputValue(),engine.DESIGNER_REVIEWED_PAIRING.shirtId);
  await context.close();
}

(async()=>{
  await fs.mkdir(output,{recursive:true});
  const revision=await syntheticRevision();
  const followup=await syntheticFollowup(revision);
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of [390,768,1440])await visit(browser,width,revision,followup);
    await negativeComparison(browser,revision,followup);
    await negative(browser,revision);
    assert.deepEqual(summary.errors,[],"no browser exceptions");
    assert.deepEqual(summary.paid,[],"never call paid render APIs");
    assert.equal(summary.actions.filter(a=>a==="share").length,3);
    assert.equal(summary.actions.filter(a=>a==="enquiry").length,3);
    assert.equal(summary.actions.filter(a=>a==="assess").length,3);
    await fs.writeFile(path.join(output,"evidence.json"),JSON.stringify(summary,null,2));
    console.log("Synthetic customer-journey browser checks passed",JSON.stringify(summary));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
