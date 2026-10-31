"use strict";
// Built Next.js HTTP session against CI-only 127.0.0.1 fictional delivery data.
// Manual design re-entry deliberately occurred; this is NOT a delivery approval.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {
  DELIVERY_FIXTURE_ORDER,DELIVERY_FIXTURE_EVIDENCE,
  DELIVERY_FIXTURE_BASIS,
}=require("./ci-verified-stock-fixture.cjs");
if(process.env.CI!=="true"||process.env.GITHUB_ACTIONS!=="true")
  throw Error("CI-only delivery HTTP privacy smoke");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
assert.equal(base.protocol,"http:");
assert.ok(["127.0.0.1","localhost","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
function cookie(exp){
  const payload=Buffer.from(JSON.stringify({v:1,exp})).toString("base64url");
  return "linen_operator_session="+payload+"."+createHmac("sha256",secret).update(payload).digest("base64url");
}
async function request(auth,method="GET"){
  return fetch(new URL("/api/operator/production-evidence",base),{
    method,redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(20_000),
    headers:{...(auth?{cookie:auth}:{}),...(method==="POST"?{"content-type":"application/json"}:{})},
    ...(method==="POST"?{body:JSON.stringify({action:"record"})}:{}),
  });
}
function privateResponse(r){
  assert.match(r.headers.get("cache-control")||"",/\bprivate\b/i);
  assert.match(r.headers.get("cache-control")||"",/\bno-store\b/i);
  assert.equal(r.headers.get("pragma"),"no-cache");
}
function exactKeys(data,expected){
  assert.deepEqual(Object.keys(data).sort(),expected.slice().sort());
}
async function main(){
  const signed=cookie(Date.now()+180_000);
  for(const [label,auth] of [
    ["anonymous",undefined],["forged","linen_operator_session=forged.invalid"],
    ["expired",cookie(Date.now()-30_000)],
  ]){
    for(const method of ["GET","POST"]){
      const r=await request(auth,method);
      assert.equal(r.status,401,label+" "+method+" must not access delivery evidence");
      privateResponse(r);
      assert.deepEqual(await r.json(),{error:"Unauthorized."});
    }
  }
  // A signed but malformed write must be rejected without any mock DB mutation.
  const malformed=await request(signed,"POST");
  assert.equal(malformed.status,400);
  privateResponse(malformed);
  const r=await request(signed);
  assert.equal(r.status,200,"signed CI operator should read bounded fictional delivery evidence");
  privateResponse(r);
  const data=await r.json();
  assert.equal(data.configured,true);
  assert.equal(data.firstTenAuditInstalled,true);
  assert.equal(data.orders.length,1);
  assert.equal(data.evidence.length,1);
  exactKeys(data.orders[0],["order_id","revision_id","recipe_hash","status","note","created_at","delivered_at"]);
  exactKeys(data.evidence[0],[
    "evidence_id","order_id","revision_id","recipe_hash","manual_design_reentry",
    "reentry_fields","note","operator","evidence_reference","created_at","order_created_at",
  ]);
  assert.equal(data.orders[0].order_id,DELIVERY_FIXTURE_ORDER.order_id);
  assert.equal(data.evidence[0].evidence_id,DELIVERY_FIXTURE_EVIDENCE.evidence_id);
  assert.equal(data.evidence[0].order_id,DELIVERY_FIXTURE_ORDER.order_id);
  assert.equal(data.evidence[0].manual_design_reentry,true);
  assert.deepEqual(data.evidence[0].reentry_fields,["fabric_identity"]);
  assert.equal(data.firstTenBasis.version,DELIVERY_FIXTURE_BASIS.version);
  assert.equal(data.firstTenBasis.historyValid,true);
  exactKeys(data.firstTenBasis,["version","historyValid","orders","evidence"]);
  assert.equal(data.firstTenBasis.orders.length,1);
  assert.equal(data.firstTenBasis.evidence.length,1);
  exactKeys(data.firstTenBasis.orders[0],Object.keys(data.orders[0]));
  exactKeys(data.firstTenBasis.evidence[0],Object.keys(data.evidence[0]));
  assert.equal(data.firstTenBasis.evidence[0].manual_design_reentry,true);
  assert.equal(data.firstTenBasis.evidence[0].order_id,DELIVERY_FIXTURE_ORDER.order_id);
  assert.doesNotMatch(JSON.stringify(data),/DO-NOT-LEAK-CI-/,
    "No private customer/supplier/cost fields may cross the signed HTTP route");
  assert.equal(data.firstTenBasis.orders.length<10,true,
    "Fake CI delivery count must never be treated as first-ten approval");
  console.log("Built Next delivery private HTTP PASS: unauthorized, forged, expired, signed private transport, adverse manual re-entry and nested secrets stripped; no real delivery.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
