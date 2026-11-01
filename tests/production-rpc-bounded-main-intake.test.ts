import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readBoundedJsonResponse} from "../src/lib/designer/bounded-json-response.ts";

const route=readFileSync("src/app/api/operator/production/route.ts","utf8");

function streamResponse(chunks:Uint8Array[],headers:Record<string,string>={}):Response{
  return new Response(new ReadableStream<Uint8Array>({
    start(controller){
      for(const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  }),{headers});
}

test("privileged operator RPC consumes bounded decoded bytes, not response.json",()=>{
  assert.match(route,/import \{readBoundedJsonResponse\} from "@\/lib\/designer\/bounded-json-response"/);
  assert.match(route,/const MAX_PRODUCTION_RPC_RESPONSE_BYTES=2_097_152/);
  assert.match(route,/return await readBoundedJsonResponse\(response,MAX_PRODUCTION_RPC_RESPONSE_BYTES\) as T/);
  assert.doesNotMatch(route,/response\.json\(\)/);
  assert.match(route,/if\(!response\.ok\)/);
  assert.match(route,/if\(!await authorized\(\)\)/);
  assert.match(route,/secureJsonRequestError\(request,65_536\)/);
  assert.match(route,/readSecureJsonObject\(request,65_536\)/);
});

test("valid bounded PostgreSQL JSON streams decode with false Content-Length",async()=>{
  const encoder=new TextEncoder();
  const response=streamResponse([
    encoder.encode('{"quotes":['),
    encoder.encode('{"id":"123"}]}'),
  ],{"content-length":"1"});
  assert.deepEqual(await readBoundedJsonResponse(response,64),{quotes:[{id:"123"}]});
});

test("oversized chunked SQL response fails closed before JSON.parse",async()=>{
  const encoder=new TextEncoder();
  const response=streamResponse([
    encoder.encode('{"quotes":['),
    encoder.encode('"'.concat("a".repeat(128),'"]}')),
  ],{"content-length":"2"});
  await assert.rejects(readBoundedJsonResponse(response,64),/exceeds allowed size/);
});

test("malformed JSON and invalid UTF-8 are rejected rather than passed to operator",async()=>{
  await assert.rejects(readBoundedJsonResponse(
    streamResponse([new TextEncoder().encode('{"quotes":')]),64),SyntaxError);
  await assert.rejects(readBoundedJsonResponse(
    streamResponse([new Uint8Array([0x7b,0x22,0x78,0x22,0x3a,0xc3,0x28,0x7d])]),64));
});

test("missing stream and invalid limit fail closed",async()=>{
  await assert.rejects(readBoundedJsonResponse(new Response(null,{status:204}),64),/Invalid bounded JSON/);
  await assert.rejects(readBoundedJsonResponse(
    streamResponse([new TextEncoder().encode("{}")]),1),/Invalid bounded JSON/);
});

test("a malformed upstream response cannot be silently interpreted as an empty ledger",async()=>{
  const encoder=new TextEncoder();
  await assert.rejects(readBoundedJsonResponse(streamResponse([
    encoder.encode("not a JSON array"),
  ]),256),SyntaxError);
});
