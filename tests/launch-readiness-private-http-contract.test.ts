import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {requireOperatorCreatedId} from "../src/lib/designer/operator-created-id.ts";
import {validateOperatorLedgerRows} from "../src/lib/designer/operator-optional-rpc.ts";
import {readBoundedJsonResponse} from "../src/lib/designer/bounded-json-response.ts";
import {
  secureJsonRequestError,readSecureJsonObject,SecureJsonBodyTooLarge,SecureJsonBodyInvalid,
} from "../src/lib/secure-json-request.ts";

const path="src/app/api/operator/launch-readiness/route.ts";
const source=readFileSync(path,"utf8");
const endpoint="https://linen.example/api/operator/launch-readiness";
function request(body:string,headers:Record<string,string>={}){
  return new Request(endpoint,{method:"POST",headers:{
    "content-type":"application/json",origin:"https://linen.example",
    "sec-fetch-site":"same-origin",...headers,
  },body});
}

test("launch evidence: authenticated reads and writes are private, bounded and redacted",()=>{
  assert.match(source,/function privateLaunchJson\(/);
  assert.equal((source.match(/NextResponse\.json\(/g)||[]).length,1);
  assert.match(source,/response\.headers\.set\("cache-control","private, no-store"\)/);
  assert.match(source,/response\.headers\.set\("pragma","no-cache"\)/);
  assert.match(source,/MAX_INCOMING_BYTES=32_768/);
  assert.match(source,/MAX_UPSTREAM_BYTES=4_194_304/);
  assert.match(source,/secureJsonRequestError\(request,MAX_INCOMING_BYTES\)/);
  assert.match(source,/readSecureJsonObject\(request,MAX_INCOMING_BYTES\)/);
  assert.match(source,/readBoundedJsonResponse\(response,MAX_UPSTREAM_BYTES\)/);
  assert.match(source,/validateOperatorLedgerRows\(betaAttempts,500\)/);
  assert.match(source,/validateOperatorLedgerRows\(checklistEvents,500\)/);
  assert.match(source,/requireOperatorCreatedId\(await rpc\(name,payload\)\)/);
  assert.doesNotMatch(source,/response\.text\(\)/);
  assert.doesNotMatch(source,/error instanceof Error\?error\.message/);
  assert.doesNotMatch(source,/console\.error\([^;\n]*,error\)/);
  assert.match(source,/status:503/);
  assert.match(source,/status:400/);
  assert.match(source,/status:413/);
});

test("launch evidence: cross-site, non-JSON, forged length and malformed bodies fail before RPC",async()=>{
  assert.deepEqual(secureJsonRequestError(request("{}",{origin:"https://attacker.example"}),32_768),
    {status:403,error:"Cross-site changes are not allowed."});
  assert.deepEqual(secureJsonRequestError(request("{}",{"content-type":"text/plain"}),32_768),
    {status:415,error:"This operation requires JSON."});
  assert.deepEqual(secureJsonRequestError(request("{}",{"content-length":"32769"}),32_768),
    {status:413,error:"Request payload is too large."});
  await assert.rejects(readSecureJsonObject(request('{"x":"'+ "x".repeat(32_770)+'"}'),32_768),
    SecureJsonBodyTooLarge);
  for(const invalid of ["{broken","null","[]","false"]){
    await assert.rejects(readSecureJsonObject(request(invalid),32_768),SecureJsonBodyInvalid);
  }
  assert.deepEqual(await readSecureJsonObject(request('{"action":"checklist"}'),32_768),
    {action:"checklist"});
});

test("launch evidence: malformed upstream list and creation ACK cannot certify acceptance",async()=>{
  const good="b287e470-0e90-4fd4-b5fb-976eecebd244";
  assert.equal(requireOperatorCreatedId(good),good);
  for(const value of [null,{},[],true,false,"true",good+" ",[good]]){
    assert.throws(()=>requireOperatorCreatedId(value),/Invalid production creation acknowledgement/);
  }
  assert.deepEqual(validateOperatorLedgerRows([{case_id:"BETA-1"}],500),[{case_id:"BETA-1"}]);
  for(const value of [null,{},true,[null],[[]],Array.from({length:501},()=>({}))]){
    assert.throws(()=>validateOperatorLedgerRows(value,500),/Invalid operator production ledger response/);
  }
  await assert.rejects(readBoundedJsonResponse(new Response('{"private":"'+ "x".repeat(512)+'"}'),64),
    /exceeds allowed size/);
  await assert.rejects(readBoundedJsonResponse(new Response("{bad"),64),SyntaxError);
});
