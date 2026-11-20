"use strict";
// Real built-Next browser proof with synthetic, never-live customer outcomes.
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
const {createHmac}=require("node:crypto");
const {createRequire}=require("node:module");

const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
if(!runtime)throw Error("LINEN_BROWSER_QA_RUNTIME must point to installed Playwright.");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
if(!secret||secret.length<32)throw Error("Synthetic operator test session secret is required.");
const base=process.env.LINEN_BROWSER_QA_URL || "http://127.0.0.1:3000";
const output=path.resolve("artifacts/preview-lifecycle/operator-quality-insights");
const synthetic=(id,order,fit,overall,shirtFit,trouserShape)=>({
  outcome_id:id,order_id:order,revision_id:"revision-"+order,
  overall_rating:overall,fit_result:fit,worn_confirmed:true,
  note:"PRIVATE CUSTOMER NOTE MUST NOT RENDER",created_at:"2026-11-20T09:00:00Z",
  learning_context:{
    version:"linen-earth-production-learning-context-v1",
    revisionId:"revision-"+order,recipeHash:"a".repeat(64),
    fabrics:{shirtId:"shirt-real-ID",trouserId:"pant-real-ID"},
    shirt:{fit:shirtFit},trouser:{shape:trouserShape},
    context:{occasion:"Semi-Formal"},
  },
});
const data={
  configured:true,
  outcomes:[
    synthetic("o1","order-1","clean_first_fit","love","Regular / Classic Fit","Straight Trouser"),
    synthetic("o2","order-2","major_alteration","needs_work","Slim Fit","Straight Trouser"),
  ],
  reviews:["o1","o2"].map((id,i)=>({
    review_id:"r"+i,outcome_id:id,reviewer:"Synthetic reviewer",decision:"approved",
    note:"",created_at:"2026-11-20T10:00:00Z",
  })),
  policies:[{policy_id:"p1",minimum_approved_cases:2,approved_by:"Synthetic policy owner",
    note:"Documented synthetic threshold",created_at:"2026-11-19T09:00:00Z"}],
};
async function main(){
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true});
  const pageErrors=[],apiRequests=[];
  try{
    // Unauthorized SSR page must redirect; mocked API must NOT bypass server auth.
    const anon=await browser.newContext();
    const unauthed=await anon.newPage();
    await unauthed.goto(base+"/operator/quality-insights",{waitUntil:"domcontentloaded"});
    assert.ok(new URL(unauthed.url()).pathname.startsWith("/operator/login"),
      "private quality insights cannot render without operator session");
    await anon.close();

    const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+120000})).toString("base64url");
    const sig=createHmac("sha256",secret).update(payload).digest("base64url");
    const result={authenticatedOnly:true,syntheticOnly:true,widths:[],pageErrors,apiRequests,automaticLearning:false};
    for(const width of [390,768,1440]){
      const context=await browser.newContext({viewport:{width,height:950},reducedMotion:"reduce"});
      await context.addCookies([{name:"linen_operator_session",value:payload+"."+sig,url:base}]);
      const page=await context.newPage();
      page.on("pageerror",e=>pageErrors.push(e.message));
      page.on("request",request=>{
        const url=new URL(request.url());
        if(url.pathname.startsWith("/api/"))apiRequests.push(url.pathname);
      });
      await page.route("**/api/operator/customer-outcomes",async route=>{
        await route.fulfill({status:200,contentType:"application/json",
          headers:{"cache-control":"private, no-store"},body:JSON.stringify(data)});
      });
      await page.goto(base+"/operator/quality-insights",{waitUntil:"domcontentloaded"});
      await page.getByRole("heading",{name:"Production Quality Insights"}).waitFor();
      await page.getByText("2 of 2 human-approved cases").waitFor();
      assert.equal(await page.getByRole("heading",{name:"Construction-level evidence"}).count(),1);
      assert.equal(await page.getByRole("table").locator("tbody tr").count(),2);
      await page.getByLabel("Compare by").selectOption("Trouser shape");
      assert.equal(await page.getByRole("table").locator("tbody tr").count(),1);
      await page.getByLabel("Compare by").selectOption("Occasion");
      assert.equal(await page.getByRole("table").locator("tbody tr").count(),1);
      assert.equal(await page.getByText("PRIVATE CUSTOMER NOTE MUST NOT RENDER").count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,
        "no document-wide viewport overflow");
      await page.screenshot({path:path.join(output,"quality-"+width+".png"),fullPage:true});
      result.widths.push(width);
      await context.close();
    }
    assert.deepEqual(pageErrors,[],"no browser runtime errors");
    assert.ok(apiRequests.length===3&&apiRequests.every(x=>x==="/api/operator/customer-outcomes"),
      "only existing private outcome API is used");
    fs.writeFileSync(path.join(output,"summary.json"),JSON.stringify(result,null,2));
    console.log("Quality Insights private synthetic browser verification passed:",JSON.stringify(result));
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
