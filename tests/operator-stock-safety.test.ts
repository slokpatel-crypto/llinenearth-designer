import test from "node:test";
import assert from "node:assert/strict";
import {FABRIC_STOCK} from "../src/lib/fabric-stock.ts";
import {assertCurrentFabricId,readBoundedStockMutationJson,StockMutationPayloadTooLarge,stockMutationRequestError}
  from "../src/lib/designer/operator-stock-safety.ts";
import {readFileSync} from "node:fs";

function request(origin:string|null="https://linenearth.example",
                 contentType="application/json",
                 bodyLength:string|null="450"):Pick<Request,"url"|"headers"> {
  const headers=new Headers({"content-type":contentType});
  if(origin!==null)headers.set("origin",origin);
  if(bodyLength!==null)headers.set("content-length",bodyLength);
  return {url:"https://linenearth.example/api/operator/stock",headers};
}

test("operator ledger cannot record nonexistent or invented supplier fabric IDs",()=>{
  assert.ok(FABRIC_STOCK.length>=40);
  assertCurrentFabricId(FABRIC_STOCK[0].id);
  assertCurrentFabricId(FABRIC_STOCK.at(-1)!.id);
  assert.throws(()=>assertCurrentFabricId("made-up-linen-catalogue-99"),/not in the published/);
  assert.throws(()=>assertCurrentFabricId(""),/not in the published/);
});

test("privileged stock mutations reject hostile browser Origin and unsafe media types",()=>{
  assert.equal(stockMutationRequestError(request()),null);
  assert.equal(stockMutationRequestError(request(null)),null);
  assert.equal(stockMutationRequestError(request("https://linenearth.example","application/json; charset=utf-8")),null);
  assert.deepEqual(stockMutationRequestError(request("https://malicious.example")),{
    status:403,error:"Cross-site stock changes are not allowed."
  });
  assert.equal(stockMutationRequestError(request("null"))?.status,403);
  assert.equal(stockMutationRequestError(request(null,"text/plain"))?.status,415);
  assert.equal(stockMutationRequestError(request(null,"application/x-www-form-urlencoded"))?.status,415);
  assert.equal(stockMutationRequestError(request(null,""))?.status,415);
});

test("body bounds apply before any service-role stock mutation",()=>{
  assert.equal(stockMutationRequestError(request(null,"application/json","24000")),null);
  assert.equal(stockMutationRequestError(request(null,"application/json","24001"))?.status,413);
  assert.equal(stockMutationRequestError(request(null,"application/json","not-a-number"))?.status,413);
  assert.equal(stockMutationRequestError(request(null,"application/json",null)),null);
});

test("actual operator route enforces verification before every recording or reservation RPC",()=>{
  const s=readFileSync("src/app/api/operator/stock/route.ts","utf8");
  assert.ok(s.includes("if(!await authorized())"));
  assert.ok(s.includes("stockMutationRequestError(request)"));
  assert.ok(s.includes("if(unsafe) return NextResponse.json"));
  for(const [normalizer,rpc] of [
    ["normalizeManualStockEvent(body)","fabric_stock_record_v2"],
    ["normalizeStockReservation(body)","fabric_stock_reserve_v2"],
  ]){
    const start=s.indexOf(normalizer),end=s.indexOf(rpc,start);
    assert.ok(start>=0&&end>start);
    assert.ok(s.slice(start,end).includes("assertCurrentFabricId(draft.fabricId)"));
  }
});

test("streamed operator stock body is limited even without Content-Length header",async()=>{
  const make=(body:string)=>new Request("https://linenearth.example/api/operator/stock",{
    method:"POST",headers:{"content-type":"application/json"},body,
  });
  const good=make(JSON.stringify({action:"record",note:"roll checker"}));
  assert.equal(good.headers.get("content-length"),null);
  assert.deepEqual(await readBoundedStockMutationJson(good),{action:"record",note:"roll checker"});
  const oversized=make(JSON.stringify({action:"record",note:"₹".repeat(8_200)}));
  assert.equal(stockMutationRequestError(oversized),null);
  await assert.rejects(()=>readBoundedStockMutationJson(oversized),StockMutationPayloadTooLarge);
  await assert.rejects(()=>readBoundedStockMutationJson(make("[]")) ,/must be an object/);
  await assert.rejects(()=>readBoundedStockMutationJson(make("{oops")),/valid UTF-8 JSON/);
});

test("actual stock mutation handler applies byte limit before privileged RPC",()=>{
  const code=readFileSync("src/app/api/operator/stock/route.ts","utf8");
  const parse=code.indexOf("readBoundedStockMutationJson(request)");
  const firstRpc=code.indexOf('rpc<string>("fabric_stock_record_v2"');
  assert.ok(parse>0&&firstRpc>parse);
  assert.ok(code.includes("error instanceof StockMutationPayloadTooLarge"));
  assert.ok(code.includes("{status:413}"));
});
