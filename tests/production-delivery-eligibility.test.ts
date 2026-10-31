import test from "node:test";
import assert from "node:assert/strict";
import {parseProductionDeliveryEligibility,hasVerifiedSqlDeliveryEligibility}
  from "../src/lib/designer/production-delivery-eligibility.ts";
import {readFileSync} from "node:fs";

const orderId="123e4567-e89b-42d3-a456-426614174051";
const row={
  order_id:orderId,revision_id:"LE-LOCK-M114-001",recipe_hash:"a".repeat(64),
  status:"ready",updated_at:"2026-10-31T18:30:00Z",eligible:true,
};
const order={...row,quote_id:null,created_at:"2026-10-31T18:00:00Z",note:""};

test("M114 advisory SQL proof requires literal schema, booleans and bounded unique IDs",()=>{
  const good=parseProductionDeliveryEligibility([row]);
  assert.equal(good?.length,1);
  assert.equal(hasVerifiedSqlDeliveryEligibility(good!,order),true);
  assert.deepEqual(parseProductionDeliveryEligibility([]),[]);
  for(const invalid of [
    null,{},[null],[false],[{...row,eligible:"true"}],
    [{...row,eligible:1}],[{...row,eligible:null}],
    [{...row,status:"stitching",eligible:true}],
    [{...row,inspection_reference:"secret"}],
    [{...row,order_id:" "+orderId}],
    [{...row,recipe_hash:["a".repeat(64)]}],
    [{...row,updated_at:"2026-02-31T01:00:00Z"}],
    [row,{...row,order_id:orderId.toUpperCase()}],
    Array.from({length:101},(_,i)=>({...row,order_id:
      "123e4567-e89b-42d3-a456-"+String(i).padStart(12,"0")})),
  ]){
    assert.equal(parseProductionDeliveryEligibility(invalid),null,JSON.stringify(invalid));
  }
});

test("M114 a stale SQL advisory hint never unlocks a changed order",()=>{
  const rows=parseProductionDeliveryEligibility([row])!;
  for(const changed of [
    {...order,status:"stitching"}, {...order,revision_id:"LE-LOCK-M114-OTHER"},
    {...order,recipe_hash:"b".repeat(64)},
    {...order,updated_at:"2026-10-31T18:30:01Z"},
    {...order,order_id:"123e4567-e89b-42d3-a456-426614174052"},
    {...order,order_id:null},
  ]){
    assert.equal(hasVerifiedSqlDeliveryEligibility(rows,changed),false,JSON.stringify(changed));
  }
  assert.equal(hasVerifiedSqlDeliveryEligibility([],order),false);
  assert.equal(hasVerifiedSqlDeliveryEligibility(parseProductionDeliveryEligibility([
    {...row,eligible:false}])!,order),false);
});

test("M114 operator GET uses authenticated bounded SQL read; failure hides delivery only",()=>{
  const route=readFileSync("src/app/api/operator/production/delivery-eligibility/route.ts","utf8");
  const client=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const sql=readFileSync("supabase/migrations/20261114_delivery_eligibility_read.sql","utf8");
  const pg=readFileSync("scripts/ci/verify-production-create-idempotency.sh","utf8");
  assert.match(route,/verifyOperatorSession/);
  assert.match(route,/production_delivery_eligibility_list/);
  assert.match(route,/parseProductionDeliveryEligibility\(raw\)/);
  assert.match(route,/cache:"no-store"/);
  assert.match(route,/private, no-store/);
  assert.doesNotMatch(route,/return respond\(\{eligibility:\[\{[^}]*eligible:true/);
  assert.match(client,/fetch\("\/api\/operator\/production\/delivery-eligibility"/);
  assert.match(client,/setDeliveryEligibility\(\[\]\)/);
  assert.match(client,/hasVerifiedSqlDeliveryEligibility\(deliveryEligibility,item\)/);
  assert.doesNotMatch(client,/const deliveryQcVerified=hasVerifiedLatestDeliveryQc/);
  assert.match(sql,/q\.inspection_sequence=o\.qc_latest_sequence/);
  assert.match(sql,/q\.checks @> /);
  assert.match(sql,/to service_role/);
  assert.match(pg,/20261114_delivery_eligibility_read\.sql/);
  assert.match(pg,/m114-delivery-eligibility-assertions\.sql/);
});
