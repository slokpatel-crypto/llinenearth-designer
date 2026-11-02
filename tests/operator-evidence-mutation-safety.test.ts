import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {operatorEvidenceMutationRequestError} from "../src/lib/designer/operator-evidence-mutation-safety.ts";

const request=(headers:Record<string,string>,url="https://shop.linenearth.example/api/operator/production-evidence")=>({
  url,headers:new Headers(headers),
});

test("production evidence mutation request accepts same-origin JSON before bounded payload read",()=>{
  assert.equal(operatorEvidenceMutationRequestError(request({
    origin:"https://shop.linenearth.example","content-type":"application/json",
    "content-length":"128",
  })),null);
  assert.equal(operatorEvidenceMutationRequestError(request({
    "content-type":"application/json; charset=utf-8",
  })),null);
});

test("same-origin browser Origin is accepted when Next is behind a localhost reverse proxy",()=>{
  assert.equal(operatorEvidenceMutationRequestError({
    url:"http://localhost:3100/api/operator/production-evidence",
    headers:new Headers({origin:"http://127.0.0.1:3100",
      host:"127.0.0.1:3100","content-type":"application/json"}),
  }),null);
  assert.equal(operatorEvidenceMutationRequestError({
    url:"http://localhost:3100/api/operator/production-calibration",
    headers:new Headers({origin:"https://shop.linenearth.example",
      host:"shop.linenearth.example","content-type":"application/json"}),
  }),null);
  const bad=operatorEvidenceMutationRequestError({
    url:"http://localhost:3100/api/operator/production-evidence",
    headers:new Headers({origin:"https://evil.example",
      host:"shop.linenearth.example","content-type":"application/json"}),
  });
  assert.equal(bad?.status,403);
});

test("cross-origin browser writes and spoofed origin values cannot reach privileged RPC",()=>{
  for(const origin of [
    "https://evil.example",
    "https://shop.linenearth.example.evil.example",
    "http://shop.linenearth.example",
    "null",
    "https://shop.linenearth.example:443.evil",
  ]){
    const result=operatorEvidenceMutationRequestError(request({
      origin,"content-type":"application/json",
    }));
    assert.deepEqual(result,{status:403,error:"Cross-site production evidence changes are not allowed."});
  }
});

test("Fetch Metadata blocks cross-site and same-site-subdomain writes even without Origin",()=>{
  for(const site of ["cross-site","same-site","invalid"]){
    const result=operatorEvidenceMutationRequestError(request({
      "sec-fetch-site":site,"content-type":"application/json",
    }));
    assert.equal(result?.status,403);
    const withMatchingOrigin=operatorEvidenceMutationRequestError(request({
      origin:"https://shop.linenearth.example",
      "sec-fetch-site":site,"content-type":"application/json",
    }));
    assert.equal(withMatchingOrigin?.status,403);
  }
  for(const site of ["same-origin","none"]){
    assert.equal(operatorEvidenceMutationRequestError(request({
      "sec-fetch-site":site,"content-type":"application/json",
    })),null);
  }
});

test("simple cross-site form body, missing JSON content-type, and advertised over-limit payloads are rejected",()=>{
  for(const type of ["text/plain","application/x-www-form-urlencoded","multipart/form-data","application/jsonp","", "application/json-notreally"]){
    assert.equal(operatorEvidenceMutationRequestError(request({"content-type":type}))?.status,415);
  }
  for(const len of ["32769","9999999","-1","invalid","3.5","9007199254740993"]){
    assert.equal(operatorEvidenceMutationRequestError(request({
      "content-type":"application/json","content-length":len,
    }))?.status,413);
  }
  assert.equal(operatorEvidenceMutationRequestError(request({
    "content-type":"application/json","content-length":"32768",
  })),null);
});

test("both private production evidence POST routes enforce request metadata before body and RPC",()=>{
  for(const path of [
    "src/app/api/operator/production-evidence/route.ts",
    "src/app/api/operator/production-calibration/route.ts",
  ]){
    const src=readFileSync(path,"utf8");
    const start=src.indexOf("export async function POST(request:Request)");
    const guard=src.indexOf("operatorEvidenceMutationRequestError(request)",start);
    const body=src.indexOf("readBoundedJsonResponse(request,MAX_INCOMING_EVIDENCE_BYTES)",start);
    const rpc=src.indexOf('const evidenceId=await rpc<unknown>',start);
    assert.ok(start>=0&&guard>start&&body>guard&&rpc>body);
    assert.match(src,/if\(unsafe\)return privateEvidenceJson\(\{error:unsafe\.error\},\{status:unsafe\.status\}\)/);
    assert.match(src,/cache-control","private, no-store"/);
  }
});
