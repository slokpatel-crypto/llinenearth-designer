import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifiedFirstTenAuditReceipt} from "../src/lib/designer/production-first-ten-receipt.ts";

const version="linen-earth-production-first-ten-audit-v2";
const incomplete={version,historyValid:false,orders:[],evidence:[]};
const completeEmpty={version,historyValid:true,orders:[],evidence:[]};

test("installed first-ten RPC can return valid incomplete history without certifying ten deliveries",()=>{
  assert.deepEqual(verifiedFirstTenAuditReceipt(incomplete),incomplete);
  assert.deepEqual(verifiedFirstTenAuditReceipt(completeEmpty),completeEmpty);
});

test("first-ten RPC rejects malformed or success-shaped unverified responses",()=>{
  for(const malformed of [
    null,undefined,[],true,{},[incomplete],
    {...incomplete,version:"old-version"},
    {...incomplete,historyValid:"false"},
    {...incomplete,historyValid:1},
    {...incomplete,orders:null},
    {...incomplete,evidence:{}},
    {...incomplete,orders:[null]},
    {...incomplete,evidence:["fabricated-audit"]},
    {...incomplete,orders:Array.from({length:11},()=>({}))},
    {...completeEmpty,orders:[{order_id:"fake",status:"delivered"}]},
  ]){
    assert.throws(()=>verifiedFirstTenAuditReceipt(malformed),/Malformed first-ten delivery audit receipt/,JSON.stringify(malformed));
  }
});

test("only absent first-ten RPC is optional; installed malformed, timeout and 5xx are fatal",()=>{
  const source=readFileSync("src/app/api/operator/production-evidence/route.ts","utf8");
  assert.match(source,/class ProductionEvidenceRpcHttpError extends Error/);
  assert.match(source,/throw new ProductionEvidenceRpcHttpError\(response.status\)/);
  assert.match(source,/verifiedFirstTenAuditReceipt\([\s\S]*?await rpc<unknown>\("production_first_ten_delivery_audit",\{\}\)/);
  assert.match(source,/error instanceof ProductionEvidenceRpcHttpError && error.status===404/);
  assert.match(source,/firstTenAuditInstalled=false/);
  assert.match(source,/firstTenBasis,firstTenAuditInstalled/);
  assert.doesNotMatch(source,/catch\s*\{\s*\/\/ The first-ten evidence gate remains blocked/);
});
