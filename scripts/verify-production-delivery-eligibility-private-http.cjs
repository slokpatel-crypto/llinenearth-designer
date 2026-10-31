"use strict";
// M115: Real Next.js HTTP contract against a loopback-only synthetic backend.
// The CI mock defaults to a missing RPC and can explicitly simulate a valid
// or privacy-poisoned response without accessing any real Supabase.
// Neither a missing migration nor unauthenticated traffic may expose private
// order/QC data or return an optimistic delivery-eligible response.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
if(process.env.GITHUB_ACTIONS!=="true"||process.env.CI!=="true"){
  throw Error("M115 eligibility HTTP test is permitted only in disposable GitHub Actions.");
}
assert.equal(base.protocol,"http:");
assert.ok(["localhost","127.0.0.1","[::1]"].includes(base.hostname),
  "Never send operator session cookies to a non-loopback origin");
const {FIXTURE_KEY}=require("./ci-verified-stock-fixture.cjs");
const fixture=new URL("http://127.0.0.1:54324");
async function setMode(mode){
  const r=await fetch(new URL("/__fixture/eligibility-mode",fixture),{
    method:"POST",headers:{apikey:FIXTURE_KEY,"content-type":"application/json"},
    body:JSON.stringify({mode}),signal:AbortSignal.timeout(5_000),
  });
  assert.equal(r.status,200,"Synthetic loopback RPC mode setup failed");
  assert.deepEqual(await r.json(),{ciFixture:true,mode});
}
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
function signedCookie(exp){
  const payload=Buffer.from(JSON.stringify({v:1,exp})).toString("base64url");
  return "linen_operator_session="+payload+"."+
    createHmac("sha256",secret).update(payload).digest("base64url");
}
async function request(cookie){
  return fetch(new URL("/api/operator/production/delivery-eligibility",base),{
    redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(20_000),
    ...(cookie?{headers:{cookie}}:{}),
  });
}
function assertPrivate(response){
  assert.match(response.headers.get("cache-control")||"",/\bprivate\b/i);
  assert.match(response.headers.get("cache-control")||"",/\bno-store\b/i);
  assert.equal(response.headers.get("pragma"),"no-cache");
}
async function main(){
  await setMode("absent");
  try{
  for(const [label,cookie] of [
    ["anonymous",undefined],
    ["forged","linen_operator_session=invalid.bad"],
    ["expired",signedCookie(Date.now()-60_000)],
  ]){
    const response=await request(cookie);
    assert.equal(response.status,401,label+" must not read QC readiness");
    assertPrivate(response);
    assert.deepEqual(await response.json(),{error:"Unauthorized."});
  }

  // A missing SQL migration must fail closed, not return empty-but-eligible,
  // fabricated QC, or user-visible Supabase errors.
  const response=await request(signedCookie(Date.now()+180_000));
  assert.equal(response.status,503,
    "Signed operator must not receive synthetic delivery eligibility without the actual SQL RPC");
  assertPrivate(response);
  assert.deepEqual(await response.json(),{error:"Delivery verification unavailable."});

  // The existing quote/order history still loads when only this NEW optional
  // read RPC is absent; operators must be able to inspect records safely.
  const ledger=await fetch(new URL("/api/operator/production",base),{
    headers:{cookie:signedCookie(Date.now()+180_000)},
    cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(20_000),
  });
  assert.equal(ledger.status,200,
    "Missing advisory eligibility must not make existing operator ledger inaccessible");
  assertPrivate(ledger);
  const data=await ledger.json();
  assert.equal(data.configured,true);
  assert.equal(Array.isArray(data.quotes),true);
  assert.equal(Array.isArray(data.orders),true);
  assert.equal(Object.hasOwn(data,"deliveryEligibility"),false,
    "Do not silently invent a positive eligibility snapshot on the legacy production ledger");

  // The valid synthetic read verifies exact transport fields and the
  // authentication gate even when the backend says "eligible=true".
  await setMode("valid");
  const signed=signedCookie(Date.now()+180_000);
  const approved=await request(signed);
  assert.equal(approved.status,200,"Valid synthetic eligibility must be readable by operator");
  assertPrivate(approved);
  const approvedPayload=await approved.json();
  assert.deepEqual(Object.keys(approvedPayload),["eligibility"]);
  assert.equal(approvedPayload.eligibility.length,1);
  const hint=approvedPayload.eligibility[0];
  assert.deepEqual(Object.keys(hint).sort(),[
    "eligible","order_id","recipe_hash","revision_id","status","updated_at",
  ]);
  assert.equal(hint.eligible,true,"This test boolean is synthetic, not human QC");
  assert.equal(hint.status,"ready");
  assert.doesNotMatch(JSON.stringify(approvedPayload),/DO-NOT-LEAK-CI-/);

  const anonymousPositive=await request();
  assert.equal(anonymousPositive.status,401,
    "Even an eligibility-positive fixture may never bypass operator authentication");
  assertPrivate(anonymousPositive);
  assert.deepEqual(await anonymousPositive.json(),{error:"Unauthorized."});

  // A forged private column must make the WHOLE success-shaped backend
  // response invalid, rather than erase the extra field and present approval.
  await setMode("poisoned");
  const poisoned=await request(signed);
  assert.equal(poisoned.status,503,
    "Extra backend QC provenance must fail closed, not leak or approve");
  assertPrivate(poisoned);
  const invalidBody=await poisoned.json();
  assert.deepEqual(invalidBody,{error:"Delivery verification unavailable."});
  assert.doesNotMatch(JSON.stringify(invalidBody),/DO-NOT-LEAK-CI-/);
  console.log("M117 real signed eligibility HTTP 401/503/200, private serialization and poison rejection PASS");
  console.log("Synthetic CI fixture only; no physical QC, real customers, supplier stock or live Supabase.");
  }finally{
    await setMode("absent");
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
