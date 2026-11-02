import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FABRIC_STOCK} from "../src/lib/fabric-stock.ts";
import {requireStockCloseAck,requireStockCreatedId,requireStockSnapshotRows} from "../src/lib/designer/operator-stock-response.ts";

const fabric_id=FABRIC_STOCK[0].id;
const sample={fabric_id,physical_metres:10.25,reserved_metres:2.125,
  available_metres:8.125,manual_event_count:2,provenance_event_count:2,
  legacy_unverified_event_count:0,provenance_ready:true,
  last_event_at:"2026-11-01T18:00:00Z"};

test("stock ledger UUID acknowledgments reject false-success backend HTTP 200 values",()=>{
  const uuid="B287E470-0E90-4FD4-B5FB-976EECEBD244";
  assert.equal(requireStockCreatedId(uuid),uuid.toLowerCase());
  for(const id of [
    null,undefined,true,false,0,1,{},[],[uuid],{eventId:uuid},"","bad",uuid+" ",
    "b287e470-0e90-0fd4-b5fb-976eecebd244",
    "b287e470-0e90-4fd4-75fb-976eecebd244",
  ])assert.throws(()=>requireStockCreatedId(id),/Invalid stock creation acknowledgment/);
});

test("stock snapshot accepts verified real balances and numeric decimal strings only",()=>{
  assert.deepEqual(requireStockSnapshotRows([]),[]);
  assert.deepEqual(requireStockSnapshotRows([sample]),[sample]);
  const decimal={...sample,physical_metres:"10.250",reserved_metres:"2.125",available_metres:"8.125"};
  assert.deepEqual(requireStockSnapshotRows([decimal]),[sample]);
  assert.equal(requireStockSnapshotRows([{...sample,last_event_at:null}])[0].last_event_at,null);
  assert.equal(requireStockSnapshotRows([sample]).length,1);
  const legacy={...sample,provenance_event_count:1,
    legacy_unverified_event_count:1,provenance_ready:false};
  assert.deepEqual(requireStockSnapshotRows([legacy]),[legacy]);
  const noManual={...sample,physical_metres:0,reserved_metres:0,
    available_metres:0,manual_event_count:0,provenance_event_count:0,
    legacy_unverified_event_count:0,provenance_ready:false};
  assert.deepEqual(requireStockSnapshotRows([noManual]),[noManual]);
});

test("snapshot fails closed on invented, inconsistent or malformed stock",()=>{
  const invalid=[
    null,undefined,{},false,"[]",5,[null],[true],[{}],[[]],
    [sample,sample],Array.from({length:501},()=>sample),
    [{...sample,fabric_id:"INVENTED-SUPPLIER-ROLL"}],
    [{...sample,physical_metres:null}],
    [{...sample,physical_metres:""}],
    [{...sample,physical_metres:"Infinity"}],
    [{...sample,physical_metres:"0x10"}],
    [{...sample,physical_metres:NaN}],
    [{...sample,physical_metres:-1}],
    [{...sample,reserved_metres:11}],
    [{...sample,available_metres:10.250}],
    [{...sample,manual_event_count:null}],
    [{...sample,manual_event_count:"2"}],
    [{...sample,provenance_event_count:3}],
    [{...sample,provenance_event_count:1,legacy_unverified_event_count:0}],
    [{...sample,provenance_event_count:1,legacy_unverified_event_count:1,provenance_ready:true}],
    [{...sample,provenance_event_count:2,legacy_unverified_event_count:1}],
    [{...sample,manual_event_count:0,provenance_event_count:0,legacy_unverified_event_count:0,provenance_ready:true}],
    [{...sample,provenance_ready:false}],
    [{...sample,provenance_ready:"true"}],
    [{...sample,last_event_at:"not-date"}],
  ];
  for(const value of invalid)
    assert.throws(()=>requireStockSnapshotRows(value),
      /Invalid|Inconsistent/,JSON.stringify(value)?.slice(0,60));
});

test("operator stock endpoint validates response and never exposes privileged upstream errors",()=>{
  const route=readFileSync("src/app/api/operator/stock/route.ts","utf8");
  assert.match(route,/readBoundedJsonResponse\(response,2_097_152\)/);
  assert.match(route,/mime!=="application\/json"/);
  assert.doesNotMatch(route,/response\.text\(\)/);
  assert.doesNotMatch(route,/return await response\.json\(\)/);
  assert.match(route,/requireStockSnapshotRows\(await rpc<unknown>/);
  assert.match(route,/requireStockCreatedId\(await rpc<string>\("fabric_stock_record_v3"/);
  assert.match(route,/requireStockCreatedId\(await rpc<string>\("fabric_stock_reserve_v2"/);
  assert.equal((route.match(/requireStockCreatedId\(/g)||[]).length,2);
  assert.match(route,/snapshot unavailable \(details redacted\)/);
  assert.match(route,/mutation unavailable \(details redacted\)/);
  assert.doesNotMatch(route,/console\.error\("\[operator\/stock\]",error\)/);
  assert.doesNotMatch(route,/error instanceof Error\?error\.message:"Stock operation failed\."/);
  assert.match(route,/error:"Stock operation could not be verified\."/);
  assert.match(route,/headers:\{"cache-control":"private, no-store"\}/);
});

test("release and consume SQL RPCs accept only literal JSON booleans",()=>{
  assert.equal(requireStockCloseAck(true),true);
  assert.equal(requireStockCloseAck(false),false);
  for(const value of [null,undefined,"true","false",0,1,[],[false],{}, {consumed:true},{released:false}])
    assert.throws(()=>requireStockCloseAck(value),/Invalid stock closure acknowledgment/);
});

test("stock route validates both close RPCs before interpreting inactive reservation",()=>{
  const route=readFileSync("src/app/api/operator/stock/route.ts","utf8");
  for(const name of ["fabric_stock_release_v2","fabric_stock_consume_reservation_v2"])
    assert.ok(route.includes('requireStockCloseAck(await rpc<unknown>("'+name+'"'));
  assert.equal((route.match(/requireStockCloseAck\(await rpc<unknown>/g)||[]).length,2);
  assert.doesNotMatch(route,/rpc<boolean>\("fabric_stock_(?:release|consume_reservation)_v2"/);
  assert.match(route,/if\(released!==true\) return stockPrivateJson\(\{error:"Reservation was not active; no cloth was released\."\},\{status:409\}\)/);
  assert.match(route,/if\(consumed!==true\) return stockPrivateJson\(\{error:"Reservation was not active; no cloth was consumed\."\},\{status:409\}\)/);
});

test("stock-provenance readiness is derived exactly from manual evidence SQL",()=>{
  const sql=readFileSync("supabase/migrations/20261028_fabric_stock_provenance.sql","utf8");
  const parser=readFileSync("src/lib/designer/operator-stock-response.ts","utf8");
  assert.match(sql,/count\(\*\) filter \(where l\.event_type in \('receipt','adjustment_in','adjustment_out'\)\)>0/);
  assert.match(sql,/legacy_unverified_event_count/);
  assert.match(parser,/provenance_event_count!==manual_event_count-legacy_unverified_event_count/);
  assert.match(parser,/r\.provenance_ready!==expectedReady/);
  assert.match(parser,/expectedReady=manual_event_count>0&&legacy_unverified_event_count===0/);
});
