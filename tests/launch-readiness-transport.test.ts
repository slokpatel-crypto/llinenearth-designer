import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {safeLaunchReadinessRows} from "../src/lib/designer/launch-readiness-transport.ts";

test("launch readiness strips unexpected private upstream columns while retaining review/blocker status",()=>{
  const beta={
    attempt_id:"123e4567-e89b-42d3-a456-426614174001",
    case_id:"CI-BETA-1",device_class:"mobile",
    core_flow_completed:false,design_locked:true,share_or_enquiry_completed:false,
    blocking_bug:true,note:"Unverified synthetic attempt",revision_id:null,recipe_hash:null,
    evidence_kind:null,share_audit_confirmed:false,enquiry_audit_confirmed:false,
    created_at:"2026-10-31T00:00:00Z",
    customerPhone:"DO-NOT-LEAK",supplierSheet:"SENSITIVE-TEST-SOURCE",
  };
  const checklist={
    event_id:"123e4567-e89b-42d3-a456-426614174002",
    item_id:"privacy_notice",status:"review",signed_by:"Synthetic Reviewer",
    note:"Needs approval",created_at:"2026-10-31T00:00:00Z",
    private_review_token:"DO-NOT-LEAK",
  };
  const b=safeLaunchReadinessRows([beta],"beta");
  const c=safeLaunchReadinessRows([checklist],"checklist");
  assert.equal(b[0].blocking_bug,true);
  assert.equal(b[0].core_flow_completed,false);
  assert.equal(c[0].status,"review");
  for(const row of [b[0],c[0]]){
    assert.doesNotMatch(JSON.stringify(row),/DO-NOT-LEAK|SENSITIVE-TEST-SOURCE/);
    assert.equal(Object.hasOwn(row,"supplierSheet"),false);
    assert.equal(Object.hasOwn(row,"private_review_token"),false);
  }
  assert.equal(Object.keys(b[0]).length,14);
  assert.equal(Object.keys(c[0]).length,6);
  assert.equal(beta.customerPhone,"DO-NOT-LEAK","Never change upstream data");
});

test("launch evidence transport bounds collection and field sizes and fails closed",()=>{
  for(const kind of ["beta","checklist"] as const){
    assert.deepEqual(safeLaunchReadinessRows([],kind),[]);
    for(const bad of [null,{},true,"not an array",[null],[[]],[1],[{},"bad"],
      Array.from({length:501},()=>({}))]){
      assert.throws(()=>safeLaunchReadinessRows(bad,kind));
    }
  }
  for(const bad of [
    [{case_id:{secret:"hidden"}}],
    [{note:"x".repeat(1201)}],
    [{created_at:"x".repeat(65)}],
    [{share_audit_confirmed:"true"}],
    [{blocking_bug:1}],
  ])assert.throws(()=>safeLaunchReadinessRows(bad,"beta"));
  for(const bad of [
    [{signed_by:{nested:"secret"}}],
    [{note:"x".repeat(1201)}],
    [{created_at:Date.now()}],
  ])assert.throws(()=>safeLaunchReadinessRows(bad,"checklist"));
});

test("operator readiness API uses shared private responses and bounded upstream reads",()=>{
  const route=readFileSync("src/app/api/operator/launch-readiness/route.ts","utf8");
  const http=readFileSync("scripts/verify-launch-readiness-private-http.cjs","utf8");
  const fixture=readFileSync("scripts/ci-verified-stock-fixture.cjs","utf8");
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  assert.ok(route.includes('"cache-control":"private, no-store"'));
  assert.ok(route.includes('"pragma":"no-cache"'));
  assert.ok(route.includes('return respond({error:"Unauthorized."},401)'));
  assert.ok(route.includes('return respond({configured:false,betaAttempts:[],checklistEvents:[]})'));
  assert.ok(route.includes('return respond({error:"Launch-readiness evidence could not be read."},503)'));
  assert.ok(route.includes('readBoundedJsonResponse(response,maxBytes)'));
  assert.ok(route.includes('safeLaunchReadinessRows(rawBeta,"beta")'));
  assert.ok(route.includes('safeLaunchReadinessRows(rawChecklist,"checklist")'));
  assert.ok(!route.includes('return await response.json()'));
  assert.ok(!route.includes('NextResponse.json({configured:true,betaAttempts,checklistEvents}'));
  assert.ok(http.includes('assert.equal(r.status,401'));
  assert.ok(http.includes('assert.equal(r.status,200'));
  assert.ok(http.includes('privateHeaders(r)'));
  assert.ok(http.includes('assert.doesNotMatch(JSON.stringify(data),/DO-NOT-LEAK-CI-/)'));
  assert.ok(fixture.includes("LAUNCH_LISTS"));
  assert.ok(fixture.includes('private_supplier_document:"DO-NOT-LEAK-CI-SUPPLIER"'));
  assert.ok(workflow.includes("node scripts/verify-launch-readiness-private-http.cjs"));
});
