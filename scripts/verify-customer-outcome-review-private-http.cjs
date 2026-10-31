"use strict";
// Actual built Next HTTP against a GitHub Actions-only 127.0.0.1 fake backend.
// No authentic feedback, PII, supplier evidence, policy signing or writes.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {OUTCOME_LEARNING_PATH,OUTCOME_REVIEW_PATH,OUTCOME_POLICY_PATH,OUTCOME_REVIEW_FIXTURE}=require("./ci-verified-stock-fixture.cjs");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
if(process.env.CI!=="true"||process.env.GITHUB_ACTIONS!=="true")throw Error("CI-only review smoke");
assert.equal(base.protocol,"http:");
assert.ok(["127.0.0.1","localhost","[::1]"].includes(base.hostname));
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
function cookie(exp){
  const payload=Buffer.from(JSON.stringify({v:1,exp})).toString("base64url");
  return "linen_operator_session="+payload+"."+createHmac("sha256",secret).update(payload).digest("base64url");
}
async function request(auth){
  return fetch(new URL("/api/operator/customer-outcomes",base),{
    redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(20_000),
    ...(auth?{headers:{cookie:auth}}:{}),
  });
}
function privateResponse(r){
  assert.match(r.headers.get("cache-control")||"",/\bprivate\b/i);
  assert.match(r.headers.get("cache-control")||"",/\bno-store\b/i);
  assert.equal(r.headers.get("pragma"),"no-cache");
}
async function main(){
  for(const [label,auth] of [
    ["anonymous",undefined],["forged","linen_operator_session=forged.invalid"],
    ["expired",cookie(Date.now()-30_000)],
  ]){
    const r=await request(auth);
    assert.equal(r.status,401,label+" must not access private outcome evidence");
    privateResponse(r);
    assert.deepEqual(await r.json(),{error:"Unauthorized."});
  }
  const r=await request(cookie(Date.now()+180_000));
  assert.equal(r.status,200,"signed CI operator can read synthetic outcomes");
  privateResponse(r);
  const data=await r.json();
  assert.equal(data.configured,true);
  assert.equal(data.outcomes.length,1);
  assert.equal(data.reviews.length,1);
  assert.equal(data.policies.length,1);
  assert.deepEqual(Object.keys(data.outcomes[0]).sort(),[
    "outcome_id","order_id","revision_id","overall_rating","fit_result",
    "worn_confirmed","note","created_at","learning_context",
  ].sort());
  assert.deepEqual(Object.keys(data.reviews[0]).sort(),[
    "review_id","outcome_id","decision","reviewer","note","created_at",
  ].sort());
  assert.deepEqual(Object.keys(data.policies[0]).sort(),[
    "policy_id","minimum_approved_cases","approved_by","note","created_at",
  ].sort());
  const evidence=data.outcomes[0];
  assert.equal(evidence.overall_rating,"needs_work");
  assert.equal(evidence.fit_result,"major_alteration");
  assert.equal(evidence.worn_confirmed,true);
  assert.equal(evidence.learning_context.fabrics.shirtId,"ci-shirt");
  assert.equal(evidence.learning_context.shirt.fit,"Regular");
  assert.deepEqual(Object.keys(evidence.learning_context).sort(),[
    "version","revisionId","recipeHash","context","fabrics","shirt","trouser",
  ].sort());
  assert.deepEqual(Object.keys(evidence.learning_context.fabrics).sort(),["shirtId","trouserId"]);
  assert.equal(data.reviews[0].decision,"rejected");
  assert.equal(data.policies[0].minimum_approved_cases,2);
  assert.equal(data.summary.rejected,1);
  assert.equal(data.summary.approved,0);
  assert.equal(data.summary.gateComplete,false,
    "Synthetic rejected poor-fit feedback must never certify owner learning policy");
  assert.equal(data.summary.policy.policy_id,OUTCOME_REVIEW_FIXTURE[OUTCOME_POLICY_PATH][0].policy_id);
  assert.doesNotMatch(JSON.stringify(data),/DO-NOT-LEAK-CI-/);
  console.log("Real built Next HTTP customer learning privacy PASS: private access, bounded reviewed evidence, rejected bad fit and nested extras excluded.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
