"use strict";
// Built Next.js HTTP contract against CI-only loopback fake Supabase. Production
// supplier/customer/operator records are never queried or altered.
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {PRODUCTION_LISTS,QUOTE_LIST_PATH,ORDER_LIST_PATH,QC_LISTS,QC_LIST_PATH}=require("./ci-verified-stock-fixture.cjs");
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
    qcInstalled:true,customerOutcomesInstalled:false,learningContextInstalled:false,
  },"Synthetic rework is not an approved physical inspection");
  assert.equal(data.qcInspections.length,1);
  assert.equal(data.qcInspections[0].decision,"rework");
  assert.equal(data.qcInspections[0].inspection_id,QC_LISTS[QC_LIST_PATH][0].inspection_id);
  assert.equal(data.qcInspections[0].checks.recipe_match,false);
  assert.equal(Object.hasOwn(data.qcInspections[0],"private_customer_phone"),false);
  assert.deepEqual(Object.keys(data.qcInspections[0]).sort(),[
    "inspection_id","order_id","revision_id","recipe_hash","decision",
    "checks","defects","note","inspector","inspection_reference","created_at",
  ].sort());
  console.log("Signed operator real HTTP production ledger PASS; untrusted quote/order/QC extras filtered, private session required.");
  console.log("CI fixture only; no genuine supplier inventory, user data, operator approval or production deployment.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
