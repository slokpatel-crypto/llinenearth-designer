import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeStockSnapshotTransport} from "../src/lib/designer/stock-snapshot-transport.ts";
import {readBoundedJsonResponse} from "../src/lib/designer/bounded-json-response.ts";

test("verified snapshot transport accepts only requested SKU rows",()=>{
  const rows=[{fabric_id:"linen-a",available_metres:"1.250",provenance_ready:true}];
  assert.deepEqual(normalizeStockSnapshotTransport(rows,["linen-a","linen-b"]),rows);
  assert.deepEqual(normalizeStockSnapshotTransport([],["linen-a"]),[]);
  assert.deepEqual(normalizeStockSnapshotTransport([
    {fabric_id:"linen-a",available_metres:null,provenance_ready:"true"},
  ],["linen-a"]),[
    {fabric_id:"linen-a",available_metres:NaN,provenance_ready:false},
  ],"unknown metres cannot become verified zero");
  assert.equal(normalizeStockSnapshotTransport([
    {fabric_id:"linen-a",available_metres:1,provenance_ready:true},
    {fabric_id:"linen-a",available_metres:0,provenance_ready:true},
  ],["linen-a","linen-b"]).length,2,
  "duplicate rows remain visible for downstream duplicate rejection");
});

test("malformed, unscoped or excessive snapshot envelopes fail closed",()=>{
  for(const bad of [
    null,{},true,"[]",[{fabric_id:"linen-b",available_metres:1}],
    [null],[[]],[42],[{fabric_id:123,available_metres:1}],
    [{fabric_id:"linen-a",available_metres:1},
     {fabric_id:"linen-a",available_metres:1}],
  ])assert.throws(()=>normalizeStockSnapshotTransport(bad,["linen-a"]),
    /Invalid|Unexpected/,JSON.stringify(bad));
});

test("Designer inventory loader checks JSON media type, bounded bytes and SKU envelope",()=>{
  const source=readFileSync("src/lib/designer/stock-availability-server.ts","utf8");
  const mime=source.indexOf('if(mime!=="application/json")');
  const read=source.indexOf("readBoundedJsonResponse(response,2_097_152)");
  const validate=source.indexOf("normalizeStockSnapshotTransport(data,ids)");
  assert.ok(mime>0&&read>mime&&validate>read);
  assert.doesNotMatch(source,/response\.json\(\)/);
  assert.doesNotMatch(source,/snapshot failed",error\)/,
    "private upstream errors must not reach logs");
});

test("actual streamed response cannot bypass the 2 MiB cap",async()=>{
  const tooLarge=new Response(JSON.stringify({blob:"x".repeat(2_097_152)}));
  await assert.rejects(()=>readBoundedJsonResponse(tooLarge,2_097_152),
    /exceeds allowed size/);
  assert.deepEqual(await readBoundedJsonResponse(
    new Response('[{"fabric_id":"linen-a","available_metres":"1.250","provenance_ready":true}]'),
    2_097_152),[
      {fabric_id:"linen-a",available_metres:"1.250",provenance_ready:true},
    ]);
});
