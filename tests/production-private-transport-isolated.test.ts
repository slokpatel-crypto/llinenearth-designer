import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("every operator production GET and POST exit uses the private response boundary",()=>{
  const source=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const [beforePost,post]=source.split("export async function POST(request:Request){");
  assert.ok(post,"production POST handler must exist");
  const get=beforePost.split("export async function GET(){")[1];
  assert.ok(get,"production GET handler must exist");
  assert.doesNotMatch(get,/return NextResponse\.json\(/);
  assert.doesNotMatch(post,/return NextResponse\.json\(/);
  assert.equal((get.match(/return privateProductionResponse\(/g)||[]).length,4);
  assert.ok((post.match(/return privateProductionResponse\(/g)||[]).length>=14);
  assert.match(source,/function privateProductionResponse\(body:unknown,init\?:ResponseInit\)/);
  assert.match(source,/response\.headers\.set\("cache-control","private, no-store"\)/);
  assert.equal((source.match(/NextResponse\.json\(/g)||[]).length,1,
    "only the centralized helper may construct a production response");
});
test("private transport acceptance is executed after production build in CI",()=>{
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  const build=workflow.indexOf("npm run build");
  const fixture=workflow.indexOf("node scripts/verify-operator-private-transport-http.cjs");
  assert.ok(build>=0 && fixture>build,"run actual built-Next HTTP boundary after build");
});
