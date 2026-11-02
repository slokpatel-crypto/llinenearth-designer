import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {secureJsonRequestError} from "../src/lib/secure-json-request.ts";

const url="https://linenearth.example/api/operator/production-calibration";
const check=(headers:Record<string,string>)=>secureJsonRequestError({
  url,
  headers:new Headers(headers),
},32_768);

test("physical-cut evidence accepts bounded same-origin JSON and optional UTF-8 charset",()=>{
  assert.equal(check({"origin":"https://linenearth.example","sec-fetch-site":"same-origin",
    "content-type":"application/json","content-length":"32768"}),null);
  assert.equal(check({"sec-fetch-site":"none","content-type":"application/json; charset=utf-8"}),null);
});

test("physical-cut evidence rejects cross-site and same-site-subdomain mutation attempts",()=>{
  for(const headers of [
    {"origin":"https://attacker.example","content-type":"application/json"},
    {"origin":"https://linenearth.example.evil.test","content-type":"application/json"},
    {"origin":"null","content-type":"application/json"},
    {"sec-fetch-site":"cross-site","content-type":"application/json"},
    {"sec-fetch-site":"same-site","content-type":"application/json"},
    {"origin":"https://linenearth.example","sec-fetch-site":"cross-site","content-type":"application/json"},
  ]) assert.deepEqual(check(headers),{status:403,error:"Cross-site changes are not allowed."});
});

test("physical-cut evidence refuses simple form bodies, missing JSON and declared oversized input",()=>{
  for(const headers of [
    {},{"content-type":"text/plain"},{"content-type":"application/x-www-form-urlencoded"},
    {"content-type":"multipart/form-data; boundary=test"},{"content-type":"application/json-patch+json"},
  ]) assert.deepEqual(check(headers),{status:415,error:"This operation requires JSON."});
  for(const length of ["32769","-1","1.2","NaN","9007199254740993"])
    assert.deepEqual(check({"content-type":"application/json","content-length":length}),
      {status:413,error:"Request payload is too large."});
});

test("calibration POST checks same-origin JSON before any privileged evidence RPC",()=>{
  const route=readFileSync("src/app/api/operator/production-calibration/route.ts","utf8");
  const post=route.indexOf("export async function POST(request:Request)");
  const auth=route.indexOf("if(!await authorized())",post);
  const checkAt=route.indexOf("secureJsonRequestError(request,MAX_INCOMING_EVIDENCE_BYTES)",post);
  const errorAt=route.indexOf("if(unsafe) return privateEvidenceJson",post);
  const parseAt=route.indexOf("readBoundedJsonResponse(request,MAX_INCOMING_EVIDENCE_BYTES)",post);
  const rpcAt=route.indexOf('rpc<unknown>("production_cut_evidence_record"',post);
  assert.ok(post>=0&&auth>post&&checkAt>auth&&errorAt>checkAt&&parseAt>errorAt&&rpcAt>parseAt);
  assert.match(route,/if\(unsafe\) return privateEvidenceJson\(\{error:unsafe\.error\},\{status:unsafe\.status\}\)/);
  assert.match(route,/response\.headers\.set\("cache-control","private, no-store"\)/);
});
