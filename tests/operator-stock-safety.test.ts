import test from "node:test";
import assert from "node:assert/strict";
import {FABRIC_STOCK} from "../src/lib/fabric-stock.ts";
import {assertCurrentFabricId,readBoundedStockMutationJson,StockMutationPayloadTooLarge,stockMutationRequestError,validateOperatorStockSnapshot,verifiedOperatorStockReceiptId}
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
  assert.ok(s.includes("if(unsafe) return respond"));
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
  const firstRpc=code.indexOf('rpc<unknown>("fabric_stock_record_v2"');
  assert.ok(parse>0&&firstRpc>parse);
  assert.ok(code.includes("error instanceof StockMutationPayloadTooLarge"));
  assert.ok(code.includes("{status:413}"));
});

test("operator release UI supplies the real named checker and physical cancellation reference",()=>{
  const code=readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
  const action=code.slice(code.indexOf('action:"release"'));
  assert.ok(action.includes("releasedBy:close.checkedBy"));
  assert.ok(action.includes("sourceReference:close.sourceReference"));
  assert.ok(code.includes('close.sourceReference.trim().length<3} onClick={()=>void post({action:"release"'));
  assert.ok(code.includes("totalAvailable.toFixed(3)"));
  assert.ok(code.includes("totalReserved.toFixed(3)"));
});

test("operator stock display does not equate a typed source reference with physical verification",()=>{
  const code=readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
  assert.ok(code.includes("Named ledger references alone do not certify physical roll counts"));
  assert.ok(code.includes("PHYSICAL PROVENANCE"));
  assert.ok(code.includes("not independent roll or metreage certification"));
  assert.ok(code.includes('provenanceReady?"RECORDED":"PENDING"'));
  assert.ok(code.includes('row.provenance_ready?"recorded":"incomplete"'));
  assert.ok(!code.includes('provenanceReady?"VERIFIED":"OPEN"'));
});


test("a missing or already closed reservation is never falsely reported as consumed or released",()=>{
  const route=readFileSync("src/app/api/operator/stock/route.ts","utf8");
  assert.ok(route.includes("if(released!==true) return respond"));
  assert.ok(route.includes('error:"Reservation was not active; no cloth was released."},{status:409}'));
  assert.ok(route.includes("if(consumed!==true) return respond"));
  assert.ok(route.includes('error:"Reservation was not active; no cloth was consumed."},{status:409}'));
  assert.ok(route.includes("return respond({released:true})"));
  assert.ok(route.includes("return respond({consumed:true})"));
});


test("operator stock dashboard fails closed when the live ledger cannot load",()=>{
  const code=readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
  assert.ok(code.includes('const [snapshotState,setSnapshotState]=useState<"loading"|"ready"|"error">("loading")'));
  assert.ok(code.includes('if(!response.ok) throw new Error("Stock ledger request failed.")'));
  assert.ok(code.includes('setSnapshotState("error")'));
  assert.ok(code.includes('setStock([])'));
  assert.ok(code.includes('snapshotState==="ready"?`${totalAvailable.toFixed(3)} m`:"—"'));
  assert.ok(code.includes('snapshotState==="ready"?`${totalReserved.toFixed(3)} m`:"—"'));
  assert.ok(code.includes('snapshotState==="error"?"UNAVAILABLE"'));
  assert.ok(code.includes('snapshotState==="ready"?(provenanceReady?"RECORDED":"PENDING"):"UNAVAILABLE"'));
  assert.ok(code.includes('disabled={busy||snapshotState!=="ready"||'));
  assert.ok(code.includes("do not reserve or cut against a missing snapshot"));
});

test("operator stock snapshots reject corrupt availability, duplicate SKUs and forged provenance",()=>{
  const row={
    fabric_id:FABRIC_STOCK[0].id,physical_metres:12,reserved_metres:2,available_metres:10,
    manual_event_count:2,provenance_event_count:2,legacy_unverified_event_count:0,
    provenance_ready:true,last_event_at:"2026-10-28T00:00:00+00:00",
  };
  assert.deepEqual(validateOperatorStockSnapshot([row]),[row]);
  assert.deepEqual(validateOperatorStockSnapshot([]),[]);
  for(const invalid of [
    null,{},[null],[row,row],
    [{...row,fabric_id:"unlisted-supplier-99"}],
    [{...row,physical_metres:"12"}],
    [{...row,physical_metres:Infinity}],
    [{...row,physical_metres:-1}],
    [{...row,reserved_metres:13}],
    [{...row,available_metres:11}],
    [{...row,manual_event_count:"2"}],
    [{...row,manual_event_count:2.5}],
    [{...row,provenance_event_count:3}],
    [{...row,legacy_unverified_event_count:1}],
    [{...row,provenance_ready:"true"}],
    [{...row,provenance_ready:false}],
    [{...row,last_event_at:"2027-02-29T00:00:00Z"}],
  ])assert.equal(validateOperatorStockSnapshot(invalid),null);
});
test("operator stock GET refuses invalid backend rows before showing available metres",()=>{
  const code=readFileSync("src/app/api/operator/stock/route.ts","utf8");
  const checked=code.indexOf("validateOperatorStockSnapshot(stock)");
  const returned=code.indexOf("stock:verified");
  assert.ok(checked>0&&returned>checked);
  assert.ok(code.includes("Stock ledger returned inconsistent rows; do not reserve or cut."));
});

test("operator stock mutations require UUID RPC acknowledgements before claiming success",()=>{
  const route=readFileSync("src/app/api/operator/stock/route.ts","utf8");
  assert.ok(route.includes('verifiedOperatorStockReceiptId(await rpc<unknown>("fabric_stock_record_v2"'));
  assert.ok(route.includes('verifiedOperatorStockReceiptId(await rpc<unknown>("fabric_stock_reserve_v2"'));
  assert.ok(route.includes("if(!eventId) return respond"));
  assert.ok(route.includes("if(!reservationId) return respond"));
  assert.ok(route.includes('if(released!==true) return respond'));
  assert.ok(route.includes('if(consumed!==true) return respond'));
});

test("unconfigured Supabase stock is unavailable, not a verified empty ledger",()=>{
  const route=readFileSync("src/app/api/operator/stock/route.ts","utf8");
  assert.ok(route.includes('Stock backend is not configured; availability is unavailable.'));
  assert.ok(!route.includes('return respond({configured:false,stock:[]})'));
});

test("privileged operator stock actions require literal strings",()=>{
  const route=readFileSync("src/app/api/operator/stock/route.ts","utf8");
  assert.ok(route.includes('const action=typeof body.action==="string"?body.action:"";'));
  assert.ok(!route.includes('const action=String(body.action||"");'));
});

test("stock event and reservation creation accept only exact UUID scalars",()=>{
  const id="f90e2d9c-60cc-45ad-a9e2-72e6b521d1d5";
  assert.equal(verifiedOperatorStockReceiptId(id),id);
  assert.equal(verifiedOperatorStockReceiptId(id.toUpperCase()),id);
  for(const forged of [
    null,undefined,false,true,12,{},[id],id+" ", " "+id,
    id+"\\n","", "not-a-uuid", "f90e2d9c-60cc-65ad-a9e2-72e6b521d1d5",
  ])assert.equal(verifiedOperatorStockReceiptId(forged),null);
});

test("operator stock privacy and generic backend errors cover every response",()=>{
  const source=readFileSync("src/app/api/operator/stock/route.ts","utf8");
  const smoke=readFileSync("scripts/verify-operator-private-response-headers.cjs","utf8");
  assert.ok(source.includes("function respond(body:unknown"));
  assert.ok(source.includes('"cache-control":"private, no-store"'));
  assert.ok(source.includes('pragma:"no-cache"'));
  assert.equal(source.split("NextResponse.json(").length-1,1);
  assert.ok(source.includes('error:"Stock operation could not be completed."'));
  assert.ok(!source.includes("error instanceof Error?error.message"));
  assert.ok(source.includes('verifiedOperatorStockReceiptId(await rpc<unknown>("fabric_stock_record_v2"'));
  assert.ok(source.includes('verifiedOperatorStockReceiptId(await rpc<unknown>("fabric_stock_reserve_v2"'));
  assert.ok(smoke.includes('"/api/operator/stock"'));
  assert.ok(smoke.includes('for(const method of ["GET","POST"])'));
});
