import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {
  readSecureJsonObject,secureJsonRequestError,SecureJsonBodyTooLarge,SecureJsonBodyInvalid,
} from "../src/lib/secure-json-request.ts";

const url="https://linenearth.example/api/designer/vault";
function request(body:string,extra:Record<string,string>={}):Request{
  return new Request(url,{method:"POST",headers:{"content-type":"application/json",...extra},body});
}

test("selective branch reconciliation retains origin and strict JSON rejection",()=>{
  assert.equal(secureJsonRequestError(request('{"action":"load"}',{origin:"https://evil.example"}),16_384)?.status,403);
  assert.equal(secureJsonRequestError(request('{"action":"load"}',{"sec-fetch-site":"cross-site"}),16_384)?.status,403);
  assert.equal(secureJsonRequestError(request('{"action":"load"}',{"content-type":"text/plain"}),16_384)?.status,415);
  assert.equal(secureJsonRequestError(request('{"action":"load"}',{"content-length":"20000"}),16_384)?.status,413);
  assert.equal(secureJsonRequestError(request('{"action":"load"}',{origin:"https://linenearth.example"}),16_384),null);
});

test("bounded streamed JSON rejects oversize, malformed and array bodies",async()=>{
  await assert.rejects(readSecureJsonObject(request(JSON.stringify({payload:"x".repeat(2048)})),1024),SecureJsonBodyTooLarge);
  await assert.rejects(readSecureJsonObject(request("{no"),1024),SecureJsonBodyInvalid);
  await assert.rejects(readSecureJsonObject(request("[]"),1024),SecureJsonBodyInvalid);
  assert.deepEqual(await readSecureJsonObject(request('{"action":"listOwned"}'),1024),{action:"listOwned"});
});

test("both vaults and operator mutations enforce secure JSON before privileged RPC",()=>{
  for(const path of [
    "src/app/api/designer/vault/route.ts",
    "src/app/api/measurements/vault/route.ts",
    "src/app/api/operator/production/route.ts",
    "src/app/api/operator/production-evidence/route.ts",
  ]){
    const s=readFileSync(path,"utf8");
    assert.match(s,/secureJsonRequestError\(request,\d+\)/,path);
    assert.match(s,/readSecureJsonObject\(request,\d+\)/,path);
    assert.match(s,/SecureJsonBodyTooLarge/,path);
    assert.match(s,/SecureJsonBodyInvalid/,path);
    assert.doesNotMatch(s,/await request\.json\(/,path);
    assert.ok(s.indexOf("secureJsonRequestError(request,")<s.indexOf("readSecureJsonObject(request,"),path);
  }
});

test("selected current delivery audit schema contains order/audit immutable lineage",()=>{
  const sql=readFileSync("supabase/migrations/20261103_production_first_ten_delivery_audit.sql","utf8");
  const source=readFileSync("src/lib/designer/production-delivery-evidence.ts","utf8");
  const cloud=readFileSync("scripts/check-cloud-readiness.mjs","utf8");
  for(const literal of ["'revision_id',e.revision_id","'recipe_hash',e.recipe_hash","'order_created_at',o.created_at"]){
    assert.ok(sql.includes(literal),literal);
  }
  assert.match(source,/evidence\.revision_id!==lineage\.revision/);
  assert.match(source,/evidence\.recipe_hash!==lineage\.hash/);
  assert.match(source,/evidenceIds\.has\(evidenceId\)/);
  assert.match(cloud,/row\.revision_id===lineage\.revisionId/);
  assert.match(cloud,/row\.recipe_hash===lineage\.recipeHash/);
});
