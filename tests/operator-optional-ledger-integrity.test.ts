import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifiedOptionalProductionRows} from "../src/lib/designer/optional-production-ledger.ts";
import {isMissingOptionalProductionRpcResponse} from "../src/lib/designer/optional-production-rpc-error.ts";

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
  assert.ok(api.includes('name.endsWith("_list") && await isMissingOptionalProductionRpcResponse(response)'));
  assert.ok(api.includes("throw new ProductionRpcHttpError(response.status,"));
  assert.ok(api.includes("verifiedOptionalProductionRows(await rpc<unknown>(name,{p_limit:limit}))"));
  assert.ok(api.includes("error instanceof ProductionRpcHttpError && error.status===404 && error.missingOptionalRpc"));
  assert.ok(!api.includes("error instanceof ProductionRpcHttpError && error.status===404)"));
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

test("operator UI exposes missing optional migrations instead of silently implying empty evidence",()=>{
  const ui=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  assert.ok(ui.includes("if(!validProductionDeskResponse(data))"),"malformed optional-source receipts must fail closed before state changes");
  assert.ok(ui.includes("setOptionalEvidenceSources(data.configured?data.optionalEvidenceSources:null)"),"only a validated configured response may show optional-source availability");
  assert.ok(ui.includes("setOptionalEvidenceSources(null)"));
  assert.ok(ui.includes("Some optional production evidence services are not installed."));
  assert.ok(ui.includes("Missing history is unverified"));
});


test("only bounded PostgREST PGRST202 404 proves a missing optional evidence RPC",async()=>{
  const response=(status:number,body:string)=>new Response(body,{status,headers:{"content-type":"application/json"}});
  assert.equal(await isMissingOptionalProductionRpcResponse(response(404,JSON.stringify({code:"PGRST202",message:"Function absent"}))),true);
  for(const [status,body] of [
    [404,JSON.stringify({code:"PGRST116",message:"Row missing"})],
    [404,JSON.stringify({code:"42P01",message:"Table missing"})],
    [404,JSON.stringify({error:"Gateway route not found"})],
    [404,"not JSON"],
    [404,""],
    [404,JSON.stringify({code:"PGRST202",padding:"x".repeat(4096)})],
    [503,JSON.stringify({code:"PGRST202"})],
    [401,JSON.stringify({code:"PGRST202"})],
  ] as Array<[number,string]>){
    assert.equal(await isMissingOptionalProductionRpcResponse(response(status,body)),false,
      "only a small literal missing-function 404 may disable an optional ledger");
  }
});
