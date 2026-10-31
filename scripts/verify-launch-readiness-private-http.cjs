"use strict";
// Real built-Next HTTP against a dedicated 127.0.0.1 CI fixture only.
// No genuine customer, supplier, live backend or production record writes.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {LAUNCH_LISTS,BETA_LIST_PATH,CHECKLIST_LIST_PATH}=require("./ci-verified-stock-fixture.cjs");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
if(process.env.CI!=="true"||process.env.GITHUB_ACTIONS!=="true")
  throw Error("Private launch readiness HTTP test is CI-only.");
assert.equal(base.protocol,"http:");
assert.ok(["localhost","127.0.0.1","[::1]"].includes(base.hostname),
  "Launch-readiness test must not contact production or public hosts.");
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
function cookie(exp){
  const payload=Buffer.from(JSON.stringify({v:1,exp})).toString("base64url");
  return "linen_operator_session="+payload+"."+
    createHmac("sha256",secret).update(payload).digest("base64url");
}
async function get(auth){
  return fetch(new URL("/api/operator/launch-readiness",base),{
    redirect:"manual",cache:"no-store",
    ...(auth?{headers:{cookie:auth}}:{}),
    signal:AbortSignal.timeout(20_000),
  });
}
function privateHeaders(r){
  assert.match(r.headers.get("cache-control")||"",/\bprivate\b/i);
  assert.match(r.headers.get("cache-control")||"",/\bno-store\b/i);
  assert.equal(r.headers.get("pragma"),"no-cache");
}
async function main(){
  for(const [label,session] of [
    ["anonymous",undefined],
    ["forged","linen_operator_session=forged.bad"],
    ["expired",cookie(Date.now()-60_000)],
  ]){
    const r=await get(session);
    assert.equal(r.status,401,label+" must fail closed");
    privateHeaders(r);
    assert.deepEqual(await r.json(),{error:"Unauthorized."});
  }
  const r=await get(cookie(Date.now()+3*60_000));
  assert.equal(r.status,200,"signed synthetic operator must read only safe evidence");
  privateHeaders(r);
  const data=await r.json();
  assert.equal(data.configured,true);
  assert.equal(data.betaAttempts.length,1);
  assert.equal(data.checklistEvents.length,1);
  for(const [actual,raw] of [
    [data.betaAttempts[0],LAUNCH_LISTS[BETA_LIST_PATH][0]],
    [data.checklistEvents[0],LAUNCH_LISTS[CHECKLIST_LIST_PATH][0]],
  ]){
    for(const [field,value] of Object.entries(actual)){
      assert.ok(Object.hasOwn(raw,field),"Unexpected operator field: "+field);
      assert.deepEqual(value,raw[field]);
    }
    assert.equal(Object.hasOwn(actual,"private_customer_phone"),false);
    assert.equal(Object.hasOwn(actual,"private_supplier_document"),false);
  }
  assert.doesNotMatch(JSON.stringify(data),/DO-NOT-LEAK-CI-/);
  assert.equal(data.betaAttempts[0].blocking_bug,true,
    "Fake incomplete case must never be counted as verified success");
  assert.equal(data.checklistEvents[0].status,"review",
    "Fake checklist is not human approval");
  console.log("Real built Next HTTP launch evidence PASS: private statuses, signed access, bounded allowlist without synthetic secrets.");
}
main().catch(err=>{console.error(err);process.exitCode=1;});
