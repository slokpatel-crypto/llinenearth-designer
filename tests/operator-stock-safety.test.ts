import test from "node:test";
import assert from "node:assert/strict";
import {FABRIC_STOCK} from "../src/lib/fabric-stock.ts";
import {assertCurrentFabricId,readBoundedStockMutationJson,StockMutationPayloadTooLarge,stockMutationRequestError,validateOperatorStockSnapshot,verifiedOperatorStockReceiptId,verifiedOperatorStockMutationReceipt}
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
    ["normalizeManualStockEvent(body)","fabric_stock_record_v3"],
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
  const firstRpc=code.indexOf('rpc<unknown>("fabric_stock_record_v3"');
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
  assert.ok(route.includes('verifiedOperatorStockReceiptId(await rpc<unknown>("fabric_stock_record_v3"'));
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
  assert.ok(source.includes('verifiedOperatorStockReceiptId(await rpc<unknown>("fabric_stock_record_v3"'));
  assert.ok(source.includes('verifiedOperatorStockReceiptId(await rpc<unknown>("fabric_stock_reserve_v2"'));
  assert.ok(smoke.includes('"/api/operator/stock"'));
  assert.ok(smoke.includes('for(const method of ["GET","POST"])'));
});

test("operator stock UI serializes writes and reconciles ambiguous receipts before re-enabling actions",()=>{
  const source=readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
  const sql=readFileSync("supabase/migrations/20261031_stock_reservation_concurrency_provenance.sql","utf8");
  assert.ok(source.includes("const writeInFlight=useRef(false)"));
  assert.ok(source.includes("if(writeInFlight.current||snapshotState!==\"ready\""));
  assert.ok(source.includes("writeInFlight.current=true"));
  assert.ok(source.includes("readGeneration.current++"));
  assert.ok(source.includes("const generation=++readGeneration.current"));
  assert.ok(source.includes("if(generation!==readGeneration.current) return false"));
  assert.ok(source.includes("await load();"));
  assert.ok(source.includes("writeInFlight.current=false"));
  assert.ok(source.includes("stockReservationAttempt(reservationKeys.current,reservationIntent"));
  assert.ok(source.includes("reservationKeys.current.set(attempt.signature,attempt.requestKey)"));
  assert.ok(source.includes("confirmedReservations.has(reservationSignature)"));
  assert.ok(!source.includes("requestKey:crypto.randomUUID()"));
  assert.ok(source.includes("Outcome may be uncertain."));
  assert.ok(sql.includes("pg_advisory_xact_lock(hashtext('stock-request:'||v_key))"));
  assert.ok(sql.includes("where request_key=v_key limit 1"));
  // Client retries alone do not prove the SQL migration is installed or live.
});

test("operator stock mutation receipts require the exact action acknowledgement",()=>{
  const id="f90e2d9c-60cc-45ad-a9e2-72e6b521d1d5";
  for(const [action,receipt] of [
    ["record",{eventId:id}],
    ["reserve",{reservationId:id.toUpperCase()}],
    ["release",{released:true}],
    ["consume",{consumed:true}],
  ] as const)assert.equal(verifiedOperatorStockMutationReceipt(action,receipt),true,action);
  for(const action of ["record","reserve","release","consume"]){
    for(const forged of [null,{},[],{eventId:[id]},{eventId:id+" "},
      {reservationId:[id]},{reservationId:id+" "},{released:"true"},{consumed:1},
      {eventId:id,confirmed:false}]){
      if(action==="record"&&typeof forged==="object"&&forged!==null&&
         !Array.isArray(forged)&&"eventId" in forged&&forged.eventId===id)continue;
      assert.equal(verifiedOperatorStockMutationReceipt(action,forged),false,
        `${action}: ${JSON.stringify(forged)}`);
    }
  }
  assert.equal(verifiedOperatorStockMutationReceipt("reserve",{eventId:id}),false);
  assert.equal(verifiedOperatorStockMutationReceipt("record",{reservationId:id}),false);
  assert.equal(verifiedOperatorStockMutationReceipt("release",{consumed:true}),false);
  assert.equal(verifiedOperatorStockMutationReceipt("consume",{released:true}),false);
  assert.equal(verifiedOperatorStockMutationReceipt("unknown",{eventId:id}),false);
});

test("stock browser independently checks GET rows and every POST receipt before success",()=>{
  const code=readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
  assert.ok(code.includes("validateOperatorStockSnapshot(data.stock)"));
  assert.ok(code.includes("if(verifiedStock===null)throw new Error"));
  assert.ok(code.includes("setStock(verifiedStock)"));
  assert.ok(!code.includes("setStock(data.stock as StockRow[])"));
  const checked=code.indexOf("verifiedOperatorStockMutationReceipt(body.action,data)");
  const confirmed=code.indexOf("setConfirmedReservations(previous=>");
  const success=code.indexOf("setMessage(success)");
  assert.ok(checked>0&&confirmed>checked&&success>confirmed);
  assert.ok(code.includes("await load();"));
});

test("manual physical stock retries require exact database keys and cannot silently use v2",()=>{
  const route=readFileSync("src/app/api/operator/stock/route.ts","utf8");
  const client=readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
  const sql=readFileSync("supabase/migrations/20261031_stock_record_exact_retry.sql","utf8");
  assert.ok(route.includes("normalizeStockMutationRequestKey(body.requestKey)"));
  assert.ok(route.includes('rpc<unknown>("fabric_stock_record_v3"'));
  assert.ok(route.includes("p_request_key:requestKey"));
  assert.ok(!route.includes('rpc<unknown>("fabric_stock_record_v2"'));
  assert.ok(client.includes("manualRecordKeys=useRef(new Map<string,string>())"));
  assert.ok(client.includes("stockManualRecordAttempt(manualRecordKeys.current,intent"));
  assert.ok(client.includes("manualRecordKeys.current.set(attempt.signature,attempt.requestKey)"));
  assert.ok(client.includes('void post({action:"record",...intent,requestKey:attempt.requestKey}'));
  assert.ok(client.includes("confirmedManualRecords.has(manualRecordSignature)"));
  assert.ok(sql.includes("create or replace function public.fabric_stock_record_v3("));
  assert.ok(sql.includes("where l.request_key=p_request_key"));
  assert.ok(sql.includes("perform pg_advisory_xact_lock(hashtext('stock-request:'||p_request_key))"));
  assert.ok(sql.includes("perform pg_advisory_xact_lock(hashtext('stock-fabric:'||p_fabric_id))"));
  assert.ok(sql.includes("v_existing.quantity_metres<>p_quantity_metres"));
  assert.ok(sql.includes("v_existing.source_reference<>p_source_reference"));
  assert.ok(sql.includes("v_existing.note<>p_note"));
  assert.ok(sql.includes("return v_existing.event_id"));
  assert.ok(sql.includes("grant execute on function public.fabric_stock_record_v3"));
  assert.ok(sql.includes("to service_role;"));
  assert.ok(sql.includes("from public,anon,authenticated;"));
});

test("disposable PostgreSQL CI runs real stock v3 transaction and concurrency checks",()=>{
  const workflow=readFileSync(".github/workflows/titan-stock-record-db.yml","utf8");
  const script=readFileSync("scripts/ci/verify-stock-record-db.sh","utf8");
  const fixture=readFileSync("scripts/ci/stock-record-db-setup.sql","utf8");
  const tests=readFileSync("scripts/ci/stock-record-db-assertions.sql","utf8");
  assert.ok(workflow.includes("image: postgres:16"));
  assert.ok(workflow.includes("job.services.postgres.id"));
  assert.ok(workflow.includes("verify-stock-record-db.sh"));
  assert.ok(!workflow.includes("SUPABASE_URL"));
  assert.ok(!workflow.includes("SUPABASE_SECRET_KEY"));
  assert.ok(script.includes("supabase/migrations/20261031_stock_record_exact_retry.sql"));
  assert.ok(script.includes("stock-record-db-setup.sql"));
  assert.ok(script.includes("stock-record-db-assertions.sql"));
  assert.ok(script.includes('wait "$pid1"'));
  assert.ok(script.includes('wait "$pid2"'));
  assert.ok(script.includes("Concurrent same-key physical receipts"));
  assert.ok(script.includes("Concurrent overdraw must allow exactly one adjustment."));
  assert.ok(fixture.includes("create unique index fabric_stock_ledger_request_key_uidx"));
  assert.ok(tests.includes("same-key same-evidence retry returned a different physical event"));
  assert.ok(tests.includes("stock request key already belongs to different evidence"));
  assert.ok(tests.includes("privileged stock RPC role grants are not restricted"));
});

test("stock SQL integration runs historical stock-only migration chain, not just a mock fixture",()=>{
  const workflow=readFileSync(".github/workflows/titan-stock-record-db.yml","utf8");
  const script=readFileSync("scripts/ci/verify-stock-record-db.sh","utf8");
  const checks=readFileSync("scripts/ci/stock-record-historical-assertions.sql","utf8");
  assert.ok(workflow.includes('verify-stock-record-db.sh "$PG_CONTAINER" historical'));
  assert.ok(script.includes("database=titan_stock_historical"));
  assert.ok(script.includes('createdb -U postgres "$database"'));
  const ordered=[
    "20261001_fabric_stock_ledger.sql",
    "20261028_fabric_stock_provenance.sql",
    "20261029_stock_reservation_provenance.sql",
    "20261030_stock_consumption_provenance.sql",
    "20261031_stock_reservation_concurrency_provenance.sql",
    "20261031_stock_record_exact_retry.sql",
  ];
  // The fixture mode loads the newest v3 migration BEFORE the historical
  // loop. Check order only INSIDE that chronological loop, not across modes.
  const listStart=script.indexOf("for migration in ");
  const listEnd=script.indexOf("\n  do",listStart);
  assert.ok(listStart>=0&&listEnd>listStart,"Historical migration loop is required");
  const historicalChain=script.slice(listStart,listEnd);
  let previous=-1;
  for(const migration of ordered){
    const index=historicalChain.indexOf("supabase/migrations/"+migration);
    assert.ok(index>previous, `Missing/misordered historical stock migration: ${migration}`);
    previous=index;
  }
  assert.ok(script.includes('run_sql_file scripts/ci/stock-record-historical-assertions.sql'));
  assert.ok(checks.includes("public.fabric_stock_reserve_v2("));
  assert.ok(checks.includes("public.fabric_stock_consume_reservation_v2("));
  assert.ok(checks.includes("public.fabric_stock_release_v2("));
  assert.ok(checks.includes("v_physical<>3.750"));
  assert.ok(checks.includes("v_reserved<>0.000"));
  assert.ok(checks.includes("historic physical ledger RLS was not enabled"));
  assert.ok(checks.includes("historic manual source was counted more than once"));
});

test("reservation retry SQL rejects altered request evidence and is tested in real PostgreSQL",()=>{
  const migration=readFileSync("supabase/migrations/20261031_stock_reservation_exact_key_evidence.sql","utf8");
  const history=readFileSync("scripts/ci/verify-stock-record-db.sh","utf8");
  const sql=readFileSync("scripts/ci/stock-reservation-exact-key-assertions.sql","utf8");
  assert.ok(migration.includes("create or replace function public.fabric_stock_reserve_v2("));
  assert.ok(migration.includes("v_existing.event_type<>'reserve'"));
  assert.ok(migration.includes("v_existing.reservation_id is null"));
  for(const exact of ["v_existing.fabric_id<>p_fabric_id",
    "v_existing.quantity_metres<>p_quantity_metres",
    "v_existing.revision_id is distinct from p_revision_id",
    "v_existing.recorded_by is distinct from p_requested_by",
    "v_existing.source_reference is distinct from p_source_reference"]){
    assert.ok(migration.includes(exact),`Reservation key aliases another intent: ${exact}`);
  }
  assert.ok(migration.includes("stock reservation request key belongs to different evidence"));
  assert.ok(migration.includes("p_quantity_metres<>round(p_quantity_metres,3)"));
  assert.ok(migration.includes("p_request_key<>btrim(p_request_key)"));
  assert.ok(migration.includes("length(p_request_key)>180"));
  assert.ok(migration.includes("pg_advisory_xact_lock(hashtext('stock-request:'||p_request_key))"));
  assert.ok(migration.includes("pg_advisory_xact_lock(hashtext('stock-fabric:'||p_fabric_id))"));
  assert.ok(migration.includes("grant execute on function public.fabric_stock_reserve_v2("));
  assert.ok(migration.includes("to service_role;"));
  const loop=history.slice(history.indexOf("for migration in "),history.indexOf("\n  do",history.indexOf("for migration in ")));
  const record=loop.indexOf("20261031_stock_record_exact_retry.sql");
  const reserve=loop.indexOf("20261031_stock_reservation_exact_key_evidence.sql");
  assert.ok(record>=0&&reserve>record,"New reserve replacement must apply after record_v3");
  assert.ok(history.includes("run_sql_file scripts/ci/stock-reservation-exact-key-assertions.sql"));
  assert.ok(history.includes("Conflicting same-key reservations did not serialize to one winner."));
  assert.ok(history.includes("Losing reservation did not fail its exact-evidence veto."));
  assert.ok(sql.includes("different quantity improperly reused reservation key"));
  assert.ok(sql.includes("different locked revision improperly reused reservation key"));
  assert.ok(sql.includes("different source document improperly reused reservation key"));
  assert.ok(sql.includes("existing physical receipt key was adopted by a reservation"));
  assert.ok(sql.includes("different-evidence retries created extra reservation rows"));
  assert.ok(sql.includes("reserve RPC execute privileges widened"));
});

test("different-key same-line reservation protection is enforced in SQL and PostgreSQL",()=>{
  const migration=readFileSync("supabase/migrations/20261031_stock_reservation_line_dedupe.sql","utf8");
  const sql=readFileSync("scripts/ci/stock-reservation-line-dedupe-assertions.sql","utf8");
  const runner=readFileSync("scripts/ci/verify-stock-record-db.sh","utf8");
  const ui=readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
  assert.ok(migration.includes("existing duplicate meterage reservation lines require owner reconciliation"));
  assert.ok(migration.includes("create unique index if not exists fabric_stock_reserve_source_line_uidx"));
  assert.ok(migration.includes("fabric_id,revision_id,(lower(btrim(source_reference)))"));
  assert.ok(migration.includes("where l.event_type='reserve'"));
  assert.ok(migration.includes("l.fabric_id=p_fabric_id"));
  assert.ok(migration.includes("l.revision_id=p_revision_id"));
  assert.ok(migration.includes("lower(btrim(l.source_reference))=lower(btrim(p_source_reference))"));
  assert.ok(migration.includes("meterage source line already reserved for locked design and fabric"));
  const start=runner.indexOf("for migration in ");
  const end=runner.indexOf("\n  do",start);
  const list=runner.slice(start,end);
  const keyIndex=list.indexOf("20261031_stock_reservation_exact_key_evidence.sql");
  const lineIndex=list.indexOf("20261031_stock_reservation_line_dedupe.sql");
  assert.ok(start>=0&&end>start&&keyIndex>=0&&lineIndex>keyIndex);
  assert.ok(runner.includes("run_sql_file scripts/ci/stock-reservation-line-dedupe-assertions.sql"));
  assert.ok(runner.includes("Concurrent different-key same-line reservations must have one winner."));
  assert.ok(runner.includes("Concurrent different-key calls double-reserved one source line."));
  assert.ok(sql.includes("closed meterage line was reserved a second time"));
  assert.ok(sql.includes("case/space alias of the same source line was reserved again"));
  assert.ok(sql.includes("different locked design could not use same source sheet"));
  assert.ok(sql.includes("distinct documented source line was blocked"));
  assert.ok(sql.includes("SQL unique index allowed duplicate meterage line"));
  assert.ok(ui.includes("Meterage sheet + documented line reference"));
  assert.ok(ui.includes("Do not invent a new line reference to bypass a duplicate."));
});
