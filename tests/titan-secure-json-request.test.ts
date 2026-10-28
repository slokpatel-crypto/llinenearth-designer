import test from "node:test";
import assert from "node:assert/strict";
import {secureJsonRequestError,readSecureJsonObject,SecureJsonBodyInvalid,SecureJsonBodyTooLarge} from "../src/lib/secure-json-request.ts";

const URL="https://linenearth.example/api/operator/production";
function request(body:string,headers:Record<string,string>={}){
  return new Request(URL,{method:"POST",headers:{"content-type":"application/json",...headers},body});
}
test("allows same-origin JSON and trusted non-browser requests",()=>{
  assert.equal(secureJsonRequestError(request("{}",{origin:"https://linenearth.example","sec-fetch-site":"same-origin"}),100),null);
  assert.equal(secureJsonRequestError(request("{}",{"sec-fetch-site":"none"}),100),null);
  assert.equal(secureJsonRequestError(request("{}",{"content-type":"application/json; charset=UTF-8"}),100),null);
});
test("rejects cross-site and same-site subdomain browser mutations",()=>{
  for(const h of [{origin:"https://attacker.example"},{origin:"null"},{"sec-fetch-site":"cross-site"},{"sec-fetch-site":"same-site"},{"sec-fetch-site":"invalid"}])
    assert.equal(secureJsonRequestError(request("{}",h),100)?.status,403);
});
test("rejects unsafe media types and malformed or oversized length",()=>{
  for(const ct of ["text/plain","application/x-www-form-urlencoded","application/jsonx","application/json; charset=iso-8859-1",""])
    assert.equal(secureJsonRequestError(request("{}",{"content-type":ct}),100)?.status,415);
  for(const len of ["101","not-a-number","-1","1.5","9007199254740993"])
    assert.equal(secureJsonRequestError(request("{}",{"content-length":len}),100)?.status,413);
});
test("bounds real streamed bytes even when Content-Length is missing",async()=>{
  const oversized=request(JSON.stringify({note:"₹".repeat(60)}));
  assert.equal(oversized.headers.get("content-length"),null);
  assert.equal(secureJsonRequestError(oversized,100),null);
  await assert.rejects(()=>readSecureJsonObject(oversized,100),SecureJsonBodyTooLarge);
});
test("accepts bounded JSON object, including Unicode",async()=>{
  assert.deepEqual(await readSecureJsonObject(request('{"note":"₹"}'),128),{note:"₹"});
});
test("rejects invalid JSON, arrays, null and empty request",async()=>{
  for(const body of ["[1]","null","{bad","",'"text"'])
    await assert.rejects(()=>readSecureJsonObject(request(body),128),SecureJsonBodyInvalid);
});
test("rejects malformed UTF-8 bytes",async()=>{
  const r=new Request(URL,{method:"POST",headers:{"content-type":"application/json"},body:new Uint8Array([123,34,120,34,58,34,255,34,125])});
  await assert.rejects(()=>readSecureJsonObject(r,128),SecureJsonBodyInvalid);
});
test("invalid byte limits fail closed",async()=>{
  assert.throws(()=>secureJsonRequestError(request("{}"),0));
  await assert.rejects(()=>readSecureJsonObject(request("{}"),NaN));
});
