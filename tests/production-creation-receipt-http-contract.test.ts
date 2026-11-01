import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("M146 creation receipt CI fixture is private, read-only and exact-key only",()=>{
  const fixture=readFileSync("scripts/ci-verified-stock-fixture.cjs","utf8");
  assert.match(fixture,/CREATION_RECEIPT_LOOKUP_PATH/);
  assert.match(fixture,/CI_CREATION_REQUEST_KEY/);
  assert.ok(fixture.includes('req.url==="/__fixture/creation-receipt-mode"'));
  assert.match(fixture,/req.headers.apikey!==FIXTURE_KEY/);
  assert.ok(fixture.includes('payload.p_request_key!==CI_CREATION_REQUEST_KEY'));
  assert.match(fixture,/if\(req.url===CREATION_RECEIPT_LOOKUP_PATH\)/);
  for(const mode of ["valid","empty","malformed","duplicate","missing","upstream","oversized"])
    assert.ok(fixture.includes('"'+mode+'"'),"Missing isolated test mode "+mode);
  assert.ok(fixture.includes('private_customer_phone:"DO-NOT-LEAK-CI-CREATION-PRIVATE"'));
});

test("M146 signed built-Next creation lookup covers auth, privacy and uncertain commit",()=>{
  const script=readFileSync("scripts/verify-production-creation-receipt-private-http.cjs","utf8");
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  assert.match(script,/Signed built-Next creation receipt recovery HTTP PASS/);
  assert.ok(script.includes('GITHUB_ACTIONS!=="true"'));
  assert.ok(script.includes("CI-only."));
  for(const label of ["anonymous","forged","expired","not-a-uuid",
    "malformed","duplicate","missing","upstream","oversized"])
    assert.ok(script.includes('"'+label+'"'),"Missing signed HTTP case "+label);
  assert.ok(script.includes("Empty is a time-bound observation, NEVER proof of noncommit"));
  assert.ok(script.includes("assertPrivate(failed)"));
  assert.ok(script.includes("DO-NOT-LEAK-CI-"));
  assert.ok(script.includes('action:"creation_receipt_lookup"'));
  assert.ok(script.includes("No real order, write, customer contact, supplier stock or live schema."));
  assert.ok(workflow.includes("node scripts/verify-production-creation-receipt-private-http.cjs"));
  assert.ok(route.includes('rpc<unknown>("production_creation_request_receipt_lookup",{p_request_key:key})'));
  assert.ok(route.includes('parseProductionCreationReceipts(rows)'));
});
