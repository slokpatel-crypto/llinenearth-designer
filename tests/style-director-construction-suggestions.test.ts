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
      assert.ok(issues.some(issue => issue.code === suggestion.cause),
        `${scenario.name}: suggestion must derive from a live compatibility issue`);
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
