import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifiedOptionalProductionRows} from "../src/lib/designer/optional-production-ledger.ts";

test("optional evidence RPC 200 must contain an actual list, including legitimate empty lists",()=>{
  const row={order_id:"123e4567-e89b-42d3-a456-426614174000"};
  assert.deepEqual(verifiedOptionalProductionRows([]),[]);
  assert.deepEqual(verifiedOptionalProductionRows([row]),[row]);
  for(const malformed of [null,undefined,false,0,"[]",{}, {rows:[row]}, {error:"upstream unavailable"}]){
    assert.throws(()=>verifiedOptionalProductionRows(malformed),/Malformed optional production evidence ledger/);
  }
});

test("operator production desk only tolerates absent optional RPC, never malformed or failed live evidence",()=>{
  const api=readFileSync("src/app/api/operator/production/route.ts","utf8");
  assert.ok(api.includes("class ProductionRpcHttpError extends Error"));
  assert.ok(api.includes("throw new ProductionRpcHttpError(response.status)"));
  assert.ok(api.includes("verifiedOptionalProductionRows(await rpc<unknown>(name,{p_limit:limit}))"));
  assert.ok(api.includes("error instanceof ProductionRpcHttpError && error.status===404"));
  assert.ok(api.includes("throw error;"));
  for(const name of ["finished_garment_qc_list","production_customer_outcome_list","production_order_learning_context_list"]){
    assert.ok(api.includes('readOptionalProductionLedger("'+name+'"'));
  }
  for(const field of ["qcInstalled","customerOutcomesInstalled","learningContextInstalled"]){
    assert.ok(api.includes(field));
  }
  assert.ok(!api.includes("qcInspections=await rpc<unknown[]>"));
  assert.ok(!api.includes("customerOutcomes=await rpc<unknown[]>"));
  assert.ok(!api.includes("learningContexts=await rpc<unknown[]>"));
});
