import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readBoundedJsonResponse} from "../src/lib/designer/bounded-json-response.ts";

const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
test("main operator RPC caps backend list streams differently from mutation receipts",()=>{
  const rpc=route.split("async function rpc<T>(")[1]?.split("async function loadVerifiedLockedRevision(")[0]??"";
  assert.ok(rpc.length>100);
  assert.ok(rpc.includes('const maxBytes=name.endsWith("_list")?4 * 1024 * 1024:256 * 1024;'));
  assert.ok(rpc.includes('return await readBoundedJsonResponse(response,maxBytes) as T;'));
  assert.doesNotMatch(rpc,/response\.json\(\)|response\.text\(\)/,
    "RPC must not allocate unrestricted JSON or confidential error bodies");
  assert.match(rpc,/signal:AbortSignal\.timeout\(8_000\)/);
  assert.match(rpc,/cache:"no-store"/);
});
test("actual decoded streaming bytes, not Content-Length, cap PostgREST payload",async()=>{
  const text='{"id":"allowed"}';
  const bytes=new TextEncoder().encode(text);
  const ok=new Response(new ReadableStream({
    start(controller){
      controller.enqueue(bytes.slice(0,7));
      controller.enqueue(bytes.slice(7));
      controller.close();
    },
  }),{headers:{"content-length":"1","content-type":"application/json"}});
  assert.deepEqual(await readBoundedJsonResponse(ok,256*1024),{id:"allowed"});
  const tooBig=new Response(JSON.stringify({note:"x".repeat(270_000)}),{
    headers:{"content-length":"2","content-type":"application/json"},
  });
  await assert.rejects(readBoundedJsonResponse(tooBig,256*1024),/exceeds allowed size/);
  const list=new Response(JSON.stringify(Array(1200).fill({id:"123",note:"safe"})));
  assert.equal((await readBoundedJsonResponse(list,4*1024*1024) as unknown[]).length,1200);
});
test("malformed, empty, or invalid UTF-8 PostgREST success never becomes a verified ledger",async()=>{
  await assert.rejects(readBoundedJsonResponse(new Response("{nope"),128),SyntaxError);
  await assert.rejects(readBoundedJsonResponse(new Response(""),128),SyntaxError);
  const corrupt=new Response(new Uint8Array([123,34,112,34,58,34,255,34,125]));
  await assert.rejects(readBoundedJsonResponse(corrupt,128),TypeError);
  await assert.rejects(readBoundedJsonResponse(new Response("{}"),1),
    /Invalid bounded JSON response/);
});
