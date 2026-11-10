import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateFrontConstructionIssues,
  styleDirectorCandidateTrouserFront,
  styleDirectorCandidateWordingIssues,
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

test("postposed direction refusals prohibit only the named pleat direction", () => {
  const forward = Object.freeze({ pleat: "single_pleat_forward" });
  const reverse = Object.freeze({ pleat: "single_pleat_reverse" });
  const flat = Object.freeze({ pleat: "flat_front" });
  for (const [wording, denied, allowed] of [
    ["reverse pleats aren't wanted", reverse, forward],
    ["reverse pleats aren’t wanted", reverse, forward],
    ["reverse pleats not wanted", reverse, forward],
    ["forward pleats are unwanted", forward, reverse],
    ["forward pleats should not be selected", forward, reverse],
    ["reverse pleats must not be chosen", reverse, forward],
  ] as const) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    const before = JSON.stringify(denied);
    const mismatch = styleDirectorCandidateFrontConstructionIssues(wording, denied);
    assert.deepEqual(mismatch.map(issue => issue.code),
      ["candidate_trouser_pleat_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, denied), mismatch);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, allowed), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, flat), [], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("plain shirt", wording), [], wording);
    assert.equal(JSON.stringify(denied), before, "a locked pleat ID must not be rewritten");
  }
});

test("optional pleat directions do not select a front or override an explicit direction", () => {
  const forward = Object.freeze({ pleat: "double_pleat_forward" });
  const reverse = Object.freeze({ pleat: "double_pleat_reverse" });
  for (const wording of [
    "reverse pleats aren't required",
    "forward pleats aren’t needed",
    "reverse pleats aren't mandatory",
    "forward pleats are not necessary",
    "reverse pleats optional",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, forward), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, reverse), [], wording);
  }
  const requested = "reverse pleats aren't needed; forward pleats required";
  assert.equal(styleDirectorCandidateTrouserFront(requested), "pleated");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(requested, forward), []);
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(requested, reverse)
    .map(issue => issue.code), ["candidate_trouser_pleat_mismatch"]);
});

test("opposite direction request plus explicit prohibition still requires review", () => {
  const wording = "reverse pleats aren't wanted; forward pleats required";
  assert.equal(styleDirectorCandidateTrouserFront(wording), "pleated");
  const allowed = Object.freeze({ pleat: "single_pleat_forward" });
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, allowed), []);
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording,
    Object.freeze({ pleat: "single_pleat_reverse" })).map(issue => issue.code),
    ["candidate_trouser_pleat_mismatch"]);
  const selfConflict = "reverse pleats aren't wanted; reverse pleats required";
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(selfConflict,
    Object.freeze({ pleat: "single_pleat_reverse" })).map(issue => issue.code),
    ["candidate_trouser_pleat_mismatch"]);
});
