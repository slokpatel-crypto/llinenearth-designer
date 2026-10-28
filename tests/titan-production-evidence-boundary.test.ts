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
  assert.ok(source.includes('rpc<unknown[]>("production_delivery_first_ten_audit",{})'));
  assert.ok(source.includes("parseAuthoritativeFirstTenDeliveryAudit(firstTenRows)"));
  assert.ok(source.includes('rpc<unknown[]>("production_delivery_evidence_recent",{p_limit:500})'));
});

test("operator display cannot mark phase gate complete with incomplete ledger history",()=>{
  const source=readFileSync("src/app/operator/production-evidence/ProductionEvidenceClient.tsx","utf8");
  assert.ok(source.includes("setHistoryComplete(data.historyComplete===true)"));
  assert.ok(source.includes("summarizeProductionDeliveryEvidence(firstTenOrders,firstTenEvidence,10,historyComplete,deliveredCount)"));
});

test("release contract requires complete history before first-ten certification",()=>{
  const release=readFileSync("scripts/release-readiness.mjs","utf8");
  assert.ok(release.includes("gateComplete:historyComplete&&firstTarget.length>=target"));
  assert.ok(release.includes("production_delivery_first_ten_audit"));
  assert.ok(!release.includes('"gateComplete:firstTarget.length>=target"'));
});

test("authoritative audit migration derives chronology from delivery events and remains service-role only",()=>{
  const migration=readFileSync("supabase/migrations/20261028121038_authoritative_first_ten_delivery_audit.sql","utf8");
  assert.ok(migration.includes("min(event.created_at) as delivered_at"));
  assert.ok(migration.includes("count(*) over ()::integer as total_delivered_count"));
  assert.ok(migration.includes("order by delivered_at asc,order_id asc\n    limit 10"));
  assert.ok(migration.includes("o.status as current_status"));
  assert.ok(migration.includes("evidence.revision_id as evidence_revision_id"));
  assert.ok(migration.includes("evidence.recipe_hash as evidence_recipe_hash"));
  assert.ok(migration.includes("order by evidence.created_at desc,evidence.evidence_id desc"));
  assert.ok(migration.includes("security definer\nset search_path=''"));
  assert.ok(migration.includes("revoke all on function public.production_delivery_first_ten_audit() from public,anon,authenticated"));
  assert.ok(migration.includes("grant execute on function public.production_delivery_first_ten_audit() to service_role"));
});
