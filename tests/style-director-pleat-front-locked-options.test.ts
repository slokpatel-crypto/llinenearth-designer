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

test("with-or-without pleats stays ambiguous instead of selecting a locked front", () => {
  const alternatives = [
    "with or without pleats",
    "with or without any pleats",
    "with without pleats",
    "with or without double pleats",
    "with or without single pleats",
    "with or without forward pleats",
    "with or without a reverse pleat",
  ];
  const permitted = [
    "flat_front", "single_pleat_forward", "single_pleat_reverse",
    "double_pleat_forward", "double_pleat_reverse",
  ];
  for (const wording of alternatives) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "ambiguous", wording);
    assert.ok(styleDirectorCandidateWordingIssues("plain shirt", wording)
      .some(issue => issue.code === "ambiguous_candidate_trouser_front"), wording);
    for (const pleat of permitted) {
      const locked = Object.freeze({ pleat });
      const before = JSON.stringify(locked);
      assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, locked), [],
        wording + ": undecided alternatives must not ban a versioned ID");
      assert.equal(JSON.stringify(locked), before);
    }
  }
});

test("undecided pleats never hide an independent explicit direction or count ban", () => {
  const byDirection = "with or without double pleats; no reverse pleats";
  assert.equal(styleDirectorCandidateTrouserFront(byDirection), "ambiguous");
  for (const pleat of ["single_pleat_reverse", "double_pleat_reverse"]) {
    const locked = Object.freeze({ pleat });
    const first = styleDirectorCandidateFrontConstructionIssues(byDirection, locked);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_trouser_pleat_mismatch"]);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(byDirection, locked), first);
  }
  for (const pleat of ["flat_front", "single_pleat_forward", "double_pleat_forward"]) {
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(byDirection,
      Object.freeze({ pleat })), []);
  }
  const byCount = "with or without double pleats; double pleats are prohibited";
  assert.equal(styleDirectorCandidateTrouserFront(byCount), "ambiguous");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(byCount,
    Object.freeze({ pleat: "double_pleat_forward" })).map(issue => issue.code),
    ["candidate_trouser_pleat_mismatch"]);
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(byCount,
    Object.freeze({ pleat: "single_pleat_forward" })), []);
  assert.ok(styleDirectorCandidateWordingIssues("plain shirt", byCount)
    .some(issue => issue.code === "ambiguous_candidate_trouser_front"));
});

test("alternative pleat counts and directions require explicit review", () => {
  const alternatives = [
    "single or double pleats",
    "single pleat or double pleats",
    "double pleats or single pleat",
    "one or two pleats",
    "1 or 2 pleats",
    "forward or reverse pleats",
    "reverse pleats or forward pleats",
    "either forward or reverse pleats",
  ];
  const canonical = [
    "flat_front", "single_pleat_forward", "single_pleat_reverse",
    "double_pleat_forward", "double_pleat_reverse",
  ];
  for (const wording of alternatives) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "ambiguous", wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("plain shirt", wording)
      .map(issue => issue.code), ["ambiguous_candidate_trouser_front"], wording);
    for (const pleat of canonical) {
      const saved = Object.freeze({ pleat });
      const snapshot = JSON.stringify(saved);
      assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, saved), [], wording);
      assert.equal(JSON.stringify(saved), snapshot);
    }
  }
});

test("ambiguous pleat alternatives preserve independent explicit bans", () => {
  for (const [wording, denied, allowed] of [
    ["single or double pleats; no reverse pleats", "single_pleat_reverse", "single_pleat_forward"],
    ["forward or reverse pleats; double pleats forbidden", "double_pleat_forward", "single_pleat_reverse"],
  ] as const) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "ambiguous", wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording,
      Object.freeze({ pleat: denied })).map(issue => issue.code),
      ["candidate_trouser_pleat_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording,
      Object.freeze({ pleat: allowed })), [], wording);
    assert.ok(styleDirectorCandidateWordingIssues("plain shirt", wording)
      .some(issue => issue.code === "ambiguous_candidate_trouser_front"), wording);
  }
});
