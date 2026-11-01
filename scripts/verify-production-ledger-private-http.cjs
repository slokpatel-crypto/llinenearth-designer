"use strict";
// Built Next.js HTTP contract against CI-only loopback fake Supabase. Production
// supplier/customer/operator records are never queried or altered.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {FIXTURE_KEY,PRODUCTION_LISTS,QUOTE_LIST_PATH,ORDER_LIST_PATH,QC_LISTS,QC_LIST_PATH,CUSTOMER_OUTCOME_LIST_PATH,CUSTOMER_OUTCOME_LISTS,LEARNING_CONTEXT_LIST_PATH,LEARNING_CONTEXT_LISTS}=require("./ci-verified-stock-fixture.cjs");
const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
if(process.env.GITHUB_ACTIONS!=="true"||process.env.CI!=="true")
  throw Error("Private production ledger HTTP tests run only in GitHub Actions CI.");
assert.equal(base.protocol,"http:");
assert.ok(["localhost","127.0.0.1","[::1]"].includes(base.hostname),
  "Private production HTTP test cannot access public or production hosts.");
const secret=process.env.LINEN_OPERATOR_SESSION_SECRET;
assert.ok(typeof secret==="string"&&secret.length>=32);
function signedCookie(exp){
  const payload=Buffer.from(JSON.stringify({v:1,exp})).toString("base64url");
  return "linen_operator_session="+payload+"."+
    createHmac("sha256",secret).update(payload).digest("base64url");
}
function request(cookie){
  return fetch(new URL("/api/operator/production",base),{
    redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(20_000),
    ...(cookie?{headers:{cookie}}:{}),
  });
}
async function setOptionalLedgerMode(mode){
  const response=await fetch("http://127.0.0.1:54324/__fixture/optional-ledger-mode",{
    method:"POST",cache:"no-store",signal:AbortSignal.timeout(10_000),
    headers:{apikey:FIXTURE_KEY,"content-type":"application/json"},
    body:JSON.stringify({mode}),
  });
  assert.equal(response.status,200,"CI-only optional evidence mode switch");
  assert.deepEqual(await response.json(),{ciFixture:true,mode});
}
function assertPrivate(response){
  assert.match(response.headers.get("cache-control")||"",/\bprivate\b/i);
  assert.match(response.headers.get("cache-control")||"",/\bno-store\b/i);
  assert.equal(response.headers.get("pragma"),"no-cache");
}
async function main(){
  for(const [label,cookie] of [
    ["anonymous",undefined],
    ["forged","linen_operator_session=forged.bad"],
    ["expired",signedCookie(Date.now()-60_000)],
  ]){
    const r=await request(cookie);
    assert.equal(r.status,401,label+" operator-only evidence must fail closed");
    assertPrivate(r);
    assert.deepEqual(await r.json(),{error:"Unauthorized."});
  }
  const response=await request(signedCookie(Date.now()+180_000));
  assert.equal(response.status,200,"signed operator should see verified synthetic production ledger");
  assertPrivate(response);
  const data=await response.json();
  assert.equal(data.configured,true);
  assert.equal(data.quotes.length,1);
  assert.equal(data.orders.length,1);
  assert.equal(data.quotes[0].total,1000);
  assert.equal(data.quotes[0].status,"accepted");
  assert.equal(data.orders[0].status,"created");
  assert.equal(data.quotes[0].line_items.length,1);
  assert.equal(data.quotes[0].line_items[0].amount,1000);
  assert.equal(data.quotes[0].line_items[0].label,"CI-only stitched garment");
  assert.deepEqual(Object.keys(data.quotes[0].line_items[0]).sort(),["amount","label"]);
  for(const [row,fixture] of [
    [data.quotes[0],PRODUCTION_LISTS[QUOTE_LIST_PATH][0]],
    [data.orders[0],PRODUCTION_LISTS[ORDER_LIST_PATH][0]],
  ]){
    for(const [key,value] of Object.entries(row)){
      assert.ok(Object.hasOwn(fixture,key),"Unexpected field exposed: "+key);
      if(key==="line_items"){
        // The whole purpose of this test is to OMIT the secret child field.
        // Compare only documented garment line evidence and explicitly forbid
        // any synthetic factory cost, including deep nested properties.
        assert.equal(value.length,fixture.line_items.length);
        for(let i=0;i<value.length;i++){
          assert.deepEqual(value[i],{
            label:fixture.line_items[i].label,
            amount:fixture.line_items[i].amount,
          },"Customer-facing quote line was changed or leaked extra fields");
        }
      }else{
        assert.deepEqual(value,fixture[key],"Verified production field differs");
      }
    }
  }
  assert.equal(Object.hasOwn(data.quotes[0],"private_customer_phone"),false);
  assert.equal(Object.hasOwn(data.orders[0],"private_supplier_rate"),false);
  assert.equal(Object.hasOwn(data.quotes[0].line_items[0],"secret_factory_cost"),false);
  assert.doesNotMatch(JSON.stringify(data),/DO-NOT-LEAK-CI-/);
  assert.deepEqual(data.optionalEvidenceSources,{
    qcInstalled:true,customerOutcomesInstalled:true,learningContextInstalled:true,
  },"Synthetic rework and poor outcome are not physical inspection or satisfied customer evidence");
  assert.equal(data.qcInspections.length,1);
  assert.equal(data.qcInspections[0].decision,"rework");
  assert.equal(data.qcInspections[0].inspection_id,QC_LISTS[QC_LIST_PATH][0].inspection_id);
  assert.equal(data.qcInspections[0].checks.recipe_match,false);
  assert.equal(Object.hasOwn(data.qcInspections[0],"private_customer_phone"),false);
  assert.deepEqual(Object.keys(data.qcInspections[0]).sort(),[
    "inspection_id","order_id","revision_id","recipe_hash","decision",
    "checks","defects","note","inspector","inspection_reference","created_at",
  ].sort());
  assert.equal(data.customerOutcomes.length,1);
  const outcome=data.customerOutcomes[0];
  const fixture=CUSTOMER_OUTCOME_LISTS[CUSTOMER_OUTCOME_LIST_PATH][0];
  assert.equal(outcome.outcome_id,fixture.outcome_id);
  assert.equal(outcome.order_id,fixture.order_id);
  assert.equal(outcome.overall_rating,"needs_work");
  assert.equal(outcome.fit_result,"major_alteration");
  assert.equal(outcome.worn_confirmed,true);
  assert.equal(outcome.note,fixture.note);
  assert.deepEqual(Object.keys(outcome).sort(),[
    "outcome_id","order_id","revision_id","overall_rating",
    "fit_result","worn_confirmed","note","created_at",
  ].sort());
  assert.equal(Object.hasOwn(outcome,"private_customer_contact"),false);
  assert.equal(Object.hasOwn(outcome,"private_shop_account"),false);
  assert.doesNotMatch(JSON.stringify(data),/DO-NOT-LEAK-CI-/);
  assert.equal(data.learningContexts.length,1);
  const contextRow=data.learningContexts[0];
  const fixtureContext=LEARNING_CONTEXT_LISTS[LEARNING_CONTEXT_LIST_PATH][0];
  assert.equal(contextRow.order_id,fixtureContext.order_id);
  assert.equal(contextRow.revision_id,fixtureContext.revision_id);
  assert.equal(contextRow.recipe_hash,fixtureContext.recipe_hash);
  assert.equal(contextRow.context.version,"linen-earth-production-learning-context-v1");
  assert.equal(contextRow.context.fabrics.shirtId,"ci-shirt");
  assert.equal(contextRow.context.shirt.fit,"Regular");
  assert.deepEqual(contextRow.context.creative.treatmentIds,["ci-treatment-1"]);
  assert.deepEqual(Object.keys(contextRow).sort(),["order_id","revision_id","recipe_hash","created_at","context"].sort());
  assert.deepEqual(Object.keys(contextRow.context).sort(),[
    "version","revisionId","recipeHash","source","context","fabrics","shirt","trouser","creative",
  ].sort());
  assert.deepEqual(Object.keys(contextRow.context.source).sort(),[
    "designerRuleSetVersion","fitConstructionVersion","styleSchemaVersion",
  ].sort());
  assert.equal(Object.hasOwn(contextRow.context.fabrics,"private_roll_supplier"),false);
  assert.equal(Object.hasOwn(contextRow.context.creative,"private_user_note"),false);
  assert.equal(Object.hasOwn(contextRow.context.shirt,"internal_wholesale_cost"),false);
  assert.doesNotMatch(JSON.stringify(data),/DO-NOT-LEAK-CI-/);
  // Exercise the built authenticated Next route, not only the pure decoder.
  // The fixture is loopback-only and never reads live supplier/customer SQL.
  try{
    await setOptionalLedgerMode("missing");
    const missing=await request(signedCookie(Date.now()+180_000));
    assertPrivate(missing);
    assert.equal(missing.status,200,"literal PGRST202 retains missing-migration compatibility");
    const absent=await missing.json();
    assert.deepEqual(absent.optionalEvidenceSources,{
      qcInstalled:false,customerOutcomesInstalled:false,learningContextInstalled:false,
    });
    for(const field of ["qcInspections","customerOutcomes","learningContexts"])
      assert.deepEqual(absent[field],[],field+" missing-function response must be empty");
    for(const mode of ["gateway404","other404","oversized404"]){
      await setOptionalLedgerMode(mode);
      const failed=await request(signedCookie(Date.now()+180_000));
      assertPrivate(failed);
      assert.equal(failed.status,503,mode+" must not masquerade as an absent optional ledger");
      assert.deepEqual(await failed.json(),{error:"Production records could not be read."},
        mode+" must not leak the upstream error body");
    }
  }finally{
    await setOptionalLedgerMode("normal");
  }
  console.log("Signed operator HTTP optional evidence 404 classification PASS (CI-only fixture).");
  console.log("Signed operator real HTTP nested learning context fields are allowlisted, fit identity is preserved.");
  console.log("Signed operator real HTTP production ledger PASS; quote/order/QC/customer-outcome private fields filtered.");
  console.log("CI fixture only; no genuine supplier inventory, user data, operator approval or production deployment.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
