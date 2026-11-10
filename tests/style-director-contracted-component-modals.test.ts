import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateButtonIntent,
  styleDirectorCandidateButtonIssues,
  styleDirectorCandidateCollarFinishIntent,
  styleDirectorCandidateCollarFinishIssues,
  styleDirectorCandidateCuffIntent,
  styleDirectorCandidateCuffIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("contracted cuff refusals prohibit only the named canonical cuff", () => {
  for (const [text, forbidden] of [
    ["French cuffs shouldn't be selected", "french_double_cuff"],
    ["Cocktail cuffs mustn't be used", "cocktail_cuff"],
    ["Rounded cuffs shouldn’t be chosen", "rounded_soft_cuff"],
    ["Convertible cuffs mustn’t be worn", "convertible_cuff"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateCuffIntent(text), {
      requested: null, prohibited: [forbidden], ambiguous: false,
    }, text);
    const locked = Object.freeze({ cuff: forbidden });
    assert.deepEqual(styleDirectorCandidateCuffIssues(text, locked)
      .map(issue => issue.code), ["candidate_cuff_mismatch"], text);
    assert.deepEqual(styleDirectorCandidateCuffIssues(text, locked)
      .map(issue => issue.code), ["candidate_cuff_mismatch"], "repeat checks must agree");
    assert.equal(locked.cuff, forbidden, "locked cuff ID must not be rewritten");
    assert.deepEqual(styleDirectorCandidateCuffIssues(text, { cuff: "barrel_cuff_1_button" }), [], text);
    assert.deepEqual(styleDirectorCandidateWordingIssues(text)
      .filter(issue => issue.code === "ambiguous_candidate_cuff"), [], text);
  }
  assert.deepEqual(styleDirectorCandidateCuffIntent("French cuffs aren't required"), {
    requested: null, prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateCuffIntent("French cuffs should be selected"), {
    requested: "french_double_cuff", prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateCuffIntent("French cuffs shouldn't be selected; French cuffs required"), {
    requested: "french_double_cuff", prohibited: ["french_double_cuff"], ambiguous: true,
  });
});

test("contracted button refusals never approve a forbidden saved material", () => {
  for (const [text, forbidden] of [
    ["Horn buttons shouldn't be selected", "horn"],
    ["Corozo buttons mustn't be used", "corozo"],
    ["Mother-of-pearl buttons shouldn’t be chosen", "mother_of_pearl"],
    ["Metal buttons mustn’t be worn", "metal_contrast"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateButtonIntent(text), {
      requested: null, prohibited: [forbidden], ambiguous: false,
    }, text);
    const locked = Object.freeze({ button: forbidden });
    const expected = ["candidate_button_mismatch"];
    assert.deepEqual(styleDirectorCandidateButtonIssues(text, locked).map(issue => issue.code), expected, text);
    assert.deepEqual(styleDirectorCandidateButtonIssues(text, locked).map(issue => issue.code), expected, text);
    assert.equal(locked.button, forbidden);
    assert.deepEqual(styleDirectorCandidateButtonIssues(text, { button: "plastic_resin" }), [], text);
    assert.deepEqual(styleDirectorCandidateWordingIssues(text)
      .filter(issue => issue.code === "ambiguous_candidate_button"), [], text);
  }
  assert.deepEqual(styleDirectorCandidateButtonIntent("Horn buttons aren't required"), {
    requested: null, prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateButtonIntent("Horn buttons should be selected"), {
    requested: "horn", prohibited: [], ambiguous: false,
  });
});

test("contracted collar-finish refusals preserve independent treatment options", () => {
  for (const [text, forbidden, prohibited] of [
    ["White contrast collar shouldn't be selected", "White contrast collar",
      ["White contrast collar", "White contrast collar + cuffs"]],
    ["White contrast collar + cuffs mustn't be used", "White contrast collar + cuffs",
      ["White contrast collar + cuffs"]],
    ["Self-fabric shouldn’t be chosen", "Self-fabric", ["Self-fabric"]],
    ["White contrast collar + cuffs mustn’t be worn", "White contrast collar + cuffs",
      ["White contrast collar + cuffs"]],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateCollarFinishIntent(text), {
      requested: null, prohibited: [...prohibited], ambiguous: false,
    }, text);
    const locked = Object.freeze({ collarFinish: forbidden });
    const actual = styleDirectorCandidateCollarFinishIssues(text, locked).map(issue => issue.code);
    assert.deepEqual(actual, ["candidate_collar_finish_mismatch"], text);
    assert.deepEqual(styleDirectorCandidateCollarFinishIssues(text, locked).map(issue => issue.code), actual);
    assert.equal(locked.collarFinish, forbidden);
    const safe = forbidden === "Self-fabric" ? "White contrast collar" : "Self-fabric";
    assert.deepEqual(styleDirectorCandidateCollarFinishIssues(text, { collarFinish: safe }), [], text);
    assert.deepEqual(styleDirectorCandidateWordingIssues(text)
      .filter(issue => issue.code === "ambiguous_candidate_collar_finish"), [], text);
  }
  assert.deepEqual(styleDirectorCandidateCollarFinishIntent("White contrast collar isn't required"), {
    requested: null, prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateCollarFinishIntent("White contrast collar should be selected"), {
    requested: "White contrast collar", prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateCollarFinishIntent(
    "White contrast collar shouldn't be selected; White contrast collar required",
  ).ambiguous, true);
});
