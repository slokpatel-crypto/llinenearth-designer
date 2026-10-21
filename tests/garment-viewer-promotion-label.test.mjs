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


test("audited physical inputs, measured error and revision mismatch are visible without claiming customer approval",()=>{
  const source = readFileSync("src/app/operator/garment-viewer/page.tsx","utf8");
  const form = readFileSync("src/app/operator/garment-viewer/GarmentViewerEvidenceForm.tsx","utf8");
  assert.match(source,/Physical pattern-scale evidence audit/);
  assert.match(source,/latest\.readiness\.scaleAudit/);
  assert.match(source,/latest\.identityMatches/);
  assert.match(source,/measuredErrorPct\.toFixed\(3\)/);
  assert.match(source,/sample\.physicalEvidenceNote/);
  assert.match(source,/WRONG ASSET/);
  assert.match(form,/preciseGarmentScaleErrorPct\(stripePreview\)/);
  assert.match(form,/preciseGarmentScaleErrorPct\(checkPreview\)/);
  assert.match(form,/must use different fabric IDs/);
  assert.match(form,/physical review still required/);
});
