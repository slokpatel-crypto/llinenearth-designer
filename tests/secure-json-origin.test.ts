import test from "node:test";
import assert from "node:assert/strict";
import {secureSameOriginRequestError,secureJsonRequestError}
  from "../src/lib/secure-json-request.ts";

function req(url:string,headers:Record<string,string>){
  return new Request(url,{headers});
}
test("M146 strict same-origin accepts one matching local host only",()=>{
  assert.equal(secureSameOriginRequestError(req("http://localhost:3000/api/operator/production",{
    origin:"http://localhost:3000","sec-fetch-site":"same-origin",
  })),null);
  assert.equal(secureJsonRequestError(req("http://localhost:3000/api/operator/production",{
    origin:"http://localhost:3000","sec-fetch-site":"same-origin",
    "content-type":"application/json",
  }),65536),null);
});
test("M146 mismatched local host is not a CSRF exception",()=>{
  const request=req("http://localhost:3000/api/operator/production",{
    origin:"http://127.0.0.1:3000","sec-fetch-site":"same-origin",
    "content-type":"application/json",
  });
  assert.deepEqual(secureSameOriginRequestError(request),
    {status:403,error:"Cross-site changes are not allowed."});
  assert.deepEqual(secureJsonRequestError(request,65536),
    {status:403,error:"Cross-site changes are not allowed."});
  // Canonicalize only the CI browser URL; never weaken server-side rejection
  // to equate distinct origins, ports or protocols.
  for(const origin of ["https://localhost:3000","http://localhost:3001",
    "https://cross-site-attacker.invalid","null"]){
    assert.deepEqual(secureSameOriginRequestError(req("http://localhost:3000/api/operator/production",{
      origin,"sec-fetch-site":"same-origin",
    })),{status:403,error:"Cross-site changes are not allowed."});
  }
});
test("M146 hostile Fetch Metadata rejects despite a matching Origin",()=>{
  for(const site of ["cross-site","same-site","unknown"]){
    assert.deepEqual(secureSameOriginRequestError(req("http://localhost:3000/api/operator/production",{
      origin:"http://localhost:3000","sec-fetch-site":site,
    })),{status:403,error:"Cross-site changes are not allowed."});
  }
  assert.equal(secureSameOriginRequestError(req("http://localhost:3000/api/operator/production",{
    origin:"http://localhost:3000","sec-fetch-site":"none",
  })),null);
});
test("M146 JSON endpoint checks cross-site metadata before request bytes",()=>{
  assert.deepEqual(secureJsonRequestError(req("http://localhost:3000/api/operator/production",{
    origin:"https://cross-site-attacker.invalid",
    "content-type":"text/plain",
  }),65536),{status:403,error:"Cross-site changes are not allowed."});
  assert.deepEqual(secureJsonRequestError(req("http://localhost:3000/api/operator/production",{
    origin:"http://localhost:3000","content-type":"text/plain",
  }),65536),{status:415,error:"This operation requires JSON."});
  assert.deepEqual(secureJsonRequestError(req("http://localhost:3000/api/operator/production",{
    origin:"http://localhost:3000","content-type":"application/json",
    "content-length":"65537",
  }),65536),{status:413,error:"Request payload is too large."});
});
