import test from "node:test";
import assert from "node:assert/strict";
import {parseOperatorProductionRequestKey}
  from "../src/lib/designer/production-request-key.ts";
import {isCertainProductionPrewriteRejection}
  from "../src/lib/designer/production-post-retry.ts";
import {productionWriteReviewSummary}
  from "../src/lib/designer/production-review-summary.ts";
const key="123e4567-e89b-42d3-a456-426614174071";
const secret="DO-NOT-LEAK-PRIVATE-KEY-2026";
test("main intake: preserve exact original v4 UUID; never generate fallback retry key",()=>{
  assert.equal(parseOperatorProductionRequestKey(key),key);
  assert.equal(parseOperatorProductionRequestKey(" "+key.toUpperCase()+" "),key);
  for(const invalid of [
    null,undefined,0,1,true,false,{},[key],
    {toString:()=>key},"","  ",
    "123e4567-e89b-12d3-a456-426614174071", // v1
    "123e4567-e89b-72d3-a456-426614174071", // v7
    "123e4567-e89b-42d3-1456-426614174071", // bad variant
    "123e4567e89b42d3a456426614174071",      // omitted hyphens
    "z".repeat(150),
  ])assert.equal(parseOperatorProductionRequestKey(invalid),null,
    "Unverifiable original key cannot authorize any durable write");
});
test("main intake: only explicitly pre-RPC HTTP denials classify as certain",()=>{
  const definite=[400,401,403,413,429];
  const uncertain=[0,200,201,202,204,301,302,304,404,408,409,410,412,
    414,422,425,499,500,502,503,504,599,600,
    "400",NaN,Infinity,-1,null,undefined,{},[],true];
  for(const code of definite)assert.equal(isCertainProductionPrewriteRejection(code),true,
    "Only explicit early API denials can safely release matching marker: "+code);
  for(const code of uncertain)assert.equal(isCertainProductionPrewriteRejection(code),false,
    "Potentially committed requests can NEVER be automatically retried: "+String(code));
});
test("main intake: review snapshot is bounded, copied and excludes unexpected private fields",()=>{
  const original={
    action:"create_quote",revisionId:"rev-123",recipeHash:"b".repeat(64),
    quoteId:"",orderId:"",status:"",currency:"INR",
    adjustment:-25,note:" Sleeve adjustment ",
    lineItems:[{label:" Fabric ",amount:1240.5},{label:"Tailor",amount:500}],
    recoveryToken:secret,requestKey:secret,cookie:secret,
    customerPhone:secret,secret:{password:secret},
  };
  const summary=productionWriteReviewSummary(original);
  assert.deepEqual(summary.lineItems,[{label:"Fabric",amount:1240.5},{label:"Tailor",amount:500}]);
  assert.equal(summary.note,"Sleeve adjustment");
  assert.equal(summary.action,"create_quote");
  assert.equal(summary.recipeHash,original.recipeHash);
  assert.equal(summary.adjustment,-25);
  assert.doesNotMatch(JSON.stringify(summary),/DO-NOT-LEAK-PRIVATE-KEY-2026|recoveryToken|customerPhone|password|cookie|requestKey/);
  original.lineItems[0].label=secret;
  assert.equal(summary.lineItems[0].label,"Fabric","Read-only review cannot mutate with form");
});
test("main intake: clamp malformed amounts, unsupported actions and oversized unsafe text",()=>{
  const summary=productionWriteReviewSummary({
    action:"wipe_database",revisionId:"r".repeat(300),recipeHash:"a".repeat(90),
    note:"n".repeat(2500),currency:"INRUSD",quoteId:"q".repeat(90),
    orderId:"o".repeat(90),status:"s".repeat(90),adjustment:Infinity,
    lineItems:[
      {label:"Valid",amount:0},{label:"NotFinite",amount:Infinity},
      {label:"Negative",amount:-1},{label:"Huge",amount:10000001},
      {label:{private:"label"},amount:1},
      ...Array.from({length:38},(_,i)=>({label:"safe-"+i,amount:i})),
    ],
  });
  assert.equal(summary.action,"unknown");
  assert.equal(summary.adjustment,null);
  assert.equal(summary.revisionId.length,220);
  assert.equal(summary.recipeHash.length,64);
  assert.equal(summary.quoteId.length,36);
  assert.equal(summary.orderId.length,36);
  assert.equal(summary.status.length,32);
  assert.equal(summary.currency.length,3);
  assert.equal(summary.note.length,1000);
  assert.equal(summary.lineItems.length,26,
    "Only first 30 source lines processed, four invalid entries excluded");
  assert.ok(summary.lineItems.every(x=>Number.isFinite(x.amount)&&x.amount>=0&&x.amount<=10000000));
});
