import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Static source gate covers all authenticated success/failure branches. The
// built-Next loopback smoke independently verifies actual HTTP headers on 401.
test("J5 operator production and garment-QC JSON replies all use private no-store headers",()=>{
  for(const path of [
    "src/app/api/operator/production/route.ts",
    "src/app/api/operator/garment-qc/route.ts",
  ]){
    const source=readFileSync(path,"utf8");
    assert.match(source,/function respond\(body:unknown,status=200\)/,path);
    assert.match(source,/return NextResponse\.json\(body,\{status,headers:\{"cache-control":"private, no-store","pragma":"no-cache"\}\}\)/,path);
    assert.equal((source.match(/NextResponse\.json\(/g)||[]).length,1,
      path+" must not bypass the private responder on any path");
    const get=source.slice(source.indexOf("export async function GET("),source.indexOf("export async function POST("));
    const post=source.slice(source.indexOf("export async function POST("));
    assert.match(get,/return respond\(/,path+" GET");
    assert.match(post,/return respond\(/,path+" POST");
    assert.doesNotMatch(get,/NextResponse\.json\(/);
    assert.doesNotMatch(post,/NextResponse\.json\(/);
  }
  const production=readFileSync("src/app/api/operator/production/route.ts","utf8");
  assert.match(production,/return respond\(receipt\)/);
  const qc=readFileSync("src/app/api/operator/garment-qc/route.ts","utf8");
  assert.match(qc,/return respond\(\{configured:true,orders,inspections\}\)/);
});
