"use strict";
// Real Chromium operator stock replay QA. All /api/operator/stock calls are
// intercepted: no Supabase connection, real physical stock or supplier writes.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {createRequire}=require("node:module");
const path=require("node:path");
const runtime=process.env.LINEN_BROWSER_QA_RUNTIME;
if(!runtime)throw Error("Pinned Playwright runtime is required.");
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
if(!secret||secret.length<32)throw Error("Synthetic operator session secret is required.");
const {chromium}=createRequire(path.join(runtime,"package.json"))("playwright");
const baseURL=process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000";
const fabric="linen-plain-60-sky-blue";
const uuid="b287e470-0e90-4fd4-b5fb-976eecebd244";
const stock=[{fabric_id:fabric,physical_metres:10,reserved_metres:0,
  available_metres:10,manual_event_count:1,provenance_event_count:1,
  legacy_unverified_event_count:0,provenance_ready:true,
  last_event_at:"2026-11-01T18:00:00Z"}];
function signedCookie(){
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+180000})).toString("base64url");
  const signature=createHmac("sha256",secret).update(payload).digest("base64url");
  return payload+"."+signature;
}
async function fill(page,source="SYNTH-ROLL-001"){
  await page.getByLabel("Fabric ID",{exact:true}).first().fill(fabric);
  await page.getByLabel("Metres",{exact:true}).fill("2.125");
  await page.getByLabel("Recorded by / checker").fill("Synthetic checker");
  await page.getByLabel("Physical source reference").fill(source);
}
async function ready(page){
  await page.getByRole("heading",{name:"Fabric Stock Ledger"}).waitFor();
  await page.getByRole("button",{name:"Record stock event"}).waitFor({state:"visible"});
  await page.getByRole("button",{name:"Record stock event"}).evaluate(
    async button=>{
      const started=Date.now();
      while(button.disabled&&Date.now()-started<15000)await new Promise(r=>setTimeout(r,50));
    });
}
async function submit(page,records){
  const before=records.length;
  // Wait for this click's own network response, not a stale success label
  // left in the DOM from a previous acknowledged manual receipt.
  const [response]=await Promise.all([
    page.waitForResponse(r=>r.url().includes("/api/operator/stock")&&
      r.request().method()==="POST",{timeout:15000}),
    page.getByRole("button",{name:"Record stock event"}).click(),
  ]);
  assert.equal(response.status(),200);
  await page.getByText("Provenance-backed stock event recorded.",{exact:true}).waitFor();
  assert.equal(records.length,before+1,"exactly one record POST should be issued");
  return records.at(-1);
}
async function startContext(browser,opts={}){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addCookies([{name:"linen_operator_session",value:signedCookie(),url:baseURL,httpOnly:true,sameSite:"Lax"}]);
  if(opts.blockStorage){
    await context.addInitScript(()=>{
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){
        if(String(k).startsWith("linen-earth:manual-stock-attempts:"))
          throw new Error("Simulated blocked storage");
        return original.call(this,k,v);
      };
    });
  }
  const records=[];
  let gets=0;
  await context.route("**/api/operator/stock",route=>{
    const request=route.request();
    if(request.method()==="GET"){
      gets++;
      return route.fulfill({status:200,json:{configured:true,stock},
        headers:{"cache-control":"private, no-store"}});
    }
    assert.equal(request.method(),"POST");
    const body=request.postDataJSON();
    records.push(body);
    assert.equal(body.action,"record","fixture must not exercise reservations");
    assert.match(body.requestKey,/^[0-9a-f-]{36}$/i);
    if(opts.loseFirstAck&&records.length===1){
      // Post has already been sent, but no trusted acknowledgment reached
      // the operator. The browser must lock every subsequent stock mutation.
      return route.fulfill({status:503,json:{error:"Stock operation could not be verified."},
        headers:{"cache-control":"private, no-store"}});
    }
    return route.fulfill({status:200,json:{eventId:uuid},
      headers:{"cache-control":"private, no-store"}});
  });
  const page=await context.newPage();
  await page.goto(baseURL+"/operator/stock",{waitUntil:"domcontentloaded"});
  await ready(page);
  return {context,page,records,getReads:()=>gets};
}
async function main(){
  const browser=await chromium.launch({headless:true});
  try{
    const {context,page,records,getReads}=await startContext(browser);
    try{
      await fill(page);
      const first=await submit(page,records);
      const second=await submit(page,records);
      assert.equal(second.requestKey,first.requestKey,"same physical evidence after ACK must reuse key");
      await page.reload({waitUntil:"domcontentloaded"});await ready(page);
      await fill(page);
      const reloaded=await submit(page,records);
      assert.equal(reloaded.requestKey,first.requestKey,"same-tab reload must preserve the manual receipt key");
      await page.getByLabel("Physical source reference").fill("SYNTH-ROLL-002");
      const changed=await submit(page,records);
      assert.notEqual(changed.requestKey,first.requestKey,"changed roll needs a different key");
      assert.ok(getReads()>=4,"fresh snapshot must be fetched after each ACK and reload");
      console.log("Stock operator Chromium PASS: same evidence, confirmed ACK, reload, distinct roll.");
    }finally{await context.close();}
    const uncertain=await startContext(browser,{loseFirstAck:true});
    try{
      await fill(uncertain.page,"SYNTH-LOST-ACK-001");
      const [ambiguous]=await Promise.all([
        uncertain.page.waitForResponse(r=>r.url().includes("/api/operator/stock")&&
          r.request().method()==="POST"),
        uncertain.page.getByRole("button",{name:"Record stock event"}).click(),
      ]);
      assert.equal(ambiguous.status(),503,"fixture must lose the first POST acknowledgment");
      await uncertain.page.getByText(/Stock write outcome is uncertain\. It may have committed/).waitFor();
      assert.equal(uncertain.records.length,1,"uncertain receipt should be sent exactly once");
      const originalKey=uncertain.records[0].requestKey;
      const stockButton=uncertain.page.getByRole("button",{name:"Record stock event"});
      assert.equal(await stockButton.isDisabled(),true,
        "an uncertain stock outcome must lock every follow-up physical receipt");
      assert.equal(await uncertain.page.getByRole("button",{name:"Create reservation"}).isDisabled(),true,
        "an uncertain manual receipt must also block creating another reservation");
      assert.equal(await uncertain.page.getByRole("button",{name:"Consume"}).isDisabled(),true,
        "an uncertain manual receipt must block consumption");
      assert.equal(await uncertain.page.getByRole("button",{name:"Release"}).isDisabled(),true,
        "an uncertain manual receipt must block release");
      // The real operator must separately confirm the ledger and the physical
      // source before clicking this reconciliation control. CI only tests UI.
      await uncertain.page.getByRole("button",{
        name:"I checked the ledger and source; refresh to unlock",
      }).click();
      await uncertain.page.getByText(/Ledger reloaded after operator reconciliation/).waitFor();
      const confirmed=await submit(uncertain.page,uncertain.records);
      assert.equal(confirmed.requestKey,originalKey,
        "a retry after manual reconciliation must keep the original receipt ID");
      assert.ok(uncertain.getReads()>=2,"reconciliation must fetch a fresh ledger snapshot");
      console.log("Stock operator Chromium PASS: lost ACK locks all mutations and reconciliation reuses original receipt key.");
    }finally{await uncertain.context.close();}
    const blocked=await startContext(browser,{blockStorage:true});
    try{
      await fill(blocked.page);
      await blocked.page.getByRole("button",{name:"Record stock event"}).click();
      await blocked.page.getByText(/Stock retry tracking is unavailable in this browser tab/).waitFor();
      assert.equal(blocked.records.length,0,"storage failure must not submit an RPC");
      console.log("Stock operator Chromium PASS: blocked storage prevents privileged POST.");
    }finally{await blocked.context.close();}
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
