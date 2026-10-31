"use strict";
// M115: Real Next.js HTTP contract against a loopback-only synthetic backend.
// The CI mock intentionally does NOT implement the new eligibility read RPC.
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

  console.log("M115 operator eligibility endpoint: auth, no-store, unavailable SQL fail-closed PASS");
  console.log("Isolated CI mock only; no actual QC, real customer orders or live Supabase.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
