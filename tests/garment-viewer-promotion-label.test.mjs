import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("operator panel cannot advertise 3D customer readiness from automated evidence alone", () => {
  const source = readFileSync("src/app/operator/garment-viewer/page.tsx", "utf8");
  assert.match(source, /CUSTOMER PROMOTION GATE — TECHNICAL CHECKS ONLY/);
  assert.match(source, /TECHNICAL PASS/);
  assert.match(source, /MODEL CANDIDATE — STRUCTURAL PREFLIGHT/);
  assert.doesNotMatch(source, /APPROVED PRODUCTION ASSET/);
  assert.match(source, /owner\/tailor acceptance/);
  assert.doesNotMatch(source, /latest\?\.readiness\.ready\?"READY"/);
});

test("operator scale audit remains bound to current model revision and never implies human approval",()=>{
  const page=readFileSync("src/app/operator/garment-viewer/page.tsx","utf8");
  const form=readFileSync("src/app/operator/garment-viewer/GarmentViewerEvidenceForm.tsx","utf8");
  assert.match(page,/Physical pattern-scale evidence audit/);
  assert.match(page,/latest\.readiness\.scaleAudit/);
  assert.match(page,/latest\.identityMatches/);
  assert.match(page,/measuredErrorPct\.toFixed\(3\)/);
  assert.match(page,/sample\.physicalRepeatMm/);
  assert.match(page,/sample\.renderedRepeatPx/);
  assert.match(page,/sample\.referenceLengthMm/);
  assert.match(page,/sample\.evidenceReference/);
  assert.match(page,/WRONG ASSET/);
  assert.match(page,/independent tailor approval/);
  assert.match(form,/calibratedGarmentScaleErrorPct\(stripePreview\)/);
  assert.match(form,/calibratedGarmentScaleErrorPct\(checkPreview\)/);
  assert.match(form,/distinct physical fabric IDs/);
  assert.match(form,/physical review still required/);
});
