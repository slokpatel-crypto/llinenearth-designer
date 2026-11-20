import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorConstructionIssues,
  styleDirectorConstructionSuggestions,
} from "../src/lib/designer/style-director-compatibility.ts";
import { optionsFor } from "../src/lib/designer/options/library.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

// The source of truth is always the saved canonical ID, never a replacement
// manufactured from display text, fabric guesses, or a photographic preview.
function makeSpec(): StyleSpecV2 {
  return {
    shirt: {
      type: "dress_shirt", collar: "spread_collar", wear: "tucked",
      sleeve: "full_sleeve", cuff: "barrel_cuff_1_button",
    },
    pant: {
      type: "formal_flat_front", fit: "straight_classic", pleat: "flat_front",
      rise: "mid_rise", waistband: "belt_loops",
      hem: "plain_hem", break: "slight_break",
    },
  } as StyleSpecV2;
}

test("construction alternatives cover distinct, catalogue-backed tailoring decisions", () => {
  const cases: Array<{
    name: string;
    alter: (spec: StyleSpecV2) => void;
    expected: Array<[string, string]>;
  }> = [
    {
      name: "flat front with a pleat",
      alter: spec => { spec.pant.pleat = "single_pleat_forward"; },
      expected: [["pant.pleat", "flat_front"]],
    },
    {
      name: "high-rise type with mid rise",
      alter: spec => {
        spec.pant.type = "double_pleat_high_rise";
        spec.pant.pleat = "double_pleat_reverse";
      },
      expected: [["pant.rise", "high_rise"]],
    },
    {
      name: "Gurkha without tab waistband",
      alter: spec => { spec.pant.type = "gurkha"; },
      expected: [["pant.waistband", "extended_tab"]],
    },
    {
      name: "linen drawstring trouser with belt loops",
      alter: spec => { spec.pant.type = "linen_drawstring"; },
      expected: [["pant.waistband", "drawstring_elastic"]],
    },
    {
      name: "wide leg with tapered fit",
      alter: spec => {
        spec.pant.type = "wide_leg_relaxed_drape";
        spec.pant.fit = "slim_tapered";
      },
      expected: [["pant.fit", "wide_leg_drape"]],
    },
    {
      name: "cropped trouser with long hem and shoe break",
      alter: spec => { spec.pant.type = "cropped_ankle"; },
      expected: [["pant.hem", "cropped_above_ankle_hem"], ["pant.break", "no_break"]],
    },
    {
      name: "short sleeve with French cuff",
      alter: spec => {
        spec.shirt.sleeve = "half_sleeve";
        spec.shirt.cuff = "french_double_cuff";
      },
      expected: [["shirt.cuff", "open_short_hem_cuff"]],
    },
  ];
  for (const scenario of cases) {
    const locked = makeSpec();
    scenario.alter(locked);
    const before = JSON.stringify(locked);
    Object.freeze(locked.shirt);
    Object.freeze(locked.pant);
    Object.freeze(locked);
    const first = styleDirectorConstructionSuggestions(locked);
    assert.deepEqual(first.map(item => [item.optionGroup, item.proposedId]),
      scenario.expected, scenario.name);
    assert.deepEqual(styleDirectorConstructionSuggestions(locked), first,
      `${scenario.name}: deterministic suggestions`);
    assert.equal(JSON.stringify(locked), before,
      `${scenario.name}: never rewrite locked IDs`);
    assert.equal(new Set(first.map(item => item.optionGroup)).size, first.length,
      `${scenario.name}: do not offer duplicate field changes`);
    const issues = styleDirectorConstructionIssues(locked);
    for (const suggestion of first) {
      const [garment, key] = suggestion.optionGroup.split(".") as ["shirt" | "pant", string];
      const candidate = {
        ...locked,
        [garment]: { ...locked[garment], [key]: suggestion.proposedId },
      } as StyleSpecV2;
      const countCodes = (all: ReturnType<typeof styleDirectorConstructionIssues>) => {
        const counts = new Map<string, number>();
        for (const issue of all) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
        return counts;
      };
      const originalCounts = countCodes(issues);
      const candidateCounts = countCodes(styleDirectorConstructionIssues(candidate));
      for (const [code, count] of candidateCounts) {
        assert.ok(count <= (originalCounts.get(code) ?? 0),
          `${scenario.name}: suggestion must not add another instance of ${code}`);
      }
      assert.ok(issues.some(issue => issue.code === suggestion.cause),
        `${scenario.name}: suggestion must derive from a live compatibility issue`);
      const countCause = (candidateIssues: ReturnType<typeof styleDirectorConstructionIssues>) =>
        candidateIssues.filter(issue => issue.code === suggestion.cause).length;
      assert.ok(countCause(styleDirectorConstructionIssues(candidate)) < countCause(issues),
        `${scenario.name}: proposed change must resolve its named construction fault`);
      assert.ok(optionsFor(suggestion.optionGroup).some(option =>
        option.id === suggestion.proposedId),
        `${scenario.name}: proposal must be an existing catalogue ID`);
      assert.ok(optionsFor(suggestion.optionGroup).some(option =>
        option.id === suggestion.savedId),
        `${scenario.name}: current saved ID must be valid`);
      assert.notEqual(suggestion.savedId, suggestion.proposedId);
      assert.ok(suggestion.explanation.length > 0);
    }
  }
});

test("several independent faults produce review alternatives without auto-fixing either", () => {
  const locked = makeSpec();
  locked.pant.type = "wide_leg_relaxed_drape";
  locked.pant.fit = "slim_tapered";
  locked.pant.hem = "cropped_above_ankle_hem";
  locked.pant.break = "stacked_break";
  const before = JSON.stringify(locked);
  const suggestions = styleDirectorConstructionSuggestions(locked);
  assert.deepEqual(suggestions.map(x => [x.optionGroup, x.proposedId]), [
    ["pant.fit", "wide_leg_drape"],
    ["pant.break", "no_break"],
  ]);
  // Validate the complete recommendation bundle, not only each individual
  // change against the original locked design.
  const countIssues = (spec: StyleSpecV2) => {
    const counts = new Map<string, number>();
    for (const issue of styleDirectorConstructionIssues(spec)) {
      counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
    }
    return counts;
  };
  let previous = countIssues(locked);
  const combined = suggestions.reduce((candidate, suggestion) => {
    const [garment, key] = suggestion.optionGroup.split(".") as ["shirt" | "pant", string];
    const next = {
      ...candidate,
      [garment]: { ...candidate[garment], [key]: suggestion.proposedId },
    } as StyleSpecV2;
    const after = countIssues(next);
    for (const [code, count] of after) {
      assert.ok(count <= (previous.get(code) ?? 0),
        `each sequential suggestion must not restore an already resolved conflict: ${code}`);
    }
    assert.ok((after.get(suggestion.cause) ?? 0) < (previous.get(suggestion.cause) ?? 0),
      `each suggestion must resolve its cause: ${suggestion.cause}`);
    previous = after;
    return next;
  }, locked);
  const originalCodes = new Set(styleDirectorConstructionIssues(locked).map(x => x.code));
  assert.deepEqual(styleDirectorConstructionIssues(combined).filter(issue =>
    !originalCodes.has(issue.code)), [],
    "applying all independent review suggestions together must not introduce a contradiction");
  assert.deepEqual(styleDirectorConstructionSuggestions(locked), suggestions);
  assert.equal(JSON.stringify(locked), before);
});

test("unsupported or missing saved IDs never receive a fabricated alternative", () => {
  const invalid = makeSpec();
  invalid.pant.type = "wide_leg_relaxed_drape";
  invalid.pant.fit = "retired_fit";
  assert.deepEqual(styleDirectorConstructionSuggestions(invalid), []);

  const absent = makeSpec();
  delete (absent.pant as Partial<StyleSpecV2["pant"]>).fit;
  assert.deepEqual(styleDirectorConstructionSuggestions(absent), []);

  const noIssues = makeSpec();
  assert.deepEqual(styleDirectorConstructionSuggestions(noIssues), []);
});

test("do not offer a flat-front change that contradicts a separately locked pleated fit", () => {
  const spec = makeSpec();
  spec.pant.type = "formal_flat_front";
  spec.pant.pleat = "single_pleat_forward";
  spec.pant.fit = "pleated_straight";
  const before = JSON.stringify(spec);
  Object.freeze(spec.shirt);
  Object.freeze(spec.pant);
  Object.freeze(spec);
  assert.ok(styleDirectorConstructionIssues(spec).some(issue =>
    issue.code === "flat_front_has_pleat"));
  assert.deepEqual(styleDirectorConstructionSuggestions(spec), [],
    "do not fix one construction choice by creating another incompatibility");
  assert.equal(JSON.stringify(spec), before);

  const independentlySelectable = makeSpec();
  independentlySelectable.pant.pleat = "single_pleat_forward";
  assert.deepEqual(styleDirectorConstructionSuggestions(independentlySelectable).map(x =>
    [x.optionGroup, x.proposedId]), [["pant.pleat", "flat_front"]],
    "existing safe canonical suggestion must remain available");
});

test("working conflict snapshot preserves a deterministic frozen multi-repair sequence", () => {
  const locked = makeSpec();
  locked.pant.type = "cropped_ankle";
  locked.pant.fit = "slim_tapered";
  locked.pant.hem = "plain_hem";
  locked.pant.break = "full_break";
  const original = JSON.stringify(locked);
  Object.freeze(locked.shirt);
  Object.freeze(locked.pant);
  Object.freeze(locked);
  const first = styleDirectorConstructionSuggestions(locked);
  assert.deepEqual(first.map(x => [x.optionGroup, x.proposedId]), [
    ["pant.hem", "cropped_above_ankle_hem"],
    ["pant.break", "no_break"],
  ]);
  for (let iteration = 0; iteration < 5; iteration++) {
    assert.deepEqual(styleDirectorConstructionSuggestions(locked), first);
  }
  assert.equal(JSON.stringify(locked), original);
  const candidate = {
    ...locked,
    pant: { ...locked.pant, hem: "cropped_above_ankle_hem", break: "no_break" },
  };
  assert.ok(styleDirectorConstructionIssues(candidate).length <
    styleDirectorConstructionIssues(locked).length);
});
