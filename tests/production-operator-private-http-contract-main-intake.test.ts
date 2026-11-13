import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("signed built Next operator HTTP gate is required before slow GLB browser tests",()=>{
  const script=readFileSync("scripts/verify-operator-production-private-http.cjs","utf8");
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  const source=readFileSync("src/app/api/operator/production/route.ts","utf8");
  assert.ok(workflow.includes("node scripts/verify-operator-production-private-http.cjs"));
  assert.ok(workflow.indexOf("node scripts/verify-operator-production-private-http.cjs")
    <workflow.indexOf("node scripts/verify-garment-viewer.cjs"),
    "Reject unsafe production HTTP before starting costly WebGL verification");
  for(const token of [
    'process.env.CI!=="true"||process.env.GITHUB_ACTIONS!=="true"',
    'const safe=JSON.stringify({action:"__ci_unsupported_action_no_rpc__"});',
    "valid signed operator request with unsupported action",
    "foreign origin rejected before action",
    "cross-site fetch metadata veto even with matching origin",
    "loopback hostname mismatch rejects alternate origin",
    "non-JSON POST refused",
    "actual body size over 65,536 bytes refused",
    "broken JSON fails before any backend call",
    "non-object JSON fails before any backend call",
    "unsigned test client refused before action",
    "production RPC writes: 0",
    "TITAN signed built-Next operator private POST CSRF/size/JSON HTTP PASS.",
  ])assert.ok(script.includes(token),"Missing actual signed HTTP security case "+token);
  assert.ok(source.includes("secureJsonRequestError(request,65_536)"));
  assert.ok(source.includes("readSecureJsonObject(request,65_536)"));
  assert.doesNotMatch(script,/"create_quote"|"create_order"|"quote_status"|"order_status"/,
    "CI test must not issue a legitimate mutating production instruction");
});


test("all operator production POST return paths set private no-store consistently",()=>{
  const source=readFileSync("src/app/api/operator/production/route.ts","utf8");
  assert.ok(source.includes("function privateProductionResponse(body:unknown,init?:ResponseInit)"));
  assert.ok(source.includes('response.headers.set("cache-control","private, no-store")'));
  const post=source.split("export async function POST(request:Request){")[1]??"";
  assert.ok(post.includes('return privateProductionResponse({error:"Unsupported production action."},{status:400})'));
  assert.ok(post.includes('return privateProductionResponse({quoteId,lockedRevisionVerified:true})'));
  assert.ok(post.includes('return privateProductionResponse({orderId,learningContextAttached:true,lockedRevisionVerified:true})'));
  assert.doesNotMatch(post,/return NextResponse\.json\(/,
    "All POST errors and successes must get uniform privacy response headers");
});
