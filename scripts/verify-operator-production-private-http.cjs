"use strict";
// CI-only signed built-Next HTTP acceptance of the *actual* operator POST gate.
// Every test POST uses an unsupported action. Absolutely no production RPC,
// order, status or supplier-stock mutation can be sent by this script.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
if(process.env.CI!=="true"||process.env.GITHUB_ACTIONS!=="true")
  throw Error("M165 signed operator HTTP security acceptance is CI-only.");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://localhost:3000");
assert.equal(base.protocol,"http:");
assert.ok(["localhost","127.0.0.1","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(secret&&secret.length>=32,"Signed CI-only operator test secret required.");
const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+120000})).toString("base64url");
const signed=payload+"."+createHmac("sha256",secret).update(payload).digest("base64url");
const cookie="linen_operator_session="+signed;
const url=new URL("/api/operator/production",base).toString();
let requests=0;
async function checkCase(name,{body,headers={},expected,auth=true}){
  requests++;
  const response=await fetch(url,{
    method:"POST",cache:"no-store",signal:AbortSignal.timeout(15000),
    headers:{
      "content-type":"application/json",
      "origin":base.origin,
      "sec-fetch-site":"same-origin",
      ...(auth?{cookie} : {}),
      ...headers,
    },
    body,
  });
  assert.equal(response.status,expected,
    "Built Next signed operator route must fail closed: "+name);
  assert.match(response.headers.get("cache-control")||"",/no-store/,
    "Private POST errors must be uncacheable: "+name);
  const result=await response.json();
  assert.ok(result&&typeof result.error==="string"&&result.error.length<160,
    "A bounded generic status is required: "+name);
  assert.deepEqual(Object.keys(result),["error"],"No SQL/private data in failure body");
  assert.doesNotMatch(JSON.stringify(result),/supabase|PostgREST|stack|recoveryToken|customerPhone|sql query|DO-NOT-LEAK/i);
  return result.error;
}
async function main(){
  const safe=JSON.stringify({action:"__ci_unsupported_action_no_rpc__"});
  assert.match(await checkCase("valid signed operator request with unsupported action",{
    body:safe,expected:400,
  }),/Unsupported production action/);
  const cross=await checkCase("foreign origin rejected before action",{
    body:safe,headers:{origin:"https://cross-site-attacker.invalid"},expected:403,
  });
  assert.equal(cross,"Cross-site changes are not allowed.");
  const metadata=await checkCase("cross-site fetch metadata veto even with matching origin",{
    body:safe,headers:{"sec-fetch-site":"cross-site"},expected:403,
  });
  assert.equal(metadata,"Cross-site changes are not allowed.");
  await checkCase("loopback hostname mismatch rejects alternate origin",{
    body:safe,headers:{origin:"http://127.0.0.1:3000"},expected:403,
  });
  await checkCase("non-JSON POST refused",{
    body:safe,headers:{"content-type":"text/plain"},expected:415,
  });
  await checkCase("actual body size over 65,536 bytes refused",{
    body:JSON.stringify({action:"__ci_unsupported_action_no_rpc__",padding:"x".repeat(70000)}),
    expected:413,
  });
  await checkCase("broken JSON fails before any backend call",{
    body:'{"action":"__ci_unsupported_action_no_rpc__",',expected:400,
  });
  await checkCase("non-object JSON fails before any backend call",{
    body:"[]",expected:400,
  });
  await checkCase("unsigned test client refused before action",{
    body:safe,auth:false,expected:401,
  });
  console.log("TITAN signed built-Next operator private POST CSRF/size/JSON HTTP PASS.");
  console.log("Synthetic CI-only, unsupported actions only; production RPC writes: 0; requests: "+requests);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
