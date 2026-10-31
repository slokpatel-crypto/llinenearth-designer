import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readBoundedJsonResponse} from "../src/lib/designer/bounded-json-response.ts";
import {verifiedOperatorProductionCreateId,verifiedOperatorDeliveryAuditReadback} from "../src/lib/designer/operator-production-receipt.ts";

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
  assert.match(code,/validProductionDeliveryBrowseReceipt\(orders,evidence\)/);
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


test("delivery evidence order selection requires exact literal UUID before RPC",()=>{
  const code=readFileSync("src/app/api/operator/production-evidence/route.ts","utf8");
  assert.match(code,/const orderId=verifiedOperatorProductionCreateId\(body\.orderId\)/);
  assert.match(code,/if\(!orderId\) return respond\(\{error:/);
  assert.match(code,/p_order_id:orderId/);
  assert.doesNotMatch(code,/normalizeVaultId\(body\.orderId\)/);
  assert.equal(verifiedOperatorProductionCreateId(id),id);
  assert.equal(verifiedOperatorProductionCreateId(id.toUpperCase()),id);
  for(const value of [null,false,[],[id],{orderId:id}," "+id,id+" ",id+"\\n","not-a-uuid"]){
    assert.equal(verifiedOperatorProductionCreateId(value),null,JSON.stringify(value));
  }
});


test("delivery evidence GET never bypasses private no-store, and errors log no private backend objects",()=>{
  const source=readFileSync("src/app/api/operator/production-evidence/route.ts","utf8");
  const get=source.split("export async function GET()")[1].split("export async function POST(")[0];
  assert.match(source,/function respond\(body:unknown,status=200\)/);
  assert.match(source,/"cache-control":"private, no-store","pragma":"no-cache"/);
  assert.equal((source.match(/NextResponse\.json\(/g)||[]).length,1,"all GET and POST paths must use the private responder");
  assert.doesNotMatch(get,/NextResponse\.json\(/);
  assert.match(get,/return respond\(\{error:"Unauthorized\."\},401\)/);
  assert.match(get,/return respond\(\{configured:true,orders,evidence,firstTenBasis,firstTenAuditInstalled\}\)/);
  assert.equal(source.split('console.error("[operator/production-evidence]",error instanceof Error?error.name:"UnknownError");').length-1,2);
});


test("delivery browser requires durable evidence receipt and a new confirmed history read",()=>{
  const source=readFileSync("src/app/operator/production-evidence/ProductionEvidenceClient.tsx","utf8");
  const save=source.split("async function saveEvidence()")[1];
  const receipt=save.indexOf("verifiedOperatorProductionCreateId(data?.evidenceId)");
  const readback=save.indexOf("const confirmed=await load({evidenceId,orderId:selected.order_id});");
  const guard=save.indexOf("if(!confirmed)return;");
  const success=save.indexOf('setMessage("Immutable completion audit saved and verified in refreshed delivery history.")');
  assert.ok(receipt>0&&readback>receipt&&guard>readback&&success>guard,
    "Saved audit success must follow both a literal UUID and matching history readback");
  assert.match(save,/if\(!evidenceId\)/);
  assert.match(save,/Production completion evidence receipt could not be verified/);
  const load=source.split("async function load(")[1].split("useEffect(()=>")[0];
  assert.match(load,/verifiedOperatorDeliveryAuditReadback\(/);
  assert.match(load,/browseEvidence,expected\.evidenceId,expected\.orderId/);
  assert.match(load,/setLoadError\(true\)/);
  assert.match(source,/An audit receipt was returned but the matching delivery history could not be confirmed/);
});

test("exact immutable audit and order UUID pair is mandatory on readback",()=>{
  const order="123e4567-e89b-42d3-a456-426614174001";
  const otherOrder="123e4567-e89b-42d3-a456-426614174002";
  const otherReceipt="123e4567-e89b-42d3-a456-426614174003";
  const rows=[{evidence_id:id,order_id:order},{evidence_id:otherReceipt,order_id:otherOrder}];
  assert.equal(verifiedOperatorDeliveryAuditReadback(rows,id,order),true);
  assert.equal(verifiedOperatorDeliveryAuditReadback(rows,id.toUpperCase(),order.toUpperCase()),true);
  assert.equal(verifiedOperatorDeliveryAuditReadback(rows,id,otherOrder),false);
  assert.equal(verifiedOperatorDeliveryAuditReadback(rows,otherReceipt,order),false);
  for(const invalid of [[],null,{},[{evidence_id:id}], [{evidence_id:id,order_id:"invalid"}],
    [{evidence_id:" "+id,order_id:order}], [{evidence_id:id,order_id:" "+order}]]){
    assert.equal(verifiedOperatorDeliveryAuditReadback(invalid,id,order),false);
  }
  for(const invalid of [null,false,{evidenceId:id},[id]," "+id,id+" ",id+"\n"]){
    assert.equal(verifiedOperatorDeliveryAuditReadback(rows,invalid,order),false);
  }
  assert.equal(verifiedOperatorProductionCreateId(id),id);
});
