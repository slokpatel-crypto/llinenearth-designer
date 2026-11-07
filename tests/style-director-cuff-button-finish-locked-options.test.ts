import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateCuffIssues,
  styleDirectorCandidateButtonIssues,
  styleDirectorCandidateCollarFinishIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

// An instruction cannot certify production against a missing, stale,
// accessor-backed or otherwise unreadable locked selection.
const malformedInputs = (field: string, stale: string) => {
  const inherited = Object.create({ [field]: stale });
  const accessor = Object.defineProperty({}, field, {
    get() { throw new Error("untrusted saved accessor must not execute"); },
  });
  const hostile = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error("untrusted descriptor"); },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  return [null, Object.freeze({}), inherited, accessor, hostile, revoked.proxy,
    Object.freeze({ [field]: "obsolete_selection" })];
};

test("cuff instructions require a canonical own-data locked option", () => {
  const french = Object.freeze({ cuff: "french_double_cuff" });
  const barrel = Object.freeze({ cuff: "barrel_cuff_1_button" });
  assert.deepEqual(styleDirectorCandidateCuffIssues("french cuff", french), []);
  assert.deepEqual(styleDirectorCandidateCuffIssues("no french cuff", barrel), []);
  assert.equal(styleDirectorCandidateCuffIssues("french cuff", barrel)[0]?.code,
    "candidate_cuff_mismatch");
  assert.equal(styleDirectorCandidateCuffIssues("no french cuff", french)[0]?.code,
    "candidate_cuff_mismatch");
  for (const saved of malformedInputs("cuff", "french_double_cuff")) {
    for (const wording of ["french cuff", "no french cuff"]) {
      const issues = styleDirectorCandidateCuffIssues(wording, saved as never);
      assert.equal(issues.length, 1, wording);
      assert.equal(issues[0].code, "candidate_cuff_mismatch");
      assert.deepEqual(styleDirectorCandidateCuffIssues(wording, saved as never), issues);
    }
  }
  assert.deepEqual(styleDirectorCandidateCuffIssues("maybe french cuff", {} as never), []);
  assert.equal(french.cuff, "french_double_cuff");
  assert.equal(barrel.cuff, "barrel_cuff_1_button");
});

test("button-material requests and exclusions require valid locked material IDs", () => {
  const horn = Object.freeze({ button: "horn" });
  const corozo = Object.freeze({ button: "corozo" });
  assert.deepEqual(styleDirectorCandidateButtonIssues("horn buttons", horn), []);
  assert.deepEqual(styleDirectorCandidateButtonIssues("no horn buttons", corozo), []);
  assert.equal(styleDirectorCandidateButtonIssues("horn buttons", corozo)[0]?.code,
    "candidate_button_mismatch");
  assert.equal(styleDirectorCandidateButtonIssues("no horn buttons", horn)[0]?.code,
    "candidate_button_mismatch");
  for (const saved of malformedInputs("button", "horn")) {
    for (const wording of ["horn buttons", "no horn buttons"]) {
      const issues = styleDirectorCandidateButtonIssues(wording, saved as never);
      assert.equal(issues.length, 1, wording);
      assert.equal(issues[0].code, "candidate_button_mismatch");
      assert.deepEqual(styleDirectorCandidateButtonIssues(wording, saved as never), issues);
    }
  }
  assert.deepEqual(styleDirectorCandidateButtonIssues("horn buttons optional", {} as never), []);
  assert.equal(horn.button, "horn");
  assert.equal(corozo.button, "corozo");
});

test("collar-finish requests cannot approve missing or unreadable saved construction", () => {
  const self = Object.freeze({ collarFinish: "Self-fabric" });
  const contrast = Object.freeze({ collarFinish: "White contrast collar + cuffs" });
  assert.deepEqual(styleDirectorCandidateCollarFinishIssues("self-fabric", self), []);
  assert.deepEqual(styleDirectorCandidateCollarFinishIssues(
    "white contrast collar and cuffs", contrast), []);
  assert.deepEqual(styleDirectorCandidateCollarFinishIssues("no white contrast collar", self), []);
  assert.equal(styleDirectorCandidateCollarFinishIssues(
    "no white contrast collar", contrast)[0]?.code, "candidate_collar_finish_mismatch");
  assert.equal(styleDirectorCandidateCollarFinishIssues(
    "self-fabric", contrast)[0]?.code, "candidate_collar_finish_mismatch");
  for (const saved of malformedInputs("collarFinish", "Self-fabric")) {
    for (const wording of ["self-fabric", "no white contrast collar"]) {
      const issues = styleDirectorCandidateCollarFinishIssues(wording, saved as never);
      assert.equal(issues.length, 1, wording);
      assert.equal(issues[0].code, "candidate_collar_finish_mismatch");
      assert.deepEqual(styleDirectorCandidateCollarFinishIssues(wording, saved as never), issues);
    }
  }
  assert.deepEqual(styleDirectorCandidateCollarFinishIssues("maybe self-fabric", {} as never), []);
  assert.equal(self.collarFinish, "Self-fabric");
  assert.equal(contrast.collarFinish, "White contrast collar + cuffs");
});
