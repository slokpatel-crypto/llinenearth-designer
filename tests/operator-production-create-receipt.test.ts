import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifiedOperatorProductionCreateId} from "../src/lib/designer/operator-production-receipt.ts";

const uuid="123e4567-e89b-42d3-a456-426614174000";

test("operator quote/order create receipts accept exact literal database UUID scalars",()=>{
  assert.equal(verifiedOperatorProductionCreateId(uuid),uuid);
  assert.equal(verifiedOperatorProductionCreateId(uuid.toUpperCase()),uuid);
});

test("operator create receipts never manufacture success from malformed RPC results",()=>{
  for(const value of [
    null,undefined,false,true,0,1,[],[uuid],{id:uuid},{quoteId:uuid},
    "",uuid+" ", " "+uuid,uuid.slice(0,-1),"not-a-uuid",
    "00000000-0000-0000-0000-000000000000",
  ]) assert.equal(verifiedOperatorProductionCreateId(value),null,String(value));
});

test("privileged quote/order create routes require confirmed IDs before reporting success",()=>{
  const source=readFileSync("src/app/api/operator/production/route.ts","utf8");
  assert.match(source,/const confirmedQuoteId=verifiedOperatorProductionCreateId\(quoteId\)/);
  assert.match(source,/const confirmedOrderId=verifiedOperatorProductionCreateId\(orderId\)/);
  assert.match(source,/if\(!confirmedQuoteId\) return respond\(\{error:/);
  assert.match(source,/if\(!confirmedOrderId\) return respond\(\{error:/);
  assert.match(source,/quoteId:confirmedQuoteId,lockedRevisionVerified:true/);
  assert.match(source,/orderId:confirmedOrderId,learningContextAttached:true,lockedRevisionVerified:true/);
  assert.doesNotMatch(source,/return respond\(\{quoteId,lockedRevisionVerified:true\}\)/);
  assert.doesNotMatch(source,/return respond\(\{orderId,learningContextAttached:true,lockedRevisionVerified:true\}\)/);
});
