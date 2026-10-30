import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

test("TITAN release criteria are persisted, grouped by six agreed areas and required by the static gate",()=>{
  const checklist=readFileSync("docs/TITAN_RELEASE_CHECKLIST.md","utf8");
  const checkpoint=readFileSync("docs/TITAN_RELEASE_CHECKPOINT.md","utf8");
  const release=readFileSync("scripts/release-readiness.mjs","utf8");
  for(const id of ["T1","T2","T3","T4","T5","T6","J1","J2","J3","J4","J5","J6"])
    assert.match(checklist,new RegExp("\\b"+id+"\\b"),"Missing acceptance criterion "+id);
  for(const contract of [
    "No percentage scoring",
    "one integrated release SHA",
    "no-per-edit-paid-AI",
    "linen-earth-studio-model-v1",
    "public/designer/studio-tucked.webp",
    "separate explicit owner approval",
  ]) assert.ok(checklist.includes(contract),"Missing immutable release policy: "+contract);
  assert.match(checkpoint,/b15cfd5002688ab4bf44782fb0c91a118a765ce6/);
  assert.match(checkpoint,/40925675133/);
  assert.match(checkpoint,/40925675204/);
  assert.match(checkpoint,/PENDING/);
  assert.match(release,/"docs\/TITAN_RELEASE_CHECKLIST\.md"/);
  assert.match(release,/"docs\/TITAN_RELEASE_CHECKPOINT\.md"/);
});

test("customer handoff cannot silently restore unbounded Supabase response JSON",()=>{
  const enquiry=readFileSync("src/app/api/designer/enquiry/route.ts","utf8");
  const share=readFileSync("src/app/api/designer/share/route.ts","utf8");
  assert.match(enquiry,/readBoundedJsonResponse\(response,256 \* 1024\)/);
  assert.match(share,/verifiedLockedHandoffAuditId\(await rpc\("design_share_audit_record"/);
  assert.match(share,/return await readBoundedJsonResponse\(response,maxBytes\)/);
  assert.match(share,/},4\*1024\)\)/);
  assert.doesNotMatch(enquiry,/response\.json\(\)/);
  assert.doesNotMatch(share,/audit\.json\(\)/);
  assert.match(enquiry,/operatorReceived:false,status:"intent_recorded"/);
});
