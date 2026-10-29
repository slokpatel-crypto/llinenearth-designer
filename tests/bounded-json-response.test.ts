import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedJsonResponse } from "../src/lib/designer/bounded-json-response.ts";

test("bounded upstream JSON preserves valid Unicode, exact lengths and structured numbers",async()=>{
  const payload=JSON.stringify({name:"कपास 👕",length:145,availability:"unavailable"});
  const bytes=new TextEncoder().encode(payload);
  const stream=new ReadableStream<Uint8Array>({
    start(controller) {
      for(let i=0;i<bytes.length;i+=3)
        controller.enqueue(bytes.slice(i,i+3));
      controller.close();
    },
  });
  const response=new Response(stream);
  assert.deepEqual(await readBoundedJsonResponse(response,bytes.length),JSON.parse(payload));
  assert.deepEqual(await readBoundedJsonResponse(new Response("[]"),2),[]);
});

test("bounded upstream JSON rejects oversized, missing, invalid or malformed responses",async()=>{
  await assert.rejects(readBoundedJsonResponse(new Response("[1,2,3]"),6),/exceeds/);
  await assert.rejects(readBoundedJsonResponse(new Response("[1,2,3]"),1),/Invalid/);
  await assert.rejects(readBoundedJsonResponse(new Response(null),100),/Invalid/);
  await assert.rejects(readBoundedJsonResponse(new Response("invalid"),100),SyntaxError);
  await assert.rejects(readBoundedJsonResponse(new Response(Uint8Array.of(0xff)),100),TypeError);
});

test("bounded response source is wired to both physical stock and operator override readers",async()=>{
  const {readFileSync}=await import("node:fs");
  const loader=readFileSync(new URL("../src/lib/designer-fabric-metadata.ts",import.meta.url),"utf8");
  const stock=readFileSync(new URL("../src/lib/designer/stock-availability-server.ts",import.meta.url),"utf8");
  assert.match(loader,/readBoundedJsonResponse\(response,4 \* 1024 \* 1024\)/);
  assert.match(stock,/readBoundedJsonResponse\(response,1024 \* 1024\)/);
  assert.doesNotMatch(loader,/response\.json\(\)/);
  assert.doesNotMatch(stock,/response\.json\(\)/);
});
