import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("TITAN operator combined optional-evidence and signed private POST accepts no partial safety regression",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const helper=readFileSync("src/lib/designer/operator-optional-rpc.ts","utf8");
  const runner=readFileSync("scripts/verify-operator-production-private-http.cjs","utf8");
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  const get=route.split("export async function GET(){")[1]?.split("function privateProductionResponse(")[0]??"";
  const post=route.split("export async function POST(request:Request){")[1]??"";
  const rpc=route.split("async function rpc<T>(")[1]?.split("async function loadVerifiedLockedRevision(")[0]??"";
  assert.match(rpc,/optional=false/);
  assert.match(rpc,/optional && await isMissingOptionalProductionRpc\(response\)/);
  assert.match(helper,/response\.status!==404/);
  assert.match(helper,/body as Record<string,unknown>\)\.code==="PGRST202"/);
  assert.equal((get.match(/,true\)/g)||[]).length,3);
  assert.match(get,/status:503/);
  assert.doesNotMatch(get,/catch\s*\{\s*\/\/ Keep/);
  assert.match(route,/function privateProductionResponse\(body:unknown,init\?:ResponseInit\)/);
  assert.match(route,/response.headers.set\("cache-control","private, no-store"\)/);
  assert.equal((post.match(/return privateProductionResponse\(/g)||[]).length,17);
  assert.doesNotMatch(post,/return NextResponse\.json\(/);
  assert.ok(runner.includes("TITAN signed built-Next operator private POST CSRF/size/JSON HTTP PASS."));
  assert.ok(workflow.includes("node scripts/verify-operator-production-private-http.cjs"));
  assert.ok(workflow.indexOf("node scripts/verify-operator-production-private-http.cjs")
   <workflow.indexOf("node scripts/verify-garment-viewer.cjs"));
});
