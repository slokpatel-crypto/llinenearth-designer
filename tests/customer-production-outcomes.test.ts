import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeCustomerProductionOutcome,parseCustomerProductionRecordId} from "../src/lib/designer/customer-production-outcomes.ts";

test("delivered customer outcome accepts evidence after confirmed wear",()=>{
  assert.deepEqual(
    normalizeCustomerProductionOutcome({
      overallRating:"love",
      fitResult:"clean_first_fit",
      wornConfirmed:true,
      note:"Great first fit.",
    }),
    {
      overallRating:"love",
      fitResult:"clean_first_fit",
      wornConfirmed:true,
      note:"Great first fit.",
    },
  );
});

test("fit evidence cannot be claimed before the garment is worn",()=>{
  assert.throws(
    ()=>normalizeCustomerProductionOutcome({
      overallRating:"good",
      fitResult:"minor_alteration",
      wornConfirmed:false,
    }),
    /Confirm the garment was worn/,
  );
});

test("problem outcomes require a usable note",()=>{
  assert.throws(
    ()=>normalizeCustomerProductionOutcome({
      overallRating:"needs_work",
      fitResult:"not_checked",
      wornConfirmed:false,
      note:"",
    }),
    /short note/,
  );
});

const uuid="123e4567-e89b-42d3-a456-426614174000";

test("customer production record IDs must be literal UUIDs",()=>{
  assert.equal(parseCustomerProductionRecordId(` ${uuid.toUpperCase()} `),uuid);
  for(const value of [undefined,null,true,123,[],[uuid],{id:uuid},"",uuid.slice(0,-1),"x".repeat(300)])
    assert.equal(parseCustomerProductionRecordId(value),null,`rejected ${String(value)}`);
});

test("outcome parser rejects coerced fields, silent truncation and false wear claims",()=>{
  const valid={overallRating:"good",fitResult:"not_checked",wornConfirmed:false,note:"okay"};
  for(const field of ["overallRating","fitResult","wornConfirmed","note"] as const){
    const values:unknown[]=field==="overallRating"?[["good"],true,{},null]:field==="fitResult"?[["not_checked"],{},null]:field==="wornConfirmed"?[[false],"false",0,{}]:[["okay"],123,true,{},"x".repeat(1001)];
    for(const value of values)assert.throws(()=>normalizeCustomerProductionOutcome({...valid,[field]:value}),undefined,`${field}=${String(value)}`);
  }
  assert.equal(normalizeCustomerProductionOutcome({...valid,note:"x".repeat(1000)}).note.length,1000);
  assert.deepEqual(normalizeCustomerProductionOutcome({overallRating:"good",fitResult:"not_checked"}),{overallRating:"good",fitResult:"not_checked",wornConfirmed:false,note:""});
});

test("customer production POST checks transport and typed data before auth and never trusts coerced RPC receipts",()=>{
  const source=readFileSync("src/app/api/customer-account/production/route.ts","utf8");
  assert.match(source,/secureJsonRequestError\(request,16384\)/);
  assert.match(source,/readSecureJsonObject\(request,16384\)/);
  assert.match(source,/parseCustomerProductionRecordId\(body.quoteId\)/);
  assert.match(source,/parseCustomerProductionRecordId\(body.orderId\)/);
  assert.match(source,/if\(accepted!==true\)/);
  assert.match(source,/parseCustomerProductionRecordId\(outcomeId\)/);
  assert.doesNotMatch(source,/await request\.json\(\)/);
  assert.doesNotMatch(source,/String\(body\.(?:action|quoteId|orderId)/);
  const post=source.split("export async function POST")[1];
  assert.ok(post.indexOf("readSecureJsonObject(request,16384)")<post.indexOf("getCustomerIdentity(request)"));
});
