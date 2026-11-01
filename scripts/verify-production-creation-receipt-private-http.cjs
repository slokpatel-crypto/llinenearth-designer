"use strict";
// M146: signed, actual built-Next creation receipt HTTP acceptance.
// Every upstream SQL receipt is synthetic loopback data, never real orders.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {FIXTURE_KEY}=require("./ci-verified-stock-fixture.cjs");
if(process.env.GITHUB_ACTIONS!=="true"||process.env.CI!=="true")
  throw Error("Creation receipt HTTP acceptance is GitHub Actions CI-only.");

const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
assert.equal(base.protocol,"http:");
assert.ok(["localhost","127.0.0.1","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
const requestKey="123e4567-e89b-42d3-a456-426614174071";
const quoteId="123e4567-e89b-42d3-a456-426614174010";
const orderId="123e4567-e89b-42d3-a456-426614174011";

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
async function lookup(cookie,key=requestKey){
  return fetch(new URL("/api/operator/production",base),{
    method:"POST",redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(20_000),
    headers:{"content-type":"application/json",...(cookie?{cookie}:{})},
    body:JSON.stringify({action:"creation_receipt_lookup",requestKey:key}),
  });
}
async function setMode(mode){
  const result=await fetch("http://127.0.0.1:54324/__fixture/creation-receipt-mode",{
    method:"POST",cache:"no-store",signal:AbortSignal.timeout(10_000),
    headers:{apikey:FIXTURE_KEY,"content-type":"application/json"},
    body:JSON.stringify({mode}),
  });
  assert.equal(result.status,200);
  assert.deepEqual(await result.json(),{ciFixture:true,mode});
}
async function main(){
  for(const [description,cookie] of [
    ["anonymous",undefined],
    ["forged","linen_operator_session=forged.invalid"],
    ["expired",signedCookie(Date.now()-60_000)],
  ]){
    const response=await lookup(cookie);
    assertPrivate(response);
    assert.equal(response.status,401,description+" may not recover private creation receipts");
    assert.deepEqual(await response.json(),{error:"Unauthorized."});
  }
  const signed=()=>signedCookie(Date.now()+180_000);
  for(const invalidKey of ["not-a-uuid","123e4567-e89b-12d3-a456-426614174071"]){
    const response=await lookup(signed(),invalidKey);
    assertPrivate(response);
    assert.equal(response.status,400,"Invalid original UUID must reject before SQL");
    assert.deepEqual(await response.json(),{error:"Valid original creation request UUID is required."});
  }
  try{
    await setMode("valid");
    const valid=await lookup(signed());
    assertPrivate(valid);
    assert.equal(valid.status,200);
    assert.deepEqual(await valid.json(),{receipts:[
      {action:"create_quote",receiptId:quoteId},
      {action:"create_order",receiptId:orderId},
    ]},"Only safe action and receipt UUID may cross the private route");

    await setMode("empty");
    const empty=await lookup(signed());
    assertPrivate(empty);
    assert.equal(empty.status,200);
    assert.deepEqual(await empty.json(),{receipts:[]},
      "Empty is a time-bound observation, NEVER proof of noncommit or permission to retry");

    for(const mode of ["malformed","duplicate","missing","upstream","oversized"]){
      await setMode(mode);
      const failed=await lookup(signed());
      assertPrivate(failed);
      assert.equal(failed.status,409,mode+" must fail closed");
      const data=await failed.json();
      assert.deepEqual(data,{error:["malformed","duplicate"].includes(mode)
        ?"Creation receipt lookup could not be verified."
        :"Production operation could not be completed."},
        "Private safe 409 response may not leak SQL data or imply retry authorization");
      assert.doesNotMatch(JSON.stringify(data),/DO-NOT-LEAK-CI-/);
    }
  }finally{
    await setMode("valid");
  }
  console.log("Signed built-Next creation receipt recovery HTTP PASS: private auth, exact UUID, bounded safe receipts, empty uncertainty and SQL failures (CI only).");
  console.log("No real order, write, customer contact, supplier stock or live schema.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
