"use strict";
// Signed built-Next receipt recovery acceptance; all SQL is synthetic loopback.
// No actual order/status mutation, live customer data or supplier stock.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {FIXTURE_KEY}=require("./ci-verified-stock-fixture.cjs");
if(process.env.GITHUB_ACTIONS!=="true"||process.env.CI!=="true")
  throw Error("Status receipt HTTP acceptance is GitHub Actions CI-only.");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
assert.equal(base.protocol,"http:");
assert.ok(["localhost","127.0.0.1","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
const key="123e4567-e89b-42d3-a456-426614174070";
function signedCookie(exp){
  const payload=Buffer.from(JSON.stringify({v:1,exp})).toString("base64url");
  return "linen_operator_session="+payload+"."+
    createHmac("sha256",secret).update(payload).digest("base64url");
}
function assertPrivate(response){
  assert.match(response.headers.get("cache-control")||"",/\bprivate\b/i);
  assert.match(response.headers.get("cache-control")||"",/\bno-store\b/i);
  assert.equal(response.headers.get("pragma"),"no-cache");
}
async function lookup(cookie,requestKey=key){
  return fetch(new URL("/api/operator/production",base),{
    method:"POST",redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(20_000),
    headers:{"content-type":"application/json",...(cookie?{cookie}:{})},
    body:JSON.stringify({action:"status_receipt_lookup",requestKey}),
  });
}
async function setMode(mode){
  const r=await fetch("http://127.0.0.1:54324/__fixture/status-receipt-mode",{
    method:"POST",cache:"no-store",signal:AbortSignal.timeout(10_000),
    headers:{apikey:FIXTURE_KEY,"content-type":"application/json"},
    body:JSON.stringify({mode}),
  });
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{ciFixture:true,mode});
}
async function main(){
  for(const [label,cookie] of [
    ["anonymous",undefined],
    ["forged","linen_operator_session=forged.invalid"],
    ["expired",signedCookie(Date.now()-60_000)],
  ]){
    const r=await lookup(cookie);
    assertPrivate(r);
    assert.equal(r.status,401,label+" may not recover committed production receipts");
    assert.deepEqual(await r.json(),{error:"Unauthorized."});
  }
  const signed=()=>signedCookie(Date.now()+180_000);
  for(const bad of ["not-a-uuid","123e4567-e89b-12d3-a456-426614174070"]) {
    const r=await lookup(signed(),bad);
    assertPrivate(r);
    assert.equal(r.status,400,"invalid original UUID must fail before SQL");
    assert.deepEqual(await r.json(),{error:"Valid original status request UUID is required."});
  }
  try{
    await setMode("valid");
    const good=await lookup(signed());
    assertPrivate(good);
    assert.equal(good.status,200);
    assert.deepEqual(await good.json(),{receipts:[
      {action:"quote_status",recordId:"123e4567-e89b-42d3-a456-426614174010",status:"accepted"},
      {action:"order_status",recordId:"123e4567-e89b-42d3-a456-426614174011",status:"delivered"},
    ]},"only committed action/record/status metadata may cross the private boundary");
    await setMode("empty");
    const empty=await lookup(signed());
    assertPrivate(empty);
    assert.equal(empty.status,200);
    assert.deepEqual(await empty.json(),{receipts:[]},
      "empty lookup is only an observation, NEVER proof of noncommit or retry authorization");
    for(const mode of ["malformed","duplicate","missing","upstream","oversized"]){
      await setMode(mode);
      const failed=await lookup(signed());
      assertPrivate(failed);
      assert.equal(failed.status,409,mode+" must fail closed, not produce a false receipt");
      const body=await failed.json();
      assert.deepEqual(body,{error:["malformed","duplicate"].includes(mode)
        ?"Status receipt lookup could not be verified."
        :"Production operation could not be completed."},
        "validated-but-invalid SQL receipts and failed upstream reads have distinct safe errors");
      assert.doesNotMatch(JSON.stringify(body),/DO-NOT-LEAK-CI-/);
    }
  }finally{
    await setMode("valid");
  }
  console.log("Signed built-Next status receipt recovery HTTP PASS: operator auth, exact UUID, bounded private receipts, empty/noncommit ambiguity and upstream failure (CI-only).");
  console.log("No real status POST, supplier stock, operator approval or production migration.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
