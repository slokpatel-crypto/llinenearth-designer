import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {secureJsonRequestError,readSecureJsonObject,SecureJsonBodyTooLarge} from "../src/lib/secure-json-request.ts";

const endpoint="https://linenearth.example/api/operator/production-evidence";
function request(body:string,headers:Record<string,string>={}){
  return new Request(endpoint,{method:"POST",headers:{"content-type":"application/json",...headers},body});
}

test("production evidence write boundary rejects cross-site and oversized streamed bodies",async()=>{
  assert.equal(secureJsonRequestError(request("{}",{origin:"https://evil.example"}),16_384)?.status,403);
  assert.equal(secureJsonRequestError(request("{}",{"sec-fetch-site":"same-site"}),16_384)?.status,403);
  assert.equal(secureJsonRequestError(request("{}",{"content-type":"text/plain"}),16_384)?.status,415);
  const huge=request(JSON.stringify({note:"x".repeat(17_000)}));
  assert.equal(secureJsonRequestError(huge,16_384),null);
  await assert.rejects(()=>readSecureJsonObject(huge,16_384),SecureJsonBodyTooLarge);
  assert.deepEqual(await readSecureJsonObject(request('{"action":"record"}'),16_384),{action:"record"});
});

test("production evidence endpoint gates privileged RPC and never exposes backend diagnostics",()=>{
  const source=readFileSync("src/app/api/operator/production-evidence/route.ts","utf8");
  const post=source.slice(source.indexOf("export async function POST"));
  const originGate=post.indexOf("secureJsonRequestError(request,16_384)");
  const boundedBody=post.indexOf("readSecureJsonObject(request,16_384)");
  const firstRpc=post.indexOf('await rpc<string>');
  assert.ok(originGate>=0&&boundedBody>originGate&&firstRpc>boundedBody);
  assert.ok(post.includes("SecureJsonBodyTooLarge")&&post.includes("SecureJsonBodyInvalid"));
  assert.ok(post.includes('return NextResponse.json({error:"Production completion evidence could not be recorded."},{status:503})'));
  assert.ok(!post.includes('error:error instanceof Error?error.message:"Production completion evidence could not be recorded."'));
  assert.ok(source.includes("orders.length<500&&evidence.length<500"));
});

test("operator display cannot mark phase gate complete with incomplete ledger history",()=>{
  const source=readFileSync("src/app/operator/production-evidence/ProductionEvidenceClient.tsx","utf8");
  assert.ok(source.includes("setHistoryComplete(data.historyComplete===true)"));
  assert.ok(source.includes("summarizeProductionDeliveryEvidence(orders,evidence,10,historyComplete)"));
});
