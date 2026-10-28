import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {secureJsonRequestError,readSecureJsonObject,SecureJsonBodyInvalid,SecureJsonBodyTooLarge} from "../src/lib/secure-json-request.ts";

const REQUEST_URL="https://linenearth.example/api/designer/search";
const request=(body:string,headers:Record<string,string>={})=>new Request(REQUEST_URL,{
  method:"POST",headers:{"content-type":"application/json",...headers},body,
});

test("Designer JSON transport allows same-origin UTF-8 JSON objects",async()=>{
  const req=request('{"message":"₹ linen"}',{origin:"https://linenearth.example","sec-fetch-site":"same-origin"});
  assert.equal(secureJsonRequestError(req,200),null);
  assert.deepEqual(await readSecureJsonObject(req,200),{message:"₹ linen"});
});

test("Designer JSON transport rejects cross-origin and same-site browser writes",()=>{
  for(const headers of [
    {origin:"https://elsewhere.example"},
    {origin:"null"},
    {"sec-fetch-site":"cross-site"},
    {"sec-fetch-site":"same-site"},
  ]) assert.equal(secureJsonRequestError(request("{}",headers),200)?.status,403);
});

test("Designer JSON transport rejects unsupported media, malformed length and oversize declarations",()=>{
  for(const type of ["text/plain","application/jsonx","application/json; charset=iso-8859-1",""])
    assert.equal(secureJsonRequestError(request("{}",{"content-type":type}),200)?.status,415);
  for(const size of ["201","1000000000000000000000","-1","1.5","x"])
    assert.equal(secureJsonRequestError(request("{}",{"content-length":size}),200)?.status,413);
});

test("Designer JSON transport enforces the real stream limit without Content-Length",async()=>{
  const body=request('{"text":"'+"₹".repeat(80)+'"}');
  assert.equal(body.headers.get("content-length"),null);
  assert.equal(secureJsonRequestError(body,100),null);
  await assert.rejects(()=>readSecureJsonObject(body,100),SecureJsonBodyTooLarge);
});

test("Designer JSON transport rejects malformed UTF-8, non-object JSON and invalid JSON",async()=>{
  for(const invalid of ["","null","[]","12",'"text"','{"incomplete":']) {
    await assert.rejects(()=>readSecureJsonObject(request(invalid),300),SecureJsonBodyInvalid);
  }
  const broken=new Request(REQUEST_URL,{method:"POST",headers:{"content-type":"application/json"},body:new Uint8Array([123,34,97,34,58,34,255,34,125])});
  await assert.rejects(()=>readSecureJsonObject(broken,300),SecureJsonBodyInvalid);
});

test("three Designer API POST paths use bounded streamed JSON before doing work",()=>{
  for(const [route,limit] of [["assess","180_000"],["search","80_000"],["brief","90_000"]] as const){
    const src=readFileSync(new URL(`../src/app/api/designer/${route}/route.ts`,import.meta.url),"utf8");
    assert.ok(src.includes(`secureJsonRequestError(request,${limit})`),`${route} preflight missing`);
    assert.ok(src.includes(`readSecureJsonObject(request,${limit})`),`${route} streamed reader missing`);
    assert.ok(src.includes("error instanceof SecureJsonBodyTooLarge"),`${route} size error mapping missing`);
    assert.ok(src.includes("error instanceof SecureJsonBodyInvalid"),`${route} JSON error mapping missing`);
    assert.ok(!src.includes("await request.json()"),`${route} may bypass stream limit`);
  }
});
