import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  secureSameOriginRequestError,secureJsonRequestError,
  readSecureJsonObject,SecureJsonBodyTooLarge,SecureJsonBodyInvalid,
} from "../src/lib/secure-json-request.ts";
import {safeOperatorProductionErrorCode}
  from "../src/lib/designer/operator-production-error.ts";

const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
const endpoint="http://localhost:3000/api/operator/production";
function request(body:string,overrides:Record<string,string>={}):Request{
  return new Request(endpoint,{
    method:"POST",headers:{"content-type":"application/json",
      origin:"http://localhost:3000","sec-fetch-site":"same-origin",...overrides},
    body,
  });
}
test("main production endpoint guards exact origin and bytes before any SQL mutation",()=>{
  const post=route.split("export async function POST(request:Request){")[1];
  assert.ok(post);
  const guard=post.indexOf("secureJsonRequestError(request,65_536)");
  const parse=post.indexOf("readSecureJsonObject(request,65_536)");
  const create=post.indexOf('if(action==="create_quote")');
  const order=post.indexOf('if(action==="create_order")');
  assert.ok(guard>=0&&parse>guard&&create>parse&&order>parse,
    "Authenticated POST must reject cross-site/body spoofing before reading or mutating");
  assert.match(route,/import \{secureJsonRequestError,readSecureJsonObject,SecureJsonBodyTooLarge,SecureJsonBodyInvalid\}/);
  assert.match(route,/SecureJsonBodyTooLarge\)[\s\S]*?status:413/);
  assert.match(route,/SecureJsonBodyInvalid\)[\s\S]*?status:400/);
  assert.doesNotMatch(route,/await request\.json\(\)/,
    "No unlimited JSON parsing is allowed in a privileged production handler");
});
test("main production route does not expose raw upstream SQL errors, tokens or customer data",()=>{
  assert.doesNotMatch(route,/response\.text\(\)/);
  assert.doesNotMatch(route,/error instanceof Error\?error\.message/);
  assert.doesNotMatch(route,/console\.error\("\[operator\/production\]",error\)/);
  assert.match(route,/safeOperatorProductionErrorCode\(error\)/);
  assert.match(route,/Production operation could not be verified; inspect history before retrying/);
  assert.match(route,/cache-control":"private, no-store"/);
  assert.match(route,/if\(!await authorized\(\)\)/,
    "Production endpoint must remain operator-authenticated");
  assert.doesNotMatch(route,/retryAfter|automaticRetry|forceCreate/);
});
test("main production route rejects hostile POST origins and invalid JSON media types",()=>{
  const good=request("{}");
  assert.equal(secureSameOriginRequestError(good),null);
  assert.equal(secureJsonRequestError(good,65_536),null);
  for(const [key,value] of [
    ["origin","https://other.invalid"],
    ["origin","http://127.0.0.1:3000"],
    ["sec-fetch-site","cross-site"],
    ["sec-fetch-site","same-site"],
  ])assert.equal(secureJsonRequestError(request("{}",{[key]:value}),65_536)?.status,403);
  assert.equal(secureJsonRequestError(request("{}",{"content-type":"text/plain"}),65_536)?.status,415);
  assert.equal(secureJsonRequestError(request("{}",{"content-length":"999999"}),65_536)?.status,413);
});
test("main production route streaming JSON enforces the 64KiB cap without relying on headers",async()=>{
  assert.deepEqual(await readSecureJsonObject(request('{"action":"quote_status"}'),65_536),
    {action:"quote_status"});
  await assert.rejects(readSecureJsonObject(request(JSON.stringify({
    action:"create_quote",note:"x".repeat(65_540),
  })),65_536),SecureJsonBodyTooLarge);
  await assert.rejects(readSecureJsonObject(request("[1,2]"),65_536),SecureJsonBodyInvalid);
  await assert.rejects(readSecureJsonObject(request("{oops"),65_536),SecureJsonBodyInvalid);
});
test("main operator diagnostics cannot echo confidential upstream errors",()=>{
  const confidential="DO-NOT-LEAK-CUSTOMER-RECOVERY-SECRET";
  for(const value of [
    new Error(confidential),
    Object.assign(new Error(confidential),{name:"AbortError"}),
    Object.assign(new Error(confidential),{name:"TypeError"}),
    Object.assign(new Error(confidential),{name:"SyntaxError"}),
    {message:confidential},
  ]){
    assert.doesNotMatch(safeOperatorProductionErrorCode(value),/DO-NOT-LEAK|CUSTOMER|RECOVERY|SECRET/);
  }
});
