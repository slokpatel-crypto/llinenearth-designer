import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readBoundedJsonResponse} from "../src/lib/designer/bounded-json-response.ts";

const src=()=>readFileSync("src/app/api/designer/vault/route.ts","utf8");

test("vault ingress bounds decoded JSON and rejects scalar/null request roots",()=>{
  const source=src();
  assert.match(source,/const MAX_VAULT_REQUEST_BYTES=1_048_576/);
  assert.match(source,/readBoundedJsonResponse\(new Response\(request\.body\),MAX_VAULT_REQUEST_BYTES\)/);
  assert.match(source,/typeof rawBody!=="object"\|\|Array\.isArray\(rawBody\)/);
  assert.doesNotMatch(source,/await request\.json\(\)/);

  const request=new Request("https://example.test/api/designer/vault",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({action:"load",recoveryToken:"synthetic"}),
  });
  assert.deepEqual(await readBoundedJsonResponse(new Response(request.body),1_048_576),
    {action:"load",recoveryToken:"synthetic"});
  const oversized=new Request("https://example.test/api/designer/vault",{
    method:"POST",body:JSON.stringify({action:"load",recoveryToken:"x".repeat(1_048_576)}),
  });
  await assert.rejects(readBoundedJsonResponse(new Response(oversized.body),1_048_576),
    /exceeds allowed size/);
  await assert.rejects(readBoundedJsonResponse(new Response("{bad"),1_048_576),SyntaxError);
});

test("vault RPC bounds successful JSON and never copies upstream errors into logs",()=>{
  const source=src();
  const rpc=source.split("async function rpc<T>(")[1]?.split("export async function POST(")[0]??"";
  assert.match(source,/const MAX_VAULT_RESPONSE_BYTES=8_388_608/);
  assert.match(rpc,/mime!=="application\/json"/);
  assert.match(rpc,/readBoundedJsonResponse\(response,MAX_VAULT_RESPONSE_BYTES\)/);
  assert.doesNotMatch(rpc,/response\.text\(\)/);
  assert.doesNotMatch(rpc,/return await response\.json\(\)/);
  assert.match(source,/request failed \(details redacted\)/);
  assert.doesNotMatch(source,/console\.error\("\[designer\/vault\]",error\)/);
  assert.doesNotMatch(source,/console\.error\("\[designer\/vault\]",\s*error\)/);
  const catchBlock=source.split("  }catch{").at(-1)??"";
  assert.match(catchBlock,/Secure design storage is temporarily unavailable/);
  assert.doesNotMatch(catchBlock,/error\.message|error\)/);
});

test("decoded-byte bound protects vault JSON from a large synthetic upstream body",async()=>{
  const response=new Response(JSON.stringify([{payload:{private:"x".repeat(2_000)}}]),{
    status:200,headers:{"content-type":"application/json"},
  });
  await assert.rejects(readBoundedJsonResponse(response,1024),/exceeds allowed size/);
});
