import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readBoundedJsonResponse} from "../src/lib/designer/bounded-json-response.ts";
import {verifiedOperatorProductionCreateId} from "../src/lib/designer/operator-production-receipt.ts";

const id="123e4567-e89b-42d3-a456-426614174000";

test("delivery evidence service bounds all success and error RPC responses without leaking upstream text",()=>{
  const code=readFileSync("src/app/api/operator/production-evidence/route.ts","utf8");
  assert.match(code,/signal:AbortSignal\.timeout\(8_000\)/);
  assert.match(code,/cache:"no-store"/);
  assert.match(code,/name\.endsWith\("_list"\)\|\|name==="production_first_ten_delivery_audit"/);
  assert.match(code,/\?4 \* 1024 \* 1024:4 \* 1024/);
  assert.match(code,/readBoundedJsonResponse\(response,maxBytes\) as T/);
  assert.doesNotMatch(code,/response\.json\(\)/);
  assert.doesNotMatch(code,/response\.text\(\)/);
  assert.match(code,/if\(!Array\.isArray\(orders\)\|\|!Array\.isArray\(evidence\)\) throw/);
  assert.match(code,/Malformed delivery evidence list receipts/);
  assert.match(code,/firstTenBasis=verifiedFirstTenAuditReceipt\(/);
  assert.match(code,/await rpc<unknown>\("production_first_ten_delivery_audit",\{\}\)/);
});

test("delivery audit write cannot confirm malformed or padded receipt, while exact UUID remains valid",()=>{
  const code=readFileSync("src/app/api/operator/production-evidence/route.ts","utf8");
  assert.match(code,/const evidenceId=verifiedOperatorProductionCreateId\(receipt\)/);
  assert.match(code,/if\(!evidenceId\) return respond\(\{error:/);
  assert.match(code,/return respond\(\{evidenceId\}\)/);
  assert.equal(verifiedOperatorProductionCreateId(id.toUpperCase()),id);
  for(const value of [false,null,[],[id],{evidence_id:id}," "+id,id+" ","0".repeat(36)]) assert.equal(verifiedOperatorProductionCreateId(value),null);
});

test("bounded decoder reads real small delivery audit snapshots and fails closed on oversized or corrupt upstream",async()=>{
  const basis={version:"linen-earth-production-first-ten-audit-v2",historyValid:false,orders:[],evidence:[]};
  const reply=new Response(JSON.stringify(basis));
  assert.deepEqual(await readBoundedJsonResponse(reply,4*1024*1024),basis);
  assert.equal(await readBoundedJsonResponse(new Response(JSON.stringify(id)),4*1024),id);
  await assert.rejects(readBoundedJsonResponse(new Response(JSON.stringify({large:"x".repeat(4096)})),4*1024),/exceeds allowed size/);
  await assert.rejects(readBoundedJsonResponse(new Response("{incomplete"),4*1024),SyntaxError);
});
