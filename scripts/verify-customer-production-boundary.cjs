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
  const qcCases=[
    ["foreign origin","{}",{origin:"https://outside.example"},403],
    ["same-site subdomain","{}",{"sec-fetch-site":"same-site"},403],
    ["non-JSON","{}",{"content-type":"text/plain"},415],
    ["oversized JSON",JSON.stringify({action:"record",note:"x".repeat(20_000)}),{},413],
  ];
  for(const [label,body,headers,expected] of qcCases){
    const response=await fetch(`${baseURL}/api/operator/garment-qc`,{
      method:"POST",headers:{"content-type":"application/json",...headers},body,
    });
    const data=await response.json();
    assert.equal(response.status,expected,`operator QC ${label}: ${data.error||"unexpected response"}`);
    assert.equal(typeof data.error,"string");
    assert.equal(data.inspectionId,undefined);
    assert.match(response.headers.get("cache-control")||"",/no-store/);
  }
  const deliveryCases=[
    ["foreign origin","{}",{origin:"https://outside.example"},403],
    ["same-site subdomain","{}",{"sec-fetch-site":"same-site"},403],
    ["non-JSON","{}",{"content-type":"text/plain"},415],
    ["oversized JSON",JSON.stringify({action:"record",note:"x".repeat(20_000)}),{},413],
  ];
  for(const [label,body,headers,expected] of deliveryCases){
    const response=await fetch(`${baseURL}/api/operator/production-evidence`,{
      method:"POST",headers:{"content-type":"application/json",...headers},body,
    });
    const data=await response.json();
    assert.equal(response.status,expected,`delivery evidence ${label}: ${data.error||"unexpected response"}`);
    assert.equal(typeof data.error,"string");
    assert.equal(data.evidenceId,undefined);
    assert.match(response.headers.get("cache-control")||"",/no-store/);
  }
  const measurementCases=[
    ["foreign origin","{}",{origin:"https://outside.example"},403],
    ["same-site subdomain","{}",{"sec-fetch-site":"same-site"},403],
    ["non-JSON","{}",{"content-type":"text/plain"},415],
    ["oversized JSON",JSON.stringify({note:"x".repeat(20_000)}),{},413],
  ];
  for(const [label,body,headers,expected] of measurementCases){
    const response=await fetch(`${baseURL}/api/operator/measurement-calibration`,{
      method:"POST",headers:{"content-type":"application/json",...headers},body,
    });
    const data=await response.json();
    assert.equal(response.status,expected,`measurement calibration ${label}: ${data.error||"unexpected response"}`);
    assert.equal(typeof data.error,"string");
    assert.equal(data.stored,undefined);
    assert.equal(data.eventId,undefined);
    assert.match(response.headers.get("cache-control")||"",/no-store/);
  }
  const cutCases=[
    ["foreign origin","{}",{origin:"https://outside.example"},403],
    ["same-site subdomain","{}",{"sec-fetch-site":"same-site"},403],
    ["non-JSON","{}",{"content-type":"text/plain"},415],
    ["oversized JSON",JSON.stringify({action:"record",note:"x".repeat(20_000)}),{},413],
  ];
  for(const [label,body,headers,expected] of cutCases){
    const response=await fetch(`${baseURL}/api/operator/production-calibration`,{
      method:"POST",headers:{"content-type":"application/json",...headers},body,
    });
    const data=await response.json();
    assert.equal(response.status,expected,`physical cut ${label}: ${data.error||"unexpected response"}`);
    assert.equal(typeof data.error,"string");
    assert.equal(data.evidenceId,undefined);
    assert.match(response.headers.get("cache-control")||"",/no-store/);
  }
  const meterageCases=[
    ["foreign origin","{}",{origin:"https://outside.example"},403],
    ["same-site subdomain","{}",{"sec-fetch-site":"same-site"},403],
    ["non-JSON","{}",{"content-type":"text/plain"},415],
    ["oversized JSON",JSON.stringify({action:"approve",note:"x".repeat(20_000)}),{},413],
  ];
  for(const [label,body,headers,expected] of meterageCases){
    const response=await fetch(`${baseURL}/api/operator/meterage-model`,{
      method:"POST",headers:{"content-type":"application/json",...headers},body,
    });
    const data=await response.json();
    assert.equal(response.status,expected,`meterage model ${label}: ${data.error||"unexpected response"}`);
    assert.equal(typeof data.error,"string");
    assert.equal(data.updated,undefined);
    assert.equal(data.modelId,undefined);
    assert.match(response.headers.get("cache-control")||"",/no-store/);
  }
  const launchCases=[
    ["foreign origin","{}",{origin:"https://outside.example"},403],
    ["same-site subdomain","{}",{"sec-fetch-site":"same-site"},403],
    ["non-JSON","{}",{"content-type":"text/plain"},415],
    ["oversized JSON",JSON.stringify({action:"checklist",note:"x".repeat(20_000)}),{},413],
  ];
  for(const [label,body,headers,expected] of launchCases){
    const response=await fetch(`${baseURL}/api/operator/launch-readiness`,{
      method:"POST",headers:{"content-type":"application/json",...headers},body,
    });
    const data=await response.json();
    assert.equal(response.status,expected,`launch readiness ${label}: ${data.error||"unexpected response"}`);
    assert.equal(typeof data.error,"string");
    assert.equal(data.verifiedFlowAudit,undefined);
    assert.equal(data.attemptId,undefined);
    assert.equal(data.eventId,undefined);
    assert.match(response.headers.get("cache-control")||"",/no-store/);
  }
  // Five-novice acceptance must never be created by unauthenticated,
  // cross-site, non-JSON or oversized requests. No operator login or DB write.
  const noviceCases=[
    ["foreign origin","{}",{origin:"https://outside.example"},403],
    ["same-site subdomain","{}",{"sec-fetch-site":"same-site"},403],
    ["non-JSON","{}",{"content-type":"text/plain"},415],
    ["oversized JSON",JSON.stringify({action:"record_decision",note:"x".repeat(20_000)}),{},413],
  ];
  for(const [label,body,headers,expected] of noviceCases){
    const response=await fetch(`${baseURL}/api/operator/novice-designer-study`,{
      method:"POST",headers:{"content-type":"application/json",...headers},body,
    });
    const data=await response.json();
    assert.equal(response.status,expected,`novice study ${label}: ${data.error||"unexpected response"}`);
    assert.equal(typeof data.error,"string");
    assert.equal(data.attemptId,undefined);
    assert.equal(data.eventId,undefined);
    assert.equal(data.session,undefined);
    assert.match(response.headers.get("cache-control")||"",/no-store/);
  }
  // Physical fabric policy writes are privileged; only unauthenticated
  // negative transport cases are exercised, never a real supplier sign-off.
  const fabricPolicyCases=[
    ["foreign origin","{}",{origin:"https://outside.example"},403],
    ["same-site subdomain","{}",{"sec-fetch-site":"same-site"},403],
    ["non-JSON","{}",{"content-type":"text/plain"},415],
    ["oversized JSON",JSON.stringify({status:"approved",note:"x".repeat(20_000)}),{},413],
  ];
  for(const [label,body,headers,expected] of fabricPolicyCases){
    const response=await fetch(`${baseURL}/api/operator/fabric-truth-policy`,{
      method:"POST",headers:{"content-type":"application/json",...headers},body,
    });
    const data=await response.json();
    assert.equal(response.status,expected,`fabric policy ${label}: ${data.error||"unexpected response"}`);
    assert.equal(typeof data.error,"string");
    assert.equal(data.policy,undefined);
    assert.equal(data.eventId,undefined);
    assert.match(response.headers.get("cache-control")||"",/no-store/);
  }
  // House-ease calibration is real tailor evidence. Only rejected requests
  // are tested here; no authenticated measurement or model write is attempted.
  const easeCases=[
    ["foreign origin","{}",{origin:"https://outside.example"},403],
    ["same-site subdomain","{}",{"sec-fetch-site":"same-site"},403],
    ["non-JSON","{}",{"content-type":"text/plain"},415],
    ["oversized JSON",JSON.stringify({action:"record_evidence",note:"x".repeat(20_000)}),{},413],
  ];
  for(const [label,body,headers,expected] of easeCases){
    const response=await fetch(`${baseURL}/api/operator/ease-calibration`,{
      method:"POST",headers:{"content-type":"application/json",...headers},body,
    });
    const data=await response.json();
    assert.equal(response.status,expected,`house ease ${label}: ${data.error||"unexpected response"}`);
    assert.equal(typeof data.error,"string");
    assert.equal(data.evidenceId,undefined);
    assert.equal(data.modelId,undefined);
    assert.equal(data.updated,undefined);
    assert.match(response.headers.get("cache-control")||"",/no-store/);
  }
  // No actual physical colour sample, approved Analyzer profile or
  // privileged database write is used by these transport rejection cases.
  const colourCases=[
    ["foreign origin","{}",{origin:"https://outside.example"},403],
    ["same-site subdomain","{}",{"sec-fetch-site":"same-site"},403],
    ["non-JSON","{}",{"content-type":"text/plain"},415],
    ["oversized JSON",JSON.stringify({note:"x".repeat(20_000)}),{},413],
  ];
  for(const [label,body,headers,expected] of colourCases){
    const response=await fetch(`${baseURL}/api/operator/fabric-color-calibration`,{
      method:"POST",headers:{"content-type":"application/json",...headers},body,
    });
    const data=await response.json();
    assert.equal(response.status,expected,`physical colour ${label}: ${data.error||"unexpected response"}`);
    assert.equal(typeof data.error,"string");
    assert.equal(data.checkId,undefined);
    assert.match(response.headers.get("cache-control")||"",/no-store/);
  }
  console.log(`PASS ${colourCases.length} real physical colour transport rejection contracts`);
  console.log(`PASS ${easeCases.length} real house-ease transport rejection contracts`);
  console.log(`PASS ${fabricPolicyCases.length} real fabric truth policy transport rejection contracts`);
  console.log(`PASS ${noviceCases.length} real novice study transport rejection contracts`);
  console.log(`PASS ${launchCases.length} real launch readiness transport rejection contracts`);
  console.log(`PASS ${meterageCases.length} real meterage model transport rejection contracts`);
  console.log(`PASS ${cutCases.length} real production cut transport rejection contracts`);
  console.log(`PASS ${measurementCases.length} real measurement calibration transport rejection contracts`);
  console.log(`PASS ${deliveryCases.length} real delivery evidence transport rejection contracts`);
  console.log(`PASS ${qcCases.length} real operator QC transport rejection contracts`);
  console.log(`PASS ${operatorCases.length} operator outcome transport rejection contracts`);
  console.log(`PASS ${cases.length} real customer production HTTP rejection contracts`);
  return cases.length;
}
module.exports={verifyCustomerProductionBoundary};
if(require.main===module) verifyCustomerProductionBoundary(process.env.LINEN_BROWSER_QA_URL).catch(error=>{console.error(error);process.exitCode=1;});
