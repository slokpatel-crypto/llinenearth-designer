import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  styleDirectorCandidateButton,
  styleDirectorCandidateButtonIntent,
  styleDirectorCandidateButtonIssues,
  styleDirectorCandidateWordingIssues,
  styleDirectorPresentationIssues,
} from "../src/lib/designer/style-director-compatibility.ts";
import { optionsFor } from "../src/lib/designer/options/library.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

const photoChoices = optionsFor("shirt.button")
  .filter(option => option.legacySelectable !== false)
  .map(option => option.legacyLabel || option.label);
const issueCodes = (candidate: string, button: string) =>
  styleDirectorCandidateButtonIssues(candidate, { button }).map(issue => issue.code);
const wordingCodes = (candidate: string) =>
  styleDirectorCandidateWordingIssues(candidate).map(issue => issue.code);

test("explicit button materials resolve exactly to five existing canonical IDs", () => {
  const cases = [
    ["Mother-of-Pearl Buttons Shirt", "mother_of_pearl", "Mother-of-Pearl"],
    ["Corozo (vegetable ivory) buttons", "corozo", "Corozo (vegetable ivory)"],
    ["Horn Buttons Shirt", "horn", "Horn"],
    ["Plastic / Resin Buttons Shirt", "plastic_resin", "Plastic / Resin"],
    ["Metal / Contrast Buttons Shirt", "metal_contrast", "Metal / Contrast"],
  ] as const;
  for (const [label, id, photo] of cases) {
    assert.ok(optionsFor("shirt.button").some(option => option.id === id), label);
    assert.deepEqual(styleDirectorCandidateButtonIntent(label), {
      requested: id, prohibited: [], ambiguous: false,
    }, label);
    assert.deepEqual(styleDirectorCandidateButton(label, photoChoices), {
      versioned: id, legacy: photo,
    }, label);
    assert.deepEqual(issueCodes(label, id), [], label);
    assert.deepEqual(issueCodes(label, id === "horn" ? "corozo" : "horn"),
      ["candidate_button_mismatch"], label);
    assert.deepEqual(wordingCodes(label), [], label);
  }
});

test("prohibiting a button material does not select it or rewrite the locked material", () => {
  for (const [label, banned] of [
    ["No Horn Buttons", "horn"],
    ["Without Mother-of-Pearl Buttons", "mother_of_pearl"],
    ["Avoid Corozo Buttons", "corozo"],
    ["Metal / Contrast Buttons is forbidden", "metal_contrast"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateButtonIntent(label), {
      requested: null, prohibited: [banned], ambiguous: false,
    }, label);
    assert.equal(styleDirectorCandidateButton(label, photoChoices), null);
    const locked = { button: "plastic_resin" };
    const before = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidateButtonIssues(label, locked), [], label);
    assert.deepEqual(issueCodes(label, banned), ["candidate_button_mismatch"], label);
    assert.deepEqual(wordingCodes(label), [], label);
    assert.equal(JSON.stringify(locked), before);
  }
});

test("optional buttons are neutral and generic button/cuff words are not material identities", () => {
  for (const label of [
    "Optional Horn Buttons",
    "Maybe Metal Buttons",
    "Corozo Buttons is optional",
    "Plastic / Resin Buttons not required",
    "Barrel Cuff (2-button)",
    "Hidden Buttons",
    "Contrast Placket Shirt",
    "Horn Print Shirt",
  ]) {
    assert.deepEqual(styleDirectorCandidateButtonIntent(label), {
      requested: null, prohibited: [], ambiguous: false,
    }, label);
    assert.equal(styleDirectorCandidateButton(label, photoChoices), null, label);
    assert.deepEqual(issueCodes(label, "horn"), [], label);
  }
});

test("different positive materials, and requesting a prohibited one, require manual review", () => {
  for (const label of [
    "Horn Buttons; Corozo Buttons",
    "No Horn Buttons; Horn Buttons",
    "Metal / Contrast Buttons; Plastic / Resin Buttons",
  ]) {
    assert.equal(styleDirectorCandidateButtonIntent(label).ambiguous, true, label);
    assert.equal(styleDirectorCandidateButton(label, photoChoices), null, label);
    assert.deepEqual(wordingCodes(label), ["ambiguous_candidate_button"], label);
    assert.deepEqual(issueCodes(label, "horn"), [], label);
  }
  const compatible = "No Horn Buttons; Corozo Buttons";
  assert.deepEqual(styleDirectorCandidateButtonIntent(compatible), {
    requested: "corozo", prohibited: ["horn"], ambiguous: false,
  });
  assert.deepEqual(issueCodes(compatible, "corozo"), []);
  assert.deepEqual(issueCodes(compatible, "horn"), ["candidate_button_mismatch"]);
});

test("new proposals preserve canonical button material and photographic parity detects a wrong choice", () => {
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("const namedButton = styleDirectorCandidateButton(shirt, DESIGNER_STYLE_CHOICES.button)"));
  assert.ok(agent.includes("const namedButton=styleDirectorCandidateButton(shirt,DESIGNER_STYLE_CHOICES.button)"));
  assert.ok(agent.includes("if (namedButton?.legacy) style.button = namedButton.legacy"));
  assert.ok(agent.includes("if (namedButton) spec.shirt.button=namedButton.versioned"));
  assert.ok(agent.includes("...styleDirectorCandidateButtonIssues(candidate.garments.shirt, styleSpec.shirt)"));
  const saved = { shirt: { collar: "spread_collar", wear: "tucked", button: "horn" } } as unknown as Pick<StyleSpecV2, "shirt">;
  const before = JSON.stringify(saved);
  assert.deepEqual(styleDirectorPresentationIssues({
    collar: "Spread Collar", shirtWear: "Tucked", button: "Horn",
  }, saved).map(issue => issue.code), []);
  assert.deepEqual(styleDirectorPresentationIssues({
    collar: "Spread Collar", shirtWear: "Tucked", button: "Mother-of-Pearl",
  }, saved).map(issue => issue.code), ["legacy_button_mismatch"]);
  assert.equal(JSON.stringify(saved), before, "review may never rewrite locked button material");
});

test("postposed button material bans never silently select a material", () => {
  for (const [label, id] of [
    ["Mother-of-Pearl Buttons", "mother_of_pearl"],
    ["Corozo (vegetable ivory) buttons", "corozo"],
    ["Horn Buttons", "horn"],
    ["Plastic / Resin Buttons", "plastic_resin"],
    ["Metal / Contrast Buttons", "metal_contrast"],
  ] as const) {
    const candidate = `${label} should not be selected`;
    assert.deepEqual(styleDirectorCandidateButtonIntent(candidate), {
      requested: null, prohibited: [id], ambiguous: false,
    }, candidate);
    assert.equal(styleDirectorCandidateButton(candidate, photoChoices), null, candidate);
    const saved = Object.freeze({ button: id });
    const before = JSON.stringify(saved);
    const first = styleDirectorCandidateButtonIssues(candidate, saved);
    assert.deepEqual(first.map(x => x.code), ["candidate_button_mismatch"], candidate);
    assert.deepEqual(styleDirectorCandidateButtonIssues(candidate, saved), first, candidate);
    assert.equal(JSON.stringify(saved), before, "locked material must remain unchanged");
    assert.deepEqual(issueCodes(candidate, id === "horn" ? "corozo" : "horn"), [], candidate);
  }
  for (const candidate of [
    "Horn Buttons aren't wanted",
    "Horn Buttons isn't wanted",
    "Horn Buttons is not wanted",
    "Horn Buttons unwanted",
    "Horn Buttons must not be used",
  ]) {
    assert.deepEqual(styleDirectorCandidateButtonIntent(candidate), {
      requested: null, prohibited: ["horn"], ambiguous: false,
    }, candidate);
    assert.deepEqual(issueCodes(candidate, "horn"), ["candidate_button_mismatch"], candidate);
    assert.deepEqual(issueCodes(candidate, "corozo"), [], candidate);
  }
});

test("optional or contradictory button material wording preserves frozen selections", () => {
  const locked = Object.freeze({ button: "horn" });
  const before = JSON.stringify(locked);
  for (const candidate of [
    "Horn Buttons aren't required",
    "Horn Buttons isn't needed",
    "Horn Buttons isn't mandatory",
    "Horn Buttons is not required",
    "Horn Buttons not needed",
  ]) {
    assert.deepEqual(styleDirectorCandidateButtonIntent(candidate), {
      requested: null, prohibited: [], ambiguous: false,
    }, candidate);
    assert.equal(styleDirectorCandidateButton(candidate, photoChoices), null, candidate);
    assert.deepEqual(styleDirectorCandidateButtonIssues(candidate, locked), [], candidate);
  }
  const contradictory = "Horn Buttons; Horn Buttons aren't wanted";
  assert.equal(styleDirectorCandidateButtonIntent(contradictory).ambiguous, true);
  assert.equal(styleDirectorCandidateButton(contradictory, photoChoices), null);
  assert.deepEqual(wordingCodes(contradictory), ["ambiguous_candidate_button"]);
  assert.deepEqual(styleDirectorCandidateButtonIssues(contradictory, locked), []);
  assert.equal(JSON.stringify(locked), before, "review must not mutate locked material");
});

test("with-or-without button materials require review and cannot rewrite locked IDs", () => {
  for (const [label] of [
    ["Mother-of-Pearl Buttons"],
    ["Corozo (vegetable ivory) buttons"],
    ["Horn Buttons"],
    ["Plastic / Resin Buttons"],
    ["Metal / Contrast Buttons"],
  ] as const) {
    for (const phrase of [
      "with or without " + label,
      "with or without any " + label,
      "with without " + label,
    ]) {
      assert.deepEqual(styleDirectorCandidateButtonIntent(phrase), {
        requested: null, prohibited: [], ambiguous: true,
      }, phrase);
      assert.equal(styleDirectorCandidateButton(phrase, photoChoices), null, phrase);
      assert.deepEqual(wordingCodes(phrase), ["ambiguous_candidate_button"], phrase);
      for (const id of [
        "mother_of_pearl", "corozo", "horn", "plastic_resin", "metal_contrast",
      ]) {
        const saved = Object.freeze({ button: id });
        const original = JSON.stringify(saved);
        assert.deepEqual(styleDirectorCandidateButtonIssues(phrase, saved), [], phrase);
        assert.equal(JSON.stringify(saved), original, "locked button material must not change");
      }
    }
  }
});

test("unresolved buttons preserve independent positive and negative requests", () => {
  const mixed = "with or without Horn Buttons; no Corozo Buttons";
  assert.deepEqual(styleDirectorCandidateButtonIntent(mixed), {
    requested: null, prohibited: ["corozo"], ambiguous: true,
  });
  assert.deepEqual(wordingCodes(mixed), ["ambiguous_candidate_button"]);
  const positive = "with or without Horn Buttons; Metal Buttons required";
  assert.deepEqual(styleDirectorCandidateButtonIntent(positive), {
    requested: "metal_contrast", prohibited: [], ambiguous: true,
  });
  assert.deepEqual(wordingCodes(positive), ["ambiguous_candidate_button"]);
  assert.deepEqual(styleDirectorCandidateButtonIntent("No Horn Buttons"), {
    requested: null, prohibited: ["horn"], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateButtonIntent("Horn Buttons"), {
    requested: "horn", prohibited: [], ambiguous: false,
  });
});
