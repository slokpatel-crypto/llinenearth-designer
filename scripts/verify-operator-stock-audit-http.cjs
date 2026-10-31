"use strict";
// REAL built Next.js HTTP smoke against a loopback GitHub Actions server,
// backed by a deliberately fictional, anomalous stock audit fixture.
// No live Supabase, physical supplier documents or production stock writes.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {AUDIT_FIXTURE}=require("./ci-verified-stock-fixture.cjs");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
if(process.env.GITHUB_ACTIONS!=="true"||process.env.CI!=="true")
  throw Error("Stock audit HTTP fixture verification is CI-only.");
assert.equal(base.protocol,"http:","Audit smoke cannot contact HTTPS/production.");
assert.ok(["127.0.0.1","localhost","[::1]"].includes(base.hostname),
  "Audit smoke must never contact an external host.");
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32,
  "Use a dedicated CI-only operator-session signing key.");

function signedOperatorCookie(expiresAt){
  const payload=Buffer.from(JSON.stringify({v:1,exp:expiresAt})).toString("base64url");
  const signature=createHmac("sha256",secret).update(payload).digest("base64url");
  return "linen_operator_session="+payload+"."+signature;
}
function request(cookie){
  return fetch(new URL("/api/operator/stock/audit",base),{
    redirect:"manual",cache:"no-store",
    ...(cookie?{headers:{cookie}}:{}),
    signal:AbortSignal.timeout(20_000),
  });
}
function assertPrivate(response,label){
  assert.match(response.headers.get("cache-control")||"",/\bprivate\b/i,label+" private");
  assert.match(response.headers.get("cache-control")||"",/\bno-store\b/i,label+" no-store");
  assert.equal(response.headers.get("pragma"),"no-cache",label+" pragma");
  assert.match(response.headers.get("content-type")||"",/application\/json/i,label+" JSON");
}
async function unauthorized(cookie,label){
  const result=await request(cookie);
  assert.equal(result.status,401,label+": operator cookie required");
  assertPrivate(result,label);
  assert.deepEqual(await result.json(),{error:"Unauthorized."});
}
async function main(){
  await unauthorized(undefined,"anonymous");
  await unauthorized("linen_operator_session=forged.token","forged");
  await unauthorized(signedOperatorCookie(Date.now()-60_000),"expired");

  const authorized=await request(signedOperatorCookie(Date.now()+3*60_000));
  assert.equal(authorized.status,200,"synthetic signed operator must read aggregate audit");
  assertPrivate(authorized,"signed operator aggregate audit");
  const data=await authorized.json();
  assert.deepEqual(data,{audit:AUDIT_FIXTURE},
    "Only the exact intentionally anomalous ten counters may be returned.");
  assert.equal(Object.keys(data.audit).length,10);
  for(const v of Object.values(data.audit))
    assert.ok(Number.isSafeInteger(v)&&v>=0,"All aggregate values must be nonnegative integers");
  const serialized=JSON.stringify(data);
  for(const prohibited of ["fabricId","fabric_id","source_reference","sourceReference",
                            "recorded_by","requested_by","reservationId","eventId",
                            "rollTag","customer","apiKey","service_role"]){
    assert.ok(!serialized.includes(prohibited),"Audit response revealed: "+prohibited);
  }
  assert.ok(data.audit.duplicateLineRows>0&&data.audit.missingSource>0,
    "Fixture must NEVER imply an independently verified, clean supplier ledger.");

  // Test the actual server-rendered operator page with a signed synthetic
  // cookie: the new audit must be reachable in the Stock Desk, not just in API.
  const page=await fetch(new URL("/operator/stock",base),{
    headers:{cookie:signedOperatorCookie(Date.now()+3*60_000)},
    redirect:"manual",signal:AbortSignal.timeout(20_000),
  });
  assert.equal(page.status,200,"authenticated operator stock page should render");
  const html=await page.text();
  assert.match(html,/Run aggregate audit/,
    "Stock Desk must show opt-in read-only source audit control");
  assert.match(html,/READ-ONLY SOURCE AUDIT/,
    "Stock Desk must identify the audit as read-only");
  assert.match(html,/cannot certify real paper documents/,
    "Stock Desk must not equate synthetic/source counts with physical evidence");
  console.log("Real loopback Next HTTP operator stock audit PASS: anonymous/forged/expired denied, signed 200 private, exact ten synthetic counters, visible operator panel.");
  console.log("No live supplier records, SQL writes, physical stock certification or release approval.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
