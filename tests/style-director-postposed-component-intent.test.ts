import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorCandidatePlacketIntent,
  styleDirectorCandidatePlacketIssues,
  styleDirectorCandidateCuffIntent,
  styleDirectorCandidateCuffIssues,
  styleDirectorCandidateButtonIntent,
  styleDirectorCandidateButtonIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

// The customer's prohibition must never be reinterpreted as an affirmative
// cut or material choice, and must never mutate a versioned locked selection.
const components = [
  {
    kind: "placket",
    id: "french_placket",
    alternativeId: "covered_placket",
    named: "French placket",
    alternative: "covered placket",
    intent: styleDirectorCandidatePlacketIntent,
    issues: (name: string, id: string) =>
      styleDirectorCandidatePlacketIssues(name, Object.freeze({ placket: id })),
    reviewCode: "candidate_placket_mismatch",
    ambiguityCode: "ambiguous_candidate_placket",
  },
  {
    kind: "cuff",
    id: "french_double_cuff",
    alternativeId: "convertible_cuff",
    named: "French cuffs",
    alternative: "convertible cuffs",
    intent: styleDirectorCandidateCuffIntent,
    issues: (name: string, id: string) =>
      styleDirectorCandidateCuffIssues(name, Object.freeze({ cuff: id })),
    reviewCode: "candidate_cuff_mismatch",
    ambiguityCode: "ambiguous_candidate_cuff",
  },
  {
    kind: "button",
    id: "horn",
    alternativeId: "corozo",
    named: "Horn buttons",
    alternative: "corozo buttons",
    intent: styleDirectorCandidateButtonIntent,
    issues: (name: string, id: string) =>
      styleDirectorCandidateButtonIssues(name, Object.freeze({ button: id })),
    reviewCode: "candidate_button_mismatch",
    ambiguityCode: "ambiguous_candidate_button",
  },
] as const;

test("unwanted component instructions ban the named construction instead of selecting it", () => {
  for (const item of components) {
    for (const ending of [
      "is not wanted", "isn't wanted", "isn’t wanted",
      "unwanted", "should not be selected", "must not be used",
    ]) {
      const phrase = `${item.named} ${ending}`;
      const intent = item.intent(phrase);
      assert.deepEqual(intent, {
        requested: null, prohibited: [item.id], ambiguous: false,
      }, `${item.kind}: ${phrase}`);
      const issues = item.issues(phrase, item.id);
      assert.deepEqual(issues.map(issue => issue.code), [item.reviewCode], phrase);
      assert.deepEqual(item.issues(phrase, item.alternativeId), [], phrase);
      assert.deepEqual(item.issues(phrase, item.id), issues, "deterministic replay");
    }
  }
});

test("contracted non-required instructions do not select or prohibit material and construction", () => {
  for (const item of components) {
    for (const ending of [
      "is not required", "isn't needed", "isn’t mandatory",
      "is optional", "unnecessary",
    ]) {
      const phrase = `${item.named} ${ending}`;
      assert.deepEqual(item.intent(phrase), {
        requested: null, prohibited: [], ambiguous: false,
      }, `${item.kind}: ${phrase}`);
      assert.deepEqual(item.issues(phrase, item.id), [], phrase);
    }
  }
});

test("positive requirements and independent bans remain distinct", () => {
  for (const item of components) {
    assert.deepEqual(item.intent(`${item.named} required`), {
      requested: item.id, prohibited: [], ambiguous: false,
    }, item.kind);
    const phrase = `${item.named} isn't wanted; ${item.alternative} required`;
    assert.deepEqual(item.intent(phrase), {
      requested: item.alternativeId,
      prohibited: [item.id],
      ambiguous: false,
    }, item.kind);
    assert.deepEqual(item.issues(phrase, item.alternativeId), [], item.kind);
    assert.deepEqual(item.issues(phrase, item.id).map(issue => issue.code),
      [item.reviewCode], item.kind);
  }
});

test("contradictory bans and requests require review without rewriting locked IDs", () => {
  for (const item of components) {
    const phrase = `${item.named} isn't wanted; ${item.named} required`;
    const intent = item.intent(phrase);
    assert.equal(intent.ambiguous, true, `${item.kind}: contradictory request`);
    assert.ok(styleDirectorCandidateWordingIssues(phrase)
      .some(issue => issue.code === item.ambiguityCode), item.kind);
    const locked = Object.freeze({ id: item.id });
    assert.deepEqual(item.intent(phrase), intent, "immutable deterministic intent");
    assert.equal(locked.id, item.id);
  }
});
