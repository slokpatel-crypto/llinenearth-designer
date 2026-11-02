import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {requireOwnedProductionRows,requireCustomerOutcomeId} from "../src/lib/designer/customer-production-rpc-contract.ts";

const uuid="123e4567-e89b-12d3-a456-426614174000";
test("customer outcome acknowledgment requires an actual UUID, not truthiness",()=>{
 assert.equal(requireCustomerOutcomeId(uuid),uuid);
 assert.equal(requireCustomerOutcomeId(uuid.toUpperCase()),uuid);
 for(const x of [false,true,null,0,1,{},[],[uuid],"true","", "not-an-id",
   "123e4567-e89b-02d3-a456-426614174000","x".repeat(5000)]){
   assert.throws(()=>requireCustomerOutcomeId(x),/Invalid customer outcome/);
 }
});
test("private production history requires a bounded array of row objects",()=>{
 assert.deepEqual(requireOwnedProductionRows([],100),[]);
 assert.deepEqual(requireOwnedProductionRows([{order_id:uuid}],1),[{order_id:uuid}]);
 for(const bad of [null,{},true,"[]",[null],[true],["x"],[[]],new Array(101).fill({})])
   assert.throws(()=>requireOwnedProductionRows(bad,100),/Invalid customer account history/);
 assert.throws(()=>requireOwnedProductionRows([],1000),/Invalid customer account history/);
});
test("customer-production route fail-closes on unbounded or malformed service-role RPC replies",()=>{
 const route=readFileSync("src/app/api/customer-account/production/route.ts","utf8");
 assert.match(route,/readBoundedJsonResponse\(response,MAX_CUSTOMER_PRODUCTION_RPC_RESPONSE_BYTES\)/);
 assert.match(route,/response\.headers\.get\("content-type"\)/);
 assert.match(route,/requireOwnedProductionRows\(quotes,100\)/);
 assert.match(route,/requireOwnedProductionRows\(orders,100\)/);
 assert.match(route,/requireOwnedProductionRows\(orderEvents,300\)/);
 assert.match(route,/requireOwnedProductionRows\(outcomes,100\)/);
 assert.match(route,/const outcomeId=requireCustomerOutcomeId\(outcomeAck\)/);
 assert.ok(route.indexOf("requireCustomerOutcomeId(outcomeAck)")<route.indexOf("return privateJson({recorded:true,outcomeId})"));
});
