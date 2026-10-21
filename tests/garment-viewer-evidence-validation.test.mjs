import assert from "node:assert/strict";
import test from "node:test";
import {
  parseGarmentPatternSamples,
  parseGarmentLatencySamples,
  parseGarmentRealismAssessments,
  parseMeasuredScaleInput,
} from "../src/lib/garment-viewer-evidence-validation.ts";

test("strict scale parse rejects fabricated zero and out-of-range evidence", () => {
  const base = { fabricId: "stripe-real", pattern: "stripe", verified: true };
  for (const invalid of [null, "", "0", false, true, undefined, NaN, Infinity, -1, 101]) {
    assert.deepEqual(parseGarmentPatternSamples([{ ...base, errorPct: invalid }]), []);
  }
  assert.deepEqual(parseGarmentPatternSamples([{ ...base, errorPct: 0 }]), [{ ...base, errorPct: 0 }]);
});

test("fake latency observations cannot make up twelve real samples", () => {
  const fake = [null, "", false, "4", 0, -1, Infinity, NaN, 10001];
  assert.deepEqual(parseGarmentLatencySamples([...fake, 23.5, 100]), [23.5, 100]);
  assert.equal(parseGarmentLatencySamples(Array(12).fill(null)).length, 0);
});

test("realism ratings must be measured numeric integers, not coerced values", () => {
  const rows = [
    { viewerId: "VIEWER-1", rating: 4 },
    { viewerId: "v2", rating: "5" },
    { viewerId: "v3", rating: 4.4 },
    { viewerId: "v4", rating: null },
    { viewerId: "v5", rating: 5 },
  ];
  assert.deepEqual(parseGarmentRealismAssessments(rows), [
    { viewerId: "viewer-1", rating: 4, recordedAt: "" },
    { viewerId: "v5", rating: 5, recordedAt: "" },
  ]);
});

test("blank UI error cannot become verified perfect-scale evidence", () => {
  for (const text of ["", " ", "NaN", "Infinity", "0x0", "-0.0"]) {
    assert.equal(parseMeasuredScaleInput("cloth", text, "stripe", true), null);
  }
  assert.deepEqual(parseMeasuredScaleInput(" cloth ", "0", "stripe", true), {
    fabricId: "cloth", pattern: "stripe", errorPct: 0, verified: true,
  });
  assert.deepEqual(parseMeasuredScaleInput("cloth", "4.134", "check", false), {
    fabricId: "cloth", pattern: "check", errorPct: 4.13, verified: false,
  });
});
