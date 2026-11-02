import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("static release checker does not certify TITAN production without human and physical evidence",()=>{
  const src=readFileSync("scripts/release-readiness.mjs","utf8");
  assert.match(src,/TITAN production launch is NOT certified/);
  assert.match(src,/TITAN launch acceptance was NOT evaluated/);
  for(const contract of ["stock v3 migration/restore","tailor review","five real testers","ten deliveries","owner signoff"]){
    assert.ok(src.includes(contract),"release warning must include "+contract);
  }
  assert.ok(!src.includes('console.log("\\nLinen Earth release foundation is ready.")'),
    "static pass must not use the previous ambiguous release-ready message");
});

test("current six-area TITAN gate supersedes historical checklist without fabricating acceptance",()=>{
  const src=readFileSync("docs/production-release-checklist.md","utf8");
  assert.match(src,/Launch state: BLOCKED — NOT DEPLOYMENT-READY/);
  for(const id of ["T1/J1","T2/J2","T3/J3","T4/J4","T5/J5","T6/J6"]){
    assert.ok(src.includes(id),"each accepted release area must be accounted for: "+id);
  }
  assert.ok(src.includes("five testers")&&src.includes("ten deliveries"));
  assert.ok(src.includes("fabric_stock_write_ready_v1()"));
  assert.ok(src.includes("no-paid-AI core"));
  assert.ok(src.includes("Archived 1.0 checklist"));
  assert.match(src,/git.deploymentEnabled=false/);
});
