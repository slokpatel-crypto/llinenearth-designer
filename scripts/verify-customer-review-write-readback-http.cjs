"use strict";
// Real built Next HTTP + isolated CI-only loopback RPC. No real customer
// feedback, owner approval, shipping, production DB writes or paid AI usage.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {OUTCOME_REVIEW_FIXTURE,OUTCOME_LEARNING_PATH,
  CI_REVIEW_RECEIPT,CI_POLICY_RECEIPT}=require("./ci-verified-stock-fixture.cjs");
if(process.env.CI!=="true"||process.env.GITHUB_ACTIONS!=="true")
  throw Error("This human review HTTP write/readback check is CI-only.");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
assert.equal(base.protocol,"http:");
assert.ok(["127.0.0.1","localhost","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
const outcomeId=OUTCOME_REVIEW_FIXTURE[OUTCOME_LEARNING_PATH][0].outcome_id;
const reviewer="CI synthetic reviewer";
const reviewNote="CI synthetic review: actual tailoring fit unverified";
const approver="CI synthetic policy signer";
const policyNote="CI only: three authentic customer approvals still required";

function cookie(exp){
  const payload=Buffer.from(JSON.stringify({v:1,exp})).toString("base64url");
  return "linen_operator_session="+payload+"."+createHmac("sha256",secret).update(payload).digest("base64url");
}
async function request(auth,body){
  return fetch(new URL("/api/operator/customer-outcomes",base),{
    method:body?"POST":"GET",redirect:"manual",cache:"no-store",
    signal:AbortSignal.timeout(20000),
    headers:{...(auth?{cookie:auth}:{}),...(body?{"content-type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
  });
}
function privateResponse(response){
  assert.match(response.headers.get("cache-control")||"",/\bprivate\b/i);
  assert.match(response.headers.get("cache-control")||"",/\bno-store\b/i);
  assert.equal(response.headers.get("pragma"),"no-cache");
}
async function expectedBody(response,status){
  assert.equal(response.status,status);
  privateResponse(response);
  return response.json();
}
async function main(){
  const reviewBody={action:"review",outcomeId,decision:"rejected",
    reviewer,note:reviewNote};
  for(const [name,auth] of [
    ["anonymous",undefined],
    ["forged","linen_operator_session=forged.invalid"],
    ["expired",cookie(Date.now()-30000)],
  ]){
    for(const body of [undefined,reviewBody]){
      const response=await request(auth,body);
      const data=await expectedBody(response,401);
      assert.deepEqual(data,{error:"Unauthorized."},name+" must not read or write human evidence");
    }
  }
  const signed=cookie(Date.now()+180000);
  // This is explicitly negative feedback; no fixture can certify a fit.
  const before=await expectedBody(await request(signed),200);
  assert.equal(before.outcomes.length,1);
  assert.equal(before.reviews.length,1);
  assert.equal(before.policies.length,1);
  assert.equal(before.summary.gateComplete,false);
  assert.equal(before.outcomes[0].fit_result,"major_alteration");
  // An invalid synthetic POST must not increment review history.
  // The fake RPC returns 400; the operator API intentionally maps backend
  // failures to a private 409 rather than exposing upstream details.
  await expectedBody(await request(signed,{...reviewBody,decision:"approved"}),409);
  const unchanged=await expectedBody(await request(signed),200);
  assert.equal(unchanged.reviews.length,1);
  // Valid negative review POST produces the literal durable receipt.
  const createdReview=await expectedBody(await request(signed,reviewBody),200);
  assert.deepEqual(createdReview,{reviewId:CI_REVIEW_RECEIPT});
  const afterReview=await expectedBody(await request(signed),200);
  const storedReview=afterReview.reviews.find(x=>x.review_id===createdReview.reviewId);
  assert.ok(storedReview,"The new immutable review receipt must be readable.");
  assert.equal(storedReview.outcome_id,outcomeId);
  assert.equal(storedReview.decision,"rejected");
  assert.equal(storedReview.reviewer,reviewer);
  assert.equal(storedReview.note,reviewNote);
  assert.equal(afterReview.summary.rejected,1);
  assert.equal(afterReview.summary.approved,0);
  assert.equal(afterReview.summary.gateComplete,false);
  assert.equal(afterReview.reviews.length,2);
  // The mock refuses duplicate writes; the UI must instruct inspection instead.
  await expectedBody(await request(signed,reviewBody),409);
  assert.equal((await expectedBody(await request(signed),200)).reviews.length,2);

  const policyBody={action:"policy",minimumApprovedCases:3,
    approvedBy:approver,note:policyNote};
  await expectedBody(await request(signed,{...policyBody,minimumApprovedCases:1}),409);
  assert.equal((await expectedBody(await request(signed),200)).policies.length,1);
  const createdPolicy=await expectedBody(await request(signed,policyBody),200);
  assert.deepEqual(createdPolicy,{policyId:CI_POLICY_RECEIPT});
  const final=await expectedBody(await request(signed),200);
  const storedPolicy=final.policies.find(x=>x.policy_id===createdPolicy.policyId);
  assert.ok(storedPolicy,"New immutable policy receipt must be readable.");
  assert.equal(storedPolicy.minimum_approved_cases,3);
  assert.equal(storedPolicy.approved_by,approver);
  assert.equal(storedPolicy.note,policyNote);
  assert.equal(final.summary.threshold,3);
  assert.equal(final.summary.approved,0);
  assert.equal(final.summary.gateComplete,false);
  assert.equal(final.reviews.length,2);
  assert.equal(final.policies.length,2);
  assert.doesNotMatch(JSON.stringify(final),/DO-NOT-LEAK-CI-/,
    "No future private database columns may leak into signed operator responses");
  await expectedBody(await request(signed,policyBody),409);
  assert.equal((await expectedBody(await request(signed),200)).policies.length,2);
  console.log("Built Next HTTP human review write/readback PASS: signed private receipts and exact negative review/policy history; no real humans or approval.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
