import test from "node:test";
import assert from "node:assert/strict";
import {
  readSecureJsonObject,
  secureJsonRequestError,
  secureSameOriginRequestError,
  SecureJsonBodyInvalid,
  SecureJsonBodyTooLarge,
} from "../src/lib/secure-json-request.ts";

const url="https://linen.example/api/designer/vault";
function request(headers:Record<string,string>,body="{}"){
  return new Request(url,{method:"POST",headers,body});
}

test("private customer and designer writes reject foreign and same-site origins",()=>{
  const base={"content-type":"application/json"};
  for(const headers of [
    {...base,origin:"https://attacker.example"},
    {...base,origin:"null"},
    {...base,origin:"https://other.linen.example"},
    {...base,"sec-fetch-site":"cross-site"},
    {...base,"sec-fetch-site":"same-site"},
    {...base,origin:"https://linen.example","sec-fetch-site":"same-site"},
  ]){
    assert.equal(secureSameOriginRequestError(request(headers))?.status,403);
    assert.equal(secureJsonRequestError(request(headers),1024)?.status,403);
  }
  assert.equal(secureSameOriginRequestError(request({...base,origin:"https://linen.example","sec-fetch-site":"same-origin"})),null);
  assert.equal(secureSameOriginRequestError(request({...base,"sec-fetch-site":"none"})),null);
});

test("customer bearer writes fail early on incorrect type and declared size",()=>{
  assert.equal(secureJsonRequestError(request({"content-type":"text/plain"}),4096)?.status,415);
  assert.equal(secureJsonRequestError(request({"content-type":"application/json","content-length":"4097"}),4096)?.status,413);
  assert.equal(secureJsonRequestError(request({"content-type":"application/json","content-length":"wat"}),4096)?.status,413);
  assert.equal(secureJsonRequestError(request({"content-type":"application/json; charset=UTF-8"}),4096),null);
});

test("actual streamed content size and malformed JSON are rejected",async()=>{
  await assert.rejects(readSecureJsonObject(request({"content-type":"application/json"},'{"x":"'+ "A".repeat(100)+'"}'),64),SecureJsonBodyTooLarge);
  await assert.rejects(readSecureJsonObject(request({"content-type":"application/json"},"[1]"),64),SecureJsonBodyInvalid);
  await assert.rejects(readSecureJsonObject(request({"content-type":"application/json"},"{bad"),64),SecureJsonBodyInvalid);
  assert.deepEqual(await readSecureJsonObject(request({"content-type":"application/json"},'{"action":"listOwned"}'),64),{action:"listOwned"});
});
