import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("source-derived 3D browser QA waits for loaded contract without weakening the candidate gate",()=>{
  const source=readFileSync("scripts/verify-garment-viewer.cjs","utf8");
  const start=source.indexOf('const isEngineeringCandidate=stageLabel.includes("ENGINEERING CANDIDATE")');
  const wait=source.indexOf("await page.waitForFunction((requiresCandidateContract)=>",start);
  const assertion=source.indexOf('assert.equal(await page.locator(".garmentViewerShell").getAttribute("data-model-readiness"),"contract_ready")',start);
  assert(start>=0 && wait>start && assertion>wait,
    "Candidate contract must be awaited before asserting readiness");
  const waitContract=source.slice(wait,assertion);
  assert.match(waitContract,/Boolean\(model\?\.loaded\)/);
  assert.match(waitContract,/model\.model\?\.materials\?\.length/);
  assert.match(waitContract,/requiresCandidateContract\s*\? readiness==="contract_ready"/);
  assert.match(waitContract,/timeout:90000,polling:100/);
  assert.match(waitContract,/!document\.querySelector\("\.garmentViewerError"\)/);
  // Keep the independent source/real-hardware strict 20-second SLA unchanged.
  assert.match(source,/firstTwoFramePaintMs/);
  assert.match(source,/20000/);
});
