import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifiedOperatorProductionCreateId} from "../src/lib/designer/operator-production-receipt.ts";

const uuid="123e4567-e89b-42d3-a456-426614174000";

test("garment QC service caps list and mutation RPC reply bodies without echoing upstream errors",()=>{
  const source=readFileSync("src/app/api/operator/garment-qc/route.ts","utf8");
  assert.match(source,/signal:AbortSignal\.timeout\(8_000\)/);
  assert.match(source,/readBoundedJsonResponse\(response,name\.endsWith\("_list"\)\?4 \* 1024 \* 1024:4 \* 1024\)/);
  assert.doesNotMatch(source,/response\.json\(\)/);
  assert.doesNotMatch(source,/response\.text\(\)/);
  assert.match(source,/if\(!Array\.isArray\(orders\)\|\|!Array\.isArray\(inspections\)\) throw/);
  assert.match(source,/return respond\(\{error:"Finished-garment QC records could not be read\."\},503\)/);
});

test("garment QC inspection creation returns success only after literal exact UUID evidence",()=>{
  const source=readFileSync("src/app/api/operator/garment-qc/route.ts","utf8");
  assert.match(source,/const inspectionId=verifiedOperatorProductionCreateId\(receipt\)/);
  assert.match(source,/if\(!inspectionId\) return respond\(\{error:/);
  assert.match(source,/return respond\(\{inspectionId\}\)/);
  assert.equal(verifiedOperatorProductionCreateId(uuid),uuid);
  for(const malformed of [null,false,[],[uuid],{inspection_id:uuid}," "+uuid,uuid+" ",uuid.slice(0,-1)]){
    assert.equal(verifiedOperatorProductionCreateId(malformed),null,String(malformed));
  }
});
