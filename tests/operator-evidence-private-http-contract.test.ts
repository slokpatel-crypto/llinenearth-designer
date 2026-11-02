import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {requireOperatorCreatedId} from "../src/lib/designer/operator-created-id.ts";
import {readBoundedJsonResponse} from "../src/lib/designer/bounded-json-response.ts";

const routes=[
  "src/app/api/operator/production-evidence/route.ts",
  "src/app/api/operator/production-calibration/route.ts",
];
const sensitive="SYNTH_PRIVATE_SUPPLIER_SOURCE_OR_VAULT_TOKEN_DO_NOT_ECHO";

for(const path of routes){
  test(path+" redacts untrusted SQL and request parser failures in POST",()=>{
    const src=readFileSync(path,"utf8");
    assert.match(src,/function privateEvidenceJson\(/);
    assert.match(src,/response\.headers\.set\("cache-control","private, no-store"\)/);
    assert.equal((src.match(/NextResponse\.json\(/g)||[]).length,1,
      "every return uses the private/no-store response helper");
    assert.doesNotMatch(src,/response\.text\(\)/,"raw SQL/Gateway failures must never be read into errors");
    assert.doesNotMatch(src,/error instanceof Error\?error\.message/);
    assert.doesNotMatch(src,/console\.error\([^;\n]*,error\)/);
    assert.match(src,/if\(!response\.ok\) throw new Error\("Production evidence upstream unavailable\."\)/);
    assert.match(src,/MAX_INCOMING_EVIDENCE_BYTES=32_768/);
    assert.match(src,/MAX_UPSTREAM_EVIDENCE_BYTES=4_194_304/);
    assert.match(src,/readBoundedJsonResponse\(request,MAX_INCOMING_EVIDENCE_BYTES\)/);
    assert.match(src,/readBoundedJsonResponse\(response,MAX_UPSTREAM_EVIDENCE_BYTES\)/);
    assert.match(src,/if\(mime!=="application\/json"\)/);
    assert.match(src,/requireOperatorCreatedId\(evidenceId\)/);
    assert.match(src,/status:400/);
    assert.match(src,/status:503/);
    assert.match(src,/Valid production evidence JSON object required\./);
    assert.match(src,/Production evidence could not be recorded or verified\./);
  });

  test(path+" rejects impossible success acknowledgments without inventing a delivery or cutting record",()=>{
    const good="b287e470-0e90-4fd4-b5fb-976eecebd244";
    assert.equal(requireOperatorCreatedId(good),good);
    for(const input of [null,{},[],false,true,"false","not-a-uuid",
      {id:good},[good],sensitive]){
      assert.throws(()=>requireOperatorCreatedId(input),/Invalid production creation acknowledgement/);
    }
    const src=readFileSync(path,"utf8");
    const rpcIndex=src.indexOf('const evidenceId=await rpc<unknown>');
    const ackIndex=src.indexOf('requireOperatorCreatedId(evidenceId)');
    assert.ok(rpcIndex>0&&ackIndex>rpcIndex);
    if(path.includes("production-calibration"))
      assert.match(src,/verifyProductionCutLedger\\(rows,1000\\)/,
        "cut evidence must pass stronger row and duplicate-identity validation");
    else assert.match(src,/validateOperatorLedgerRows/);
  });
}

test("evidence request JSON bytes are bounded before parsing or reaching a privileged RPC",async()=>{
  const oversized=new Response(JSON.stringify({secret:sensitive,blob:"x".repeat(32_770)}));
  await assert.rejects(()=>readBoundedJsonResponse(oversized,32_768),/exceeds allowed size/);
  const malformed=new Response('{"secret":"'+sensitive+'",');
  await assert.rejects(()=>readBoundedJsonResponse(malformed,32_768),SyntaxError);
  assert.deepEqual(await readBoundedJsonResponse(
    new Response(JSON.stringify({action:"record"})),32_768),{action:"record"});
});
