// Negative-only real HTTP checks: no authenticated customer, quote acceptance,
// outcome creation, Supabase mutation or real provider call is attempted.
const assert=require("node:assert/strict");

async function verifyCustomerProductionBoundary(baseURL="http://127.0.0.1:3000"){
  const uuid="123e4567-e89b-42d3-a456-426614174000";
  const validOutcome={action:"record_outcome",orderId:uuid,overallRating:"good",fitResult:"not_checked",wornConfirmed:false,note:"ok"};
  const cases=[
    ["foreign origin","{}",{origin:"https://outside.example"},403],
    ["same-site subdomain","{}",{"sec-fetch-site":"same-site"},403],
    ["non-JSON","{}",{"content-type":"text/plain"},415],
    ["array JSON","[]",{},400],
    ["malformed JSON",'{"broken":',{},400],
    ["coerced action",JSON.stringify({action:["accept_quote"],quoteId:uuid}),{},400],
    ["coerced quote ID",JSON.stringify({action:"accept_quote",quoteId:[uuid]}),{},400],
    ["coerced order ID",JSON.stringify({...validOutcome,orderId:[uuid]}),{},400],
    ["coerced rating",JSON.stringify({...validOutcome,overallRating:["good"]}),{},400],
    ["coerced fit",JSON.stringify({...validOutcome,fitResult:["not_checked"]}),{},400],
    ["coerced wear",JSON.stringify({...validOutcome,wornConfirmed:"false"}),{},400],
    ["coerced note",JSON.stringify({...validOutcome,note:["ok"]}),{},400],
    ["overlength note",JSON.stringify({...validOutcome,note:"x".repeat(1001)}),{},400],
    ["oversized declared JSON",JSON.stringify({action:"record_outcome",note:"x".repeat(20_000)}),{},413],
    ["oversized chunked JSON",new ReadableStream({start(controller){
      const encoder=new TextEncoder();
      controller.enqueue(encoder.encode('{"action":"record_outcome","note":"'));
      controller.enqueue(encoder.encode("x".repeat(20_000)+'"}'));
      controller.close();
    }}),{},413],
  ];
  for(const [label,body,headers,expected] of cases){
    const response=await fetch(`${baseURL}/api/customer-account/production`,{
      method:"POST",headers:{"content-type":"application/json",...headers},body,
      ...(body instanceof ReadableStream?{duplex:"half"}:{}),
    });
    const data=await response.json();
    assert.equal(response.status,expected,`${label}: ${data.error||"unexpected response"}`);
    assert.equal(typeof data.error,"string",`${label}: error required`);
    assert.equal(data.accepted,undefined,`${label}: cannot claim quote acceptance`);
    assert.equal(data.recorded,undefined,`${label}: cannot claim recorded feedback`);
    assert.match(response.headers.get("cache-control")||"",/no-store/,`${label}: must not cache private response`);
  }
  // Operator learning evidence is privileged. Only rejected requests are
  // exercised without a valid operator session or a database write.
  const operatorCases=[
    ["foreign origin","{}",{origin:"https://outside.example"},403],
    ["same-site subdomain","{}",{"sec-fetch-site":"same-site"},403],
    ["non-JSON","{}",{"content-type":"text/plain"},415],
    ["oversized JSON",JSON.stringify({action:"policy",note:"x".repeat(20_000)}),{},413],
  ];
  for(const [label,body,headers,expected] of operatorCases){
    const response=await fetch(`${baseURL}/api/operator/customer-outcomes`,{
      method:"POST",headers:{"content-type":"application/json",...headers},body,
    });
    const data=await response.json();
    assert.equal(response.status,expected,`operator outcome ${label}: ${data.error||"unexpected response"}`);
    assert.equal(typeof data.error,"string");
    assert.equal(data.reviewId,undefined);
    assert.equal(data.policyId,undefined);
    assert.match(response.headers.get("cache-control")||"",/no-store/);
  }
  console.log(`PASS ${operatorCases.length} operator outcome transport rejection contracts`);
  console.log(`PASS ${cases.length} real customer production HTTP rejection contracts`);
  return cases.length;
}
module.exports={verifyCustomerProductionBoundary};
if(require.main===module) verifyCustomerProductionBoundary(process.env.LINEN_BROWSER_QA_URL).catch(error=>{console.error(error);process.exitCode=1;});
