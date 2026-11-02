"use strict";
// Customer-owned design share browser UX. Synthetic API responses only:
// no live accounts, provider credentials, databases or paid rendering.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module");
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
if(!runtime)throw Error("Set LINEN_BROWSER_QA_RUNTIME for pinned Chromium");
const {chromium}=Module.createRequire(path.join(runtime,"package.json"))("playwright");
const origin=process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000";
const output=path.resolve("artifacts/preview-lifecycle/customer-shares");
const tokenHash="a".repeat(64);
const customer={id:"123e4567-e89b-12d3-a456-426614174000",email:"alice@example.test"};
const errors=[],proof=[];
let browser;
async function run(){
  fs.mkdirSync(output,{recursive:true});
  browser=await chromium.launch({headless:true});
  try{
    for(const width of [390,768,1440]){
      const context=await browser.newContext({viewport:{width,height:950}});
      const page=await context.newPage();
      let revoked=false,failRevoke=true,failList=width===390,paidCalls=0,forgedOwnerField=0;
      const intercepted=[],failedResponses=[];
      let expectedResource503Errors=0;
      page.on("response",response=>{
        if(response.status()>=400)failedResponses.push({
          status:response.status(),pathname:new URL(response.url()).pathname,
        });
      });
      page.on("pageerror",error=>errors.push(width+": "+error.message));
      page.on("console",message=>{
        if(message.type()!=="error")return;
        // The deliberate 503 from the first revocation attempt is a
        // required negative test. Chromium logs it as a resource error.
        // Match its precise string, require exactly one correlated HTTP
        // failure, and still fail for every unrelated console error.
        if(message.text()==="Failed to load resource: the server responded with a status of 503 (Service Unavailable)"){
          expectedResource503Errors++;
        }else errors.push(width+": "+message.text());
      });
      page.on("dialog",dialog=>dialog.accept());
      await context.route("**/api/**",async route=>{
        const req=route.request(),name=new URL(req.url()).pathname;
        if(/render|look-inspect|creative-inspect/.test(name))paidCalls++;
        let body={};
        if(req.method()==="POST"){
          try{body=req.postDataJSON()||{};}catch{}
        }
        intercepted.push({name,action:body.action||null});
        if(name==="/api/customer-auth/session")
          return route.fulfill({status:200,json:{customer}});
        if(name==="/api/designer/share"){
          if(body.action==="listOwned"&&failList)
            return route.fulfill({status:503,json:{error:"Share list unavailable"}});
          if(body.action==="listOwned")return route.fulfill({status:200,json:{
            shares:[{tokenHash,expiresAt:"2027-01-01T00:00:00Z",
              revokedAt:revoked?"2026-11-03T00:00:00Z":null}]
          }});
          if(body.action==="revokeOwned"){
            if("ownerUserId" in body||"revokeKey" in body||"token" in body)forgedOwnerField++;
            assert.deepEqual(body,{action:"revokeOwned",tokenHash});
            if(failRevoke)return route.fulfill({status:503,json:{error:"Secure share management is temporarily unavailable."}});
            revoked=true;return route.fulfill({status:200,json:{revoked:true}});
          }
          return route.fulfill({status:400,json:{error:"Unexpected share action"}});
        }
        if(name==="/api/designer/vault")
          return route.fulfill({status:200,json:{designs:[]}});
        if(name==="/api/measurements/vault")
          return route.fulfill({status:200,json:{profiles:[]}});
        if(name==="/api/customer-account/production")
          return route.fulfill({status:200,json:{quotes:[],orders:[],orderEvents:[],outcomes:[]}});
        return route.fulfill({status:200,json:{}});
      });
      await page.goto(origin+"/account",{waitUntil:"networkidle"});
      await page.getByRole("heading",{name:/My public design shares/}).waitFor();
      if(failList){
        await page.getByRole("alert").getByText(/share management is unavailable/).waitFor();
        assert.equal(await page.getByText("No managed share links are linked to this account.").count(),0,
          "Backend failure must never be reported as empty account shares");
        failList=false;
        await page.getByRole("button",{name:"Retry share list"}).click();
      }
      const revoke=page.getByRole("button",{name:"Revoke this link"});
      await revoke.waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,
        width+"px account sharing has horizontal overflow");
      assert.equal(await page.getByText(/Design share a{12}/).count(),1);
      assert.equal((await page.content()).includes("alice@example.test"),true);
      assert.equal((await page.content()).includes("private cancellation code: "),false);
      await page.screenshot({path:path.join(output,"account-share-"+width+".png"),fullPage:true});
      await revoke.click();
      await page.getByText("Secure share management is temporarily unavailable.").waitFor();
      assert.equal(await revoke.count(),1,"503 must not falsely mark link revoked");
      failRevoke=false;
      await revoke.click();
      await page.getByText("Shared design link revoked, including on other devices.").waitFor();
      await page.getByText(/Revoked/,{exact:false}).first().waitFor();
      assert.equal(await revoke.count(),0,"successful revocation removes revoke action");
      assert.equal(forgedOwnerField,0,"UI must not forge or send customer owner identity");
      assert.equal(paidCalls,0,"account page must not use paid image services");
      assert.equal(intercepted.filter(x=>x.name==="/api/designer/share"&&x.action==="revokeOwned").length,2);
      const expectedFailures=width===390?2:1;
      assert.deepEqual(failedResponses,
        Array.from({length:expectedFailures},()=>({status:503,pathname:"/api/designer/share"})),
        "Only the explicitly expected list and revocation 503s may fail over HTTP");
      assert.ok(expectedResource503Errors<=expectedFailures,
        "Unexpected 503 resource console errors");
      proof.push({width,shareList503RetryPassed:width===390,
        revocation503Displayed:true,revokeSucceeded:true,
        expectedResource503Errors,paidCalls:0});
      await page.screenshot({path:path.join(output,"account-revoked-"+width+".png"),fullPage:true});
      await context.close();
    }
    // Account switching while an old owner's request is still in flight must
    // never repopulate the new account's share list (real browser race proof).
    {
      const context=await browser.newContext({viewport:{width:390,height:950}});
      const page=await context.newPage();
      let identity={...customer};
      let signalAliceRequest,releaseAliceRequest;
      const aliceRequested=new Promise(resolve=>{signalAliceRequest=resolve;});
      const aliceGate=new Promise(resolve=>{releaseAliceRequest=resolve;});
      const bob={id:"223e4567-e89b-12d3-a456-426614174000",email:"bob@example.test"};
      page.on("pageerror",error=>errors.push("account-switch: "+error.message));
      page.on("console",message=>{if(message.type()==="error")
        errors.push("account-switch: "+message.text());});
      await context.route("**/api/**",async route=>{
        const req=route.request(),name=new URL(req.url()).pathname;
        let body={};
        if(req.method()==="POST"){
          try{body=req.postDataJSON()||{};}catch{}
        }
        if(name==="/api/customer-auth/session")
          return route.fulfill({status:200,json:{customer:identity}});
        if(name==="/api/customer-auth/logout"){
          identity=null;return route.fulfill({status:200,json:{ok:true}});
        }
        if(name==="/api/customer-auth/otp")
          return route.fulfill({status:200,json:{ok:true}});
        if(name==="/api/customer-auth/verify"){
          identity=bob;return route.fulfill({status:200,json:{ok:true,customer:bob}});
        }
        if(name==="/api/designer/share"&&body.action==="listOwned"){
          if(identity?.id===customer.id){
            signalAliceRequest();
            await aliceGate;
            return route.fulfill({status:200,json:{shares:[{
              tokenHash,expiresAt:"2027-01-01T00:00:00Z",revokedAt:null,
            }]}});
          }
          return route.fulfill({status:200,json:{shares:[]}});
        }
        if(name==="/api/designer/vault")
          return route.fulfill({status:200,json:{designs:[]}});
        if(name==="/api/measurements/vault")
          return route.fulfill({status:200,json:{profiles:[]}});
        if(name==="/api/customer-account/production")
          return route.fulfill({status:200,json:{quotes:[],orders:[],orderEvents:[],outcomes:[]}});
        return route.fulfill({status:200,json:{}});
      });
      await page.goto(origin+"/account",{waitUntil:"domcontentloaded"});
      await aliceRequested;
      await page.getByText("alice@example.test").waitFor();
      // A failed/abandoned claim may still hold a bearer in a React input.
      // Sign-out must clear it before another account signs into this tab.
      const designRecovery=page.getByPlaceholder("Paste an older design recovery token to claim it");
      const measurementRecovery=page.getByPlaceholder("Paste an older measurement recovery token to claim it");
      await designRecovery.fill("synthetic-alice-design-secret");
      await measurementRecovery.fill("synthetic-alice-measurement-secret");
      await page.getByRole("button",{name:"Sign out"}).click();
      await page.getByRole("heading",{name:"Email sign in"}).waitFor();
      assert.equal(await page.getByPlaceholder("you@example.com").inputValue(),"",
        "successful logout must clear the previous sign-in email");
      await page.getByPlaceholder("you@example.com").fill("bob@example.test");
      await page.getByRole("button",{name:"Send secure code"}).click();
      await page.getByPlaceholder("Email code").fill("123456");
      await page.getByRole("button",{name:"Verify and sign in"}).click();
      await page.getByText("bob@example.test").waitFor();
      assert.equal(await designRecovery.inputValue(),"",
        "Alice's unfinished design recovery bearer must not persist into Bob's account");
      assert.equal(await measurementRecovery.inputValue(),"",
        "Alice's unfinished measurement recovery bearer must not persist into Bob's account");
      // Resolve stale Alice's pre-logout fetch *after* Bob has signed in.
      releaseAliceRequest();
      await page.waitForTimeout(200);
      assert.equal(await page.getByText(/Design share a{12}/).count(),0,
        "Alice's old share must not appear after switching to Bob");
      assert.equal(await page.getByText("alice@example.test").count(),0,
        "prior customer identity must not persist after Bob signs in");
      proof.push({width:390,accountSwitchStaleResponseDenied:true});
      await page.screenshot({path:path.join(output,"account-switch-race-390.png"),fullPage:true});
      await context.close();
    }
    // A lost/malformed session response must hide Alice's previously loaded
    // private data and recovery inputs, not leave them onscreen for Bob.
    {
      const context=await browser.newContext({viewport:{width:390,height:950}});
      const page=await context.newPage();
      let sessionOutage=false;
      const marker="PRIVATE-ALICE-REVISION-SYNTHETIC";
      let expected503=0;
      page.on("pageerror",error=>errors.push("session-outage: "+error.message));
      page.on("console",message=>{
        if(message.type()!=="error")return;
        if(message.text()==="Failed to load resource: the server responded with a status of 503 (Service Unavailable)")
          expected503++;
        else errors.push("session-outage: "+message.text());
      });
      await context.route("**/api/**",async route=>{
        const path=new URL(route.request().url()).pathname;
        if(path==="/api/customer-auth/session")
          return sessionOutage
            ?route.fulfill({status:503,json:{error:"Synthetic session backend unavailable"}})
            :route.fulfill({status:200,json:{customer}});
        if(path==="/api/designer/share")
          return route.fulfill({status:503,json:{error:"Synthetic shares unavailable"}});
        if(path==="/api/designer/vault")
          return route.fulfill({status:200,json:{designs:[{
            vaultId:"123e4567-e89b-12d3-a456-426614174000",
            revisionId:marker,recipeHash:"b".repeat(64),
            createdAt:"2026-11-03T00:00:00Z",expiresAt:"2027-01-01T00:00:00Z",
          }]}});
        if(path==="/api/measurements/vault")
          return route.fulfill({status:200,json:{profiles:[]}});
        if(path==="/api/customer-account/production")
          return route.fulfill({status:200,json:{
            quotes:[],orders:[],orderEvents:[],outcomes:[],
          }});
        return route.fulfill({status:200,json:{}});
      });
      await page.goto(origin+"/account",{waitUntil:"networkidle"});
      await page.getByText(marker).waitFor();
      await page.getByPlaceholder("Paste an older design recovery token to claim it")
        .fill("SYNTHETIC-ALICE-PRIVATE-RECOVERY-BEARER");
      sessionOutage=true;
      await page.getByRole("button",{name:"Retry share list"}).click();
      await page.getByRole("button",{name:"Retry account session"}).waitFor();
      assert.equal(await page.getByText(marker).count(),0,
        "session failure must hide the prior owner's saved design immediately");
      assert.equal(await page.getByText("alice@example.test").count(),0,
        "session failure must hide the previous customer's identity");
      sessionOutage=false;
      await page.getByRole("button",{name:"Retry account session"}).click();
      await page.getByText(marker).waitFor();
      assert.equal(await page.getByPlaceholder(
        "Paste an older design recovery token to claim it").inputValue(),"",
        "failed session rechecks must scrub unfinished bearer credentials");
      assert.ok(expected503<=3,"unexpected duplicate session/shares outage resource errors");
      proof.push({width:390,session503FailsClosed:true,privateRecoveryScrubbed:true});
      await page.screenshot({path:path.join(output,"account-session-outage-390.png"),fullPage:true});
      await context.close();
    }
    assert.deepEqual(errors,[],"No unexpected browser JS or console errors permitted");
    fs.writeFileSync(path.join(output,"summary.json"),JSON.stringify({browser:"Chromium",scope:"customer account shares",mockedBackends:true,physicalAcceptance:false,proof,errors},null,2));
    console.log("Customer share/account responsive Chromium PASS: 390, 768, 1440; 503 denial and cross-device revoke UX.");
  }finally{await browser?.close();}
}
run().catch(err=>{console.error(err);process.exitCode=1;});
