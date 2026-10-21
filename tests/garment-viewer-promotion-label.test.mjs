import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("operator panel cannot advertise 3D customer readiness from automated evidence alone", () => {
  const source = readFileSync("src/app/operator/garment-viewer/page.tsx", "utf8");
  assert.match(source, /CUSTOMER PROMOTION GATE — TECHNICAL CHECKS ONLY/);
  assert.match(source, /TECHNICAL PASS/);
  assert.match(source, /owner\/tailor acceptance/);
  assert.doesNotMatch(source, /latest\?\.readiness\.ready\?"READY"/);
});
