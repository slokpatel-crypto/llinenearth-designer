import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateCuffIssues,
  styleDirectorCandidateCuffIntent,
  styleDirectorCandidateCuff,
  styleDirectorCandidateWordingIssues,
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

test("postposed cuff prohibitions must not become construction requests", () => {
  const lockedFrench = Object.freeze({ cuff: "french_double_cuff" });
  const lockedBarrel = Object.freeze({ cuff: "barrel_cuff_1_button" });
  for (const wording of [
    "French cuffs aren't wanted",
    "French cuff isn't wanted",
    "French cuff is not wanted",
    "French cuff unwanted",
    "French cuff should not be selected",
    "French cuff must not be used",
  ]) {
    const intent = styleDirectorCandidateCuffIntent(wording);
    assert.deepEqual(intent, {
      requested: null, prohibited: ["french_double_cuff"], ambiguous: false,
    }, wording);
    assert.equal(styleDirectorCandidateCuff(wording, []), null, wording);
    assert.deepEqual(styleDirectorCandidateCuffIssues(wording, lockedFrench).map(x => x.code),
      ["candidate_cuff_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateCuffIssues(wording, lockedBarrel), [], wording);
  }
  for (const wording of [
    "French cuff isn't required",
    "French cuff isn't needed",
    "French cuff isn't mandatory",
    "French cuff is not required",
    "French cuff not needed",
    "French cuffs aren't required",
  ]) {
    assert.deepEqual(styleDirectorCandidateCuffIntent(wording), {
      requested: null, prohibited: [], ambiguous: false,
    }, wording);
    assert.equal(styleDirectorCandidateCuff(wording, []), null, wording);
    assert.deepEqual(styleDirectorCandidateCuffIssues(wording, lockedFrench), [], wording);
  }
  const conflict = "French cuff and French cuff isn't wanted";
  assert.equal(styleDirectorCandidateCuffIntent(conflict).ambiguous, true);
  assert.deepEqual(styleDirectorCandidateCuffIssues(conflict, lockedFrench), []);
  assert.ok(styleDirectorCandidateWordingIssues(conflict)
    .some(issue => issue.code === "ambiguous_candidate_cuff"));
  assert.equal(lockedFrench.cuff, "french_double_cuff");
  assert.equal(lockedBarrel.cuff, "barrel_cuff_1_button");
});

test("postposed cuff refusal applies across all existing cuff families", () => {
  const cases = [
    ["French cuff", "french_double_cuff"],
    ["barrel cuff 1 button", "barrel_cuff_1_button"],
    ["barrel cuff 2 buttons", "barrel_cuff_2_button"],
    ["convertible cuff", "convertible_cuff"],
    ["rounded soft cuff", "rounded_soft_cuff"],
    ["cocktail cuff", "cocktail_cuff"],
    ["angled barrel cuff", "angled_barrel_cuff"],
    ["open short sleeve hem", "open_short_hem_cuff"],
  ] as const;
  for (const [name, id] of cases) {
    const wording = `${name} should not be selected`;
    assert.deepEqual(styleDirectorCandidateCuffIntent(wording), {
      requested: null, prohibited: [id], ambiguous: false,
    }, wording);
    const locked = Object.freeze({ cuff: id });
    const original = JSON.stringify(locked);
    const first = styleDirectorCandidateCuffIssues(wording, locked);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_cuff_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateCuffIssues(wording, locked), first, wording);
    assert.equal(JSON.stringify(locked), original, "locked option must remain unchanged");
  }
});

test("with-or-without cuffs require review without selecting or forbidding a saved cuff", () => {
  const family = [
    ["French cuff", "french_double_cuff"],
    ["barrel cuff 1 button", "barrel_cuff_1_button"],
    ["barrel cuff 2 buttons", "barrel_cuff_2_button"],
    ["convertible cuff", "convertible_cuff"],
    ["rounded soft cuff", "rounded_soft_cuff"],
    ["cocktail cuff", "cocktail_cuff"],
    ["angled barrel cuff", "angled_barrel_cuff"],
    ["open short sleeve hem", "open_short_hem_cuff"],
  ] as const;
  for (const [label, expected] of family) {
    for (const wording of ["with or without " + label, "with or without a " + label]) {
      assert.deepEqual(styleDirectorCandidateCuffIntent(wording), {
        requested: null, prohibited: [], ambiguous: true,
      }, wording);
      assert.equal(styleDirectorCandidateCuff(wording, []), null, wording);
      assert.deepEqual(styleDirectorCandidateWordingIssues(wording).map(issue => issue.code),
        ["ambiguous_candidate_cuff"], wording);
      for (const id of [expected, "french_double_cuff", "barrel_cuff_1_button"]) {
        const locked = Object.freeze({ cuff: id });
        const before = JSON.stringify(locked);
        assert.deepEqual(styleDirectorCandidateCuffIssues(wording, locked), [], wording);
        assert.equal(JSON.stringify(locked), before);
      }
    }
  }
});

test("undecided cuffs keep independent prohibitions and positive choices for review", () => {
  const forbidden = "with or without french cuff; no convertible cuff";
  assert.deepEqual(styleDirectorCandidateCuffIntent(forbidden), {
    requested: null, prohibited: ["convertible_cuff"], ambiguous: true,
  });
  assert.deepEqual(styleDirectorCandidateWordingIssues(forbidden).map(issue => issue.code),
    ["ambiguous_candidate_cuff"]);
  const positive = "with or without french cuff; cocktail cuff required";
  assert.deepEqual(styleDirectorCandidateCuffIntent(positive), {
    requested: "cocktail_cuff", prohibited: [], ambiguous: true,
  });
  assert.deepEqual(styleDirectorCandidateWordingIssues(positive).map(issue => issue.code),
    ["ambiguous_candidate_cuff"]);
  assert.deepEqual(styleDirectorCandidateCuffIntent("No French cuff"), {
    requested: null, prohibited: ["french_double_cuff"], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateCuffIntent("French cuff"), {
    requested: "french_double_cuff", prohibited: [], ambiguous: false,
  });
});
