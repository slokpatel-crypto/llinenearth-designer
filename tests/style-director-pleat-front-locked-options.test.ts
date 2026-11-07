import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateFrontConstructionIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

// Candidate front wording is not evidence of an inherited, computed or stale
// saved pleat ID. Counts and pleat direction also need a canonical own-data ID.
test("front, count and direction instructions fail closed for unreadable locked pleats", () => {
  const flat = Object.freeze({ pleat: "flat_front" });
  const singleForward = Object.freeze({ pleat: "single_pleat_forward" });
  const singleReverse = Object.freeze({ pleat: "single_pleat_reverse" });
  const doubleReverse = Object.freeze({ pleat: "double_pleat_reverse" });
  const valid = [
    ["flat-front trousers", flat],
    ["single pleat trousers", singleReverse],
    ["no double pleats", singleReverse],
    ["no forward pleats", singleReverse],
    ["no reverse pleats", singleForward],
    ["double pleats", doubleReverse],
  ] as const;
  for (const [wording, saved] of valid) {
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, saved), [],
      "valid own-data pleats remain allowed: " + wording);
  }
  for (const [wording, saved] of [
    ["flat-front trousers", singleReverse],
    ["single pleat trousers", flat],
    ["no double pleats", doubleReverse],
    ["no forward pleats", singleForward],
    ["no reverse pleats", singleReverse],
    ["double pleats", singleReverse],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, saved)
      .map(issue => issue.code), ["candidate_trouser_pleat_mismatch"], wording);
  }
  const inherited = Object.create({ pleat: "flat_front" });
  const accessor = Object.defineProperty({}, "pleat", {
    get() { throw new Error("saved pleat getter must not execute"); },
  });
  const hostile = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error("untrusted pleat descriptor"); },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const saved of [null, {}, inherited, accessor, hostile, revoked.proxy,
    { pleat: "stale_pleat" }, { pleat: "spread_collar" }]) {
    for (const phrase of [
      "flat-front trousers", "single pleat trousers", "no double pleats",
      "no forward pleats", "no reverse pleats",
    ]) {
      const issues = styleDirectorCandidateFrontConstructionIssues(phrase, saved as never);
      assert.deepEqual(issues.map(issue => issue.code),
        ["candidate_trouser_pleat_mismatch"], phrase);
      assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(phrase, saved as never),
        issues, "untrusted saved fields must deterministically fail closed");
    }
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
      "tailored trousers", saved as never), [], "neutral phrasing is not an approval");
  }
  assert.equal(flat.pleat, "flat_front");
  assert.equal(singleForward.pleat, "single_pleat_forward");
  assert.equal(singleReverse.pleat, "single_pleat_reverse");
  assert.equal(doubleReverse.pleat, "double_pleat_reverse");
});
