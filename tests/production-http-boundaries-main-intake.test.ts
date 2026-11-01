import test from "node:test";
import assert from "node:assert/strict";
import {
  secureSameOriginRequestError,secureJsonRequestError,
  readSecureJsonObject,SecureJsonBodyInvalid,SecureJsonBodyTooLarge,
} from "../src/lib/secure-json-request.ts";
import {readBoundedJsonResponse} from "../src/lib/designer/bounded-json-response.ts";
import {safeOperatorProductionErrorCode} from "../src/lib/designer/operator-production-error.ts";

const endpoint="http://localhost:3000/api/operator/production";
function headers(origin="http://localhost:3000",site="same-origin"){
  return {"content-type":"application/json",origin,"sec-fetch-site":site};
}
function request(bytes:string,extra:Record<string,string>={}){
  return new Request(endpoint,{
    method:"POST",headers:{...headers(),...extra},body:bytes,
  });
}
test("main intake: never accept a different scheme/port/host or hostile browser fetch metadata",()=>{
  assert.equal(secureSameOriginRequestError(request("{}")),null);
  for(const origin of [
    "http://127.0.0.1:3000","https://localhost:3000",
    "http://localhost:3001","https://attacker.invalid","null",
  ])assert.deepEqual(secureSameOriginRequestError(request("{}",{origin})),
    {status:403,error:"Cross-site changes are not allowed."});
  for(const site of ["cross-site","same-site","unknown"]){
    assert.deepEqual(secureSameOriginRequestError(request("{}",{"sec-fetch-site":site})),
      {status:403,error:"Cross-site changes are not allowed."});
  }
  assert.equal(secureSameOriginRequestError(request("{}",{"sec-fetch-site":"none"})),null);
});
test("main intake: content-type and pre-read Content-Length cannot bypass the byte cap",()=>{
  assert.equal(secureJsonRequestError(request("{}"),128),null);
  assert.deepEqual(secureJsonRequestError(request("{}",{"content-type":"text/plain"}),128),
    {status:415,error:"This operation requires JSON."});
  assert.deepEqual(secureJsonRequestError(request("{}",{"content-length":"129"}),128),
    {status:413,error:"Request payload is too large."});
  assert.deepEqual(secureJsonRequestError(request("{}",{"content-length":"foo"}),128),
    {status:413,error:"Request payload is too large."});
  assert.deepEqual(secureJsonRequestError(request("{}",{
    "origin":"https://attacker.invalid","content-type":"text/plain",
  }),128),{status:403,error:"Cross-site changes are not allowed."});
  assert.throws(()=>secureJsonRequestError(request("{}"),0),/Invalid JSON request byte limit/);
});
test("main intake: streaming body checks actual decoded bytes, not a misleading header",async()=>{
  assert.deepEqual(await readSecureJsonObject(request('{"safe":true}'),1024),{safe:true});
  await assert.rejects(readSecureJsonObject(request('{"a":"12345"}'),4),SecureJsonBodyTooLarge);
  for(const text of ["[1,2]","null","false","12","\"word\"","{broken"]){
    await assert.rejects(readSecureJsonObject(request(text),128),SecureJsonBodyInvalid);
  }
  await assert.rejects(readSecureJsonObject(request(""),128),SecureJsonBodyInvalid);
  assert.deepEqual(await readSecureJsonObject(request('{"key":"é"}'),128),{key:"é"});
  await assert.rejects(readSecureJsonObject(request("{}"),0),/Invalid JSON request byte limit/);
});
test("main intake: bounded upstream response handles chunked JSON and rejects overflow",async()=>{
  const okay=new Response(new ReadableStream({
    start(controller){controller.enqueue(new TextEncoder().encode('{"id":'));
      controller.enqueue(new TextEncoder().encode('"safe"}'));controller.close();}
  }));
  assert.deepEqual(await readBoundedJsonResponse(okay,64),{id:"safe"});
  await assert.rejects(readBoundedJsonResponse(new Response('{"long":"private-secret"}'),7),
    /exceeds allowed size/);
  await assert.rejects(readBoundedJsonResponse(new Response("{broken"),64),SyntaxError);
  await assert.rejects(readBoundedJsonResponse(new Response("{}"),1),
    /Invalid bounded JSON response/);
  await assert.rejects(readBoundedJsonResponse(new Response(null),32),
    /Invalid bounded JSON response/);
});
test("main intake: error logging accepts only fixed non-private categories",()=>{
  const leaked="DO-NOT-LEAK-SUPPLIER-CUSTOMER-TOKEN-123";
  const cases:[unknown,string][]=[
    [null,"unknown_error"],[leaked,"unknown_error"],
    [Object.assign(new Error(leaked),{name:"AbortError"}),"backend_timeout"],
    [Object.assign(new Error(leaked),{name:"TimeoutError"}),"backend_timeout"],
    [Object.assign(new Error(leaked),{name:"SyntaxError"}),"malformed_response"],
    [Object.assign(new Error(leaked),{name:"TypeError"}),"backend_transport"],
    [new Error(leaked),"production_integrity_failure"],
  ];
  for(const [value,expected] of cases){
    const category=safeOperatorProductionErrorCode(value);
    assert.equal(category,expected);
    assert.doesNotMatch(category,/DO-NOT-LEAK|SUPPLIER|CUSTOMER|TOKEN/);
  }
});
