import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {readBoundedJsonResponse} from "../src/lib/designer/bounded-json-response.ts";

const sources=[
  {path:"src/app/api/operator/stock/route.ts",limit:'name==="fabric_stock_snapshot_v2"?4 * 1024 * 1024:256 * 1024'},
  {path:"src/app/api/operator/production/route.ts",limit:'name.endsWith("_list")?4 * 1024 * 1024:256 * 1024'},
  {path:"src/app/api/customer-account/production/route.ts",limit:'name.includes("_list_owned")?4 * 1024 * 1024:256 * 1024'},
];

test("J1 and J5: all customer/operator production RPCs bound reads without leaking upstream errors",()=>{
  for(const {path,limit} of sources){
    const code=readFileSync(path,"utf8");
    assert.match(code,/import \{ readBoundedJsonResponse \} from "@\/lib\/designer\/bounded-json-response"/,path);
    assert.ok(code.includes(limit),path+" missing capped list/single budget");
    assert.match(code,/readBoundedJsonResponse\(response,maxBytes\) as T/,path);
    assert.match(code,/signal:AbortSignal\.timeout\(8_000\)/,path);
    assert.match(code,/cache:"no-store"/,path);
    assert.doesNotMatch(code,/await response\.json\(\)/,path);
    assert.doesNotMatch(code,/await response\.text\(\)/,path);
  }
});

test("production RPC caps preserve small valid receipts and bounded histories",async()=>{
  const id="123e4567-e89b-42d3-a456-426614174000";
  assert.equal(await readBoundedJsonResponse(new Response(JSON.stringify(id)),256*1024),id);
  assert.equal(await readBoundedJsonResponse(new Response("true"),256*1024),true);
  const rows=Array.from({length:100},(_,i)=>({id:i,event:"pending",detail:"x".repeat(100)}));
  assert.deepEqual(await readBoundedJsonResponse(new Response(JSON.stringify(rows)),4*1024*1024),rows);
  await assert.rejects(readBoundedJsonResponse(new Response("x".repeat(256*1024+1)),256*1024),/exceeds/);
  await assert.rejects(readBoundedJsonResponse(new Response("[invalid"),256*1024),SyntaxError);
});

test("operator quote and order ledgers never present malformed RPC responses as empty records",()=>{
  const source=readFileSync("src/app/api/operator/production/route.ts","utf8");
  assert.match(source,/if\(!Array\.isArray\(quotes\)\|\|!Array\.isArray\(orders\)\) throw/);
  assert.match(source,/Malformed production quote\/order list receipts/);
  assert.match(source,/return respond\(\{error:"Production records could not be read\."\},503\)/);
});
