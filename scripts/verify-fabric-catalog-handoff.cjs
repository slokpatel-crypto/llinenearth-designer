"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const path=require("node:path");
const {createRequire}=require("node:module");
const {load}=require("./designer-test-loader.cjs");
const {DESIGNER_SHIRTS,DESIGNER_PANTS}=load("src/lib/designer/engine.ts");
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
if(!runtime)throw Error("Missing LINEN_BROWSER_QA_RUNTIME");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const origin=process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000";
const output=path.resolve("artifacts/preview-lifecycle/fabric-catalog");
const report={syntheticOnly:true,physicalFactsVerified:false,paidCalls:0,widths:[],pageErrors:[]};
async function check(browser,width){
  const context=await browser.newContext({viewport:{width,height:930},reducedMotion:"reduce"});
  const page=await context.newPage();
  page.on("pageerror",error=>report.pageErrors.push(error.message));
  await context.route("**/api/**",async route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(/(?:render|generate|fashn|inspect)/.test(pathname))throw Error("Paid rendering prohibited during catalogue QA: "+pathname);
    if(pathname==="/api/designer/catalog")
      return route.fulfill({status:200,json:{shirts:DESIGNER_SHIRTS,pants:DESIGNER_PANTS,calibrated:false,calibratedFabrics:0}});
    return route.fulfill({status:503,json:{error:"Synthetic QA endpoint not connected."}});
  });
  await page.goto(origin+"/catalog",{waitUntil:"domcontentloaded"});
  await page.getByRole("heading",{name:/Choose the cloth/}).waitFor();
  await page.getByText("Catalogue loaded · verify physical stock before ordering.").waitFor();
  const shirt=DESIGNER_SHIRTS[1],pant=DESIGNER_PANTS[1];
  const beforeCompare=await page.getByRole("link",{name:/Start designing with selected fabrics/}).getAttribute("href");
  const shirtCompare=page.getByRole("region",{name:"Shirt fabric comparison"});
  for(const candidate of DESIGNER_SHIRTS.slice(1,4)){
    await page.getByRole("button",{name:"Compare shirt fabric "+candidate.name}).first().click();
  }
  await shirtCompare.getByText("3/3",{exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"Compare shirt fabric "+DESIGNER_SHIRTS[4].name}).first().isDisabled(),true,"fourth shirt is blocked");
  assert.equal(await shirtCompare.getByRole("button",{name:"Use this shirt fabric"}).count(),3);
  assert.equal(await page.getByRole("link",{name:/Start designing with selected fabrics/}).getAttribute("href"),beforeCompare,"shortlisting must not silently replace chosen pair");
  await shirtCompare.getByRole("button",{name:"Use this shirt fabric"}).first().click();
  assert.equal(await page.getByRole("button",{name:"Choose shirt fabric "+shirt.name}).getAttribute("aria-pressed"),"true");

  const pantCompare=page.getByRole("region",{name:"Trouser fabric comparison"});
  for(const candidate of DESIGNER_PANTS.slice(1,3)){
    await page.getByRole("button",{name:"Compare pant fabric "+candidate.name}).first().click();
  }
  await pantCompare.getByText("2/3",{exact:true}).waitFor();
  await pantCompare.getByRole("button",{name:"Use this trouser fabric"}).first().click();
  assert.equal(await page.getByRole("button",{name:"Choose pant fabric "+pant.name}).getAttribute("aria-pressed"),"true");
  assert.match(await shirtCompare.innerText(),/Confirm stock|Stock checked/,"compare must disclose stock evidence");
  assert.match(await pantCompare.innerText(),/Colour is a screen estimate|Colour checked/,"compare must disclose colour evidence");
  const link=page.getByRole("link",{name:/Start designing with selected fabrics/});
  const href=await link.getAttribute("href");
  assert.ok(href);
  const params=new URL(href,origin).searchParams;
  assert.equal(params.get("shirt"),shirt.id);
  assert.equal(params.get("pant"),pant.id);
  assert.equal(params.get("from"),"fabric-catalog");
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,"catalogue overflows "+width);
  await fs.mkdir(output,{recursive:true});
  await page.screenshot({path:path.join(output,"catalog-"+width+".png"),fullPage:true});
  // An unrelated old private draft must not replace the explicit catalogue pair.
  await page.evaluate(()=>{
    localStorage.setItem("linen-earth:real-designer-draft:v2",JSON.stringify({shirtId:"old-shirt-id",pantId:"old-pant-id",occasion:"Formal",climate:"Cool",intention:"Expressive"}));
  });
  await link.click();
  await page.waitForURL(u=>u.pathname==="/designer-studio");
  await page.getByText("Your exact catalogue shirt and trouser fabric IDs are loaded.",{exact:false}).waitFor({timeout:30000});
  await page.waitForFunction(({shirtId,pantId})=>{
    const a=document.querySelector("#designer-shirt"),b=document.querySelector("#designer-pant");
    return a?.value===shirtId&&b?.value===pantId;
  },{shirtId:shirt.id,pantId:pant.id});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,"Designer overflows "+width);
  await page.screenshot({path:path.join(output,"designer-"+width+".png"),fullPage:true});
  report.widths.push({width,shirtId:shirt.id,pantId:pant.id,comparedShirts:3,comparedPants:2,shortlistDidNotMutatePair:true,handoffApplied:true,noOverflow:true});
  await context.close();
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of [390,768,1440])await check(browser,width);
    assert.deepEqual(report.pageErrors,[]);
    await fs.writeFile(path.join(output,"summary.json"),JSON.stringify(report,null,2));
    console.log("Synthetic fabric catalogue → exact Designer fabric pair passed at 390/768/1440px.");
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
