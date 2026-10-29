import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {readBoundedJsonResponse} from "../src/lib/designer/bounded-json-response.ts";

const vaultRoutes=[
  "src/app/api/designer/vault/route.ts",
  "src/app/api/measurements/vault/route.ts",
];

test("both recovery vaults fail closed on oversized RPC reads and untrusted HTTP error bodies",()=>{
  for(const path of vaultRoutes){
    const source=readFileSync(path,"utf8");
    assert.match(source,/import \{ readBoundedJsonResponse \} from "@\/lib\/designer\/bounded-json-response"/,path);
    assert.match(source,/name\.endsWith\("_list_owned"\)\?4 \* 1024 \* 1024:256 \* 1024/,path);
    assert.match(source,/readBoundedJsonResponse\(response,maxBytes\) as T/,path);
    assert.match(source,/signal:AbortSignal\.timeout\(8_000\)/,path);
    assert.match(source,/cache:"no-store"/,path);
    assert.doesNotMatch(source,/await response\.json\(\)/,path);
    assert.doesNotMatch(source,/await response\.text\(\)/,path);
  }
});

test("vault RPC boundaries preserve valid single record and reject oversized or invalid JSON",async()=>{
  const receipt={expires_at:"2099-01-01T00:00:00Z",payload:{revisionId:"same-recipe"}};
  const value=JSON.stringify([receipt]);
  assert.deepEqual(await readBoundedJsonResponse(new Response(value),256*1024),[receipt]);
  await assert.rejects(readBoundedJsonResponse(new Response("x".repeat(256*1024+1)),256*1024),/exceeds/);
  await assert.rejects(readBoundedJsonResponse(new Response("bad"),256*1024),SyntaxError);
  await assert.rejects(readBoundedJsonResponse(new Response(Uint8Array.of(0xff)),256*1024),TypeError);
});

test("bounded owned-list read allows a reasonably sized list but not arbitrary response growth",async()=>{
  const rows=Array.from({length:50},(_,index)=>({vault_id:String(index),payload:"x".repeat(1000)}));
  assert.deepEqual(await readBoundedJsonResponse(new Response(JSON.stringify(rows)),4*1024*1024),rows);
  await assert.rejects(readBoundedJsonResponse(new Response(" ".repeat(4*1024*1024+1)),4*1024*1024),/exceeds/);
});
