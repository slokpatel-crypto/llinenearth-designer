import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("production GET uses private no-store for every authorized, empty, denied or backend-fault result",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const get=route.split("export async function GET(){")[1]?.split("function privateProductionResponse(")[0]??"";
  const post=route.split("export async function POST(request:Request){")[1]??"";
  assert.equal((get.match(/return privateProductionResponse\(/g)||[]).length,4);
  assert.doesNotMatch(get,/return NextResponse\.json\(/);
  assert.ok(get.includes('privateProductionResponse({error:"Unauthorized."},{status:401})'));
  assert.ok(get.includes('privateProductionResponse({configured:false,quotes:[],orders:[]})'));
  assert.ok(get.includes('privateProductionResponse({configured:true,quotes,orders,qcInspections,customerOutcomes,learningContexts}'));
  assert.ok(get.includes('privateProductionResponse({error:"Production records could not be read."},{status:503'));
  assert.ok(route.includes('response.headers.set("cache-control","private, no-store")'));
  assert.equal((post.match(/return privateProductionResponse\(/g)||[]).length,17);
  assert.ok(get.includes("if(!await authorized())"));
});
test("signed HTTP suite includes an actual anonymous GET no-store rejection without connecting backend",()=>{
  const runner=readFileSync("scripts/verify-operator-production-private-http.cjs","utf8");
  assert.ok(runner.includes("unauthenticated operator GET is private no-store"));
  assert.ok(runner.includes('method:"GET",cache:"no-store"'));
  assert.ok(runner.includes("assert.equal(get.status,401)"));
  assert.doesNotMatch(runner,/method:"GET"[\s\S]*?cookie\}/,
    "The security probe must not perform a signed live production GET");
});
