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

test("unknown saved garment types cannot certify a construction alternative", () => {
  const retiredPant = makeSpec();
  retiredPant.pant.type = "retired_trouser_type" as StyleSpecV2["pant"]["type"];
  retiredPant.pant.fit = "slim_tapered";
  retiredPant.pant.pleat = "single_pleat_forward";
  retiredPant.pant.hem = "plain_hem";
  assert.deepEqual(styleDirectorConstructionSuggestions(retiredPant), [],
    "retired trouser silhouettes must not receive canonical component guesses");

  const absentPant = makeSpec();
  absentPant.pant.type = "wide_leg_relaxed_drape";
  absentPant.pant.fit = "slim_tapered";
  delete (absentPant.pant as Partial<StyleSpecV2["pant"]>).type;
  assert.deepEqual(styleDirectorConstructionSuggestions(absentPant), []);

  const validPant = makeSpec();
  validPant.pant.type = "wide_leg_relaxed_drape";
  validPant.pant.fit = "slim_tapered";
  assert.deepEqual(styleDirectorConstructionSuggestions(validPant).map(x =>
    [x.optionGroup, x.proposedId]), [["pant.fit", "wide_leg_drape"]],
    "valid saved type retains the existing recommendation");

  const retiredShirt = makeSpec();
  retiredShirt.shirt.type = "retired_shirt_type" as StyleSpecV2["shirt"]["type"];
  retiredShirt.shirt.sleeve = "half_sleeve";
  retiredShirt.shirt.cuff = "french_double_cuff";
  assert.deepEqual(styleDirectorConstructionSuggestions(retiredShirt), []);
});

test("retired sibling construction IDs prevent unprovable alternatives for that garment", () => {
  const locked = makeSpec();
  locked.pant.type = "wide_leg_relaxed_drape";
  locked.pant.fit = "slim_tapered";
  locked.pant.rise = "retired_rise" as StyleSpecV2["pant"]["rise"];
  const original = JSON.stringify(locked);
  Object.freeze(locked.shirt);
  Object.freeze(locked.pant);
  Object.freeze(locked);
  assert.ok(styleDirectorConstructionIssues(locked).some(issue =>
    issue.code === "wide_leg_tapered_fit_mismatch"));
  assert.deepEqual(styleDirectorConstructionSuggestions(locked), [],
    "a valid type does not prove compatibility with a retired sibling option");
  assert.equal(JSON.stringify(locked), original);

  const known = makeSpec();
  known.pant.type = "wide_leg_relaxed_drape";
  known.pant.fit = "slim_tapered";
  assert.deepEqual(styleDirectorConstructionSuggestions(known).map(x =>
    [x.optionGroup, x.proposedId]), [["pant.fit", "wide_leg_drape"]]);

  const independent = makeSpec();
  independent.shirt.sleeve = "half_sleeve";
  independent.shirt.cuff = "french_double_cuff";
  independent.pant.rise = "retired_rise" as StyleSpecV2["pant"]["rise"];
  assert.deepEqual(styleDirectorConstructionSuggestions(independent).map(x =>
    [x.optionGroup, x.proposedId]), [["shirt.cuff", "open_short_hem_cuff"]],
    "invalid trouser option must not suppress independent valid shirt guidance");
});

test("missing linked construction IDs cannot certify otherwise valid repairs", () => {
  const missingPantRise = makeSpec();
  missingPantRise.pant.type = "wide_leg_relaxed_drape";
  missingPantRise.pant.fit = "slim_tapered";
  delete (missingPantRise.pant as Partial<StyleSpecV2["pant"]>).rise;
  const beforePant = JSON.stringify(missingPantRise);
  Object.freeze(missingPantRise.shirt);
  Object.freeze(missingPantRise.pant);
  Object.freeze(missingPantRise);
  assert.ok(styleDirectorConstructionIssues(missingPantRise).some(issue =>
    issue.code === "wide_leg_tapered_fit_mismatch"));
  assert.deepEqual(styleDirectorConstructionSuggestions(missingPantRise), []);
  assert.equal(JSON.stringify(missingPantRise), beforePant);

  const missingShirtSleeve = makeSpec();
  missingShirtSleeve.shirt.sleeve = "half_sleeve";
  missingShirtSleeve.shirt.cuff = "french_double_cuff";
  delete (missingShirtSleeve.shirt as Partial<StyleSpecV2["shirt"]>).sleeve;
  assert.deepEqual(styleDirectorConstructionSuggestions(missingShirtSleeve), []);

  const independentShirt = makeSpec();
  independentShirt.shirt.sleeve = "half_sleeve";
  independentShirt.shirt.cuff = "french_double_cuff";
  independentShirt.pant.type = "wide_leg_relaxed_drape";
  independentShirt.pant.fit = "slim_tapered";
  delete (independentShirt.pant as Partial<StyleSpecV2["pant"]>).rise;
  assert.deepEqual(styleDirectorConstructionSuggestions(independentShirt).map(x =>
    [x.optionGroup, x.proposedId]), [["shirt.cuff", "open_short_hem_cuff"]],
    "missing trouser data must not suppress an independent valid shirt repair");

  const complete = makeSpec();
  complete.pant.type = "wide_leg_relaxed_drape";
  complete.pant.fit = "slim_tapered";
  assert.deepEqual(styleDirectorConstructionSuggestions(complete).map(x =>
    [x.optionGroup, x.proposedId]), [["pant.fit", "wide_leg_drape"]]);
});

test("canonical linked option groups guard missing waistband without suppressing independent shirt repairs", () => {
  const locked = makeSpec();
  locked.pant.type = "wide_leg_relaxed_drape";
  locked.pant.fit = "slim_tapered";
  delete (locked.pant as Partial<StyleSpecV2["pant"]>).waistband;
  locked.shirt.sleeve = "half_sleeve";
  locked.shirt.cuff = "french_double_cuff";
  const before = JSON.stringify(locked);
  Object.freeze(locked.shirt);
  Object.freeze(locked.pant);
  Object.freeze(locked);
  assert.deepEqual(styleDirectorConstructionSuggestions(locked).map(x =>
    [x.optionGroup, x.proposedId]), [["shirt.cuff", "open_short_hem_cuff"]]);
  assert.equal(JSON.stringify(locked), before);

  const complete = makeSpec();
  complete.pant.type = "wide_leg_relaxed_drape";
  complete.pant.fit = "slim_tapered";
  assert.deepEqual(styleDirectorConstructionSuggestions(complete).map(x =>
    [x.optionGroup, x.proposedId]), [["pant.fit", "wide_leg_drape"]]);
});

test("accessor-backed ancillary fields cannot execute during advisory garment copying", () => {
  const spec = makeSpec();
  spec.pant.type = "wide_leg_relaxed_drape";
  spec.pant.fit = "slim_tapered";
  let getterCalls = 0;
  Object.defineProperty(spec.pant, "untrustedLegacyField", {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls++;
      throw new Error("must not evaluate a saved accessor");
    },
  });
  assert.deepEqual(styleDirectorConstructionSuggestions(spec), [],
    "accessor-backed trouser data must not produce a construction repair");
  assert.equal(getterCalls, 0, "advisory review must not invoke a hostile getter");

  const independent = makeSpec();
  independent.shirt.sleeve = "half_sleeve";
  independent.shirt.cuff = "french_double_cuff";
  independent.pant.type = "wide_leg_relaxed_drape";
  independent.pant.fit = "slim_tapered";
  Object.defineProperty(independent.pant, "untrustedLegacyField", {
    enumerable: true,
    get() { throw new Error("must not evaluate a saved accessor"); },
  });
  assert.deepEqual(styleDirectorConstructionSuggestions(independent).map(x =>
    [x.optionGroup, x.proposedId]), [["shirt.cuff", "open_short_hem_cuff"]],
    "unsafe trouser data must not suppress a valid independent shirt suggestion");
});


test("unrelated saved-spec accessors are never evaluated while reviewing construction", () => {
  const locked = makeSpec();
  locked.pant.type = "wide_leg_relaxed_drape";
  locked.pant.fit = "slim_tapered";
  locked.shirt.sleeve = "half_sleeve";
  locked.shirt.cuff = "french_double_cuff";
  let getterCalls = 0;
  Object.defineProperty(locked, "legacyExtension", {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls++;
      throw new Error("unrelated saved-spec accessor must not run");
    },
  });
  Object.freeze(locked.shirt);
  Object.freeze(locked.pant);
  Object.freeze(locked);
  const first = styleDirectorConstructionSuggestions(locked);
  assert.deepEqual(first.map(item => [item.optionGroup, item.proposedId]), [
    ["shirt.cuff", "open_short_hem_cuff"],
    ["pant.fit", "wide_leg_drape"],
  ]);
  assert.deepEqual(styleDirectorConstructionSuggestions(locked), first);
  assert.equal(getterCalls, 0);
  assert.equal(locked.pant.fit, "slim_tapered");
  assert.equal(locked.shirt.cuff, "french_double_cuff");
});


test("prototype-backed garment records cannot execute inherited accessors during review", () => {
  const inherited = makeSpec();
  inherited.pant.type = "wide_leg_relaxed_drape";
  inherited.pant.fit = "slim_tapered";
  let getterCalls = 0;
  const prototype = Object.create(Object.prototype);
  Object.defineProperty(prototype, "legacyConstruction", {
    get() { getterCalls++; throw new Error("inherited getter must not run"); },
  });
  Object.setPrototypeOf(inherited.pant, prototype);
  assert.deepEqual(styleDirectorConstructionSuggestions(inherited), []);
  assert.equal(getterCalls, 0);
  assert.equal(inherited.pant.fit, "slim_tapered");

  const accessorRoot = makeSpec();
  Object.defineProperty(accessorRoot, "pant", {
    enumerable: true,
    get() { throw new Error("root garment accessor must not run"); },
  });
  assert.deepEqual(styleDirectorConstructionSuggestions(accessorRoot), []);

  const nullPrototype = makeSpec();
  nullPrototype.pant.type = "wide_leg_relaxed_drape";
  nullPrototype.pant.fit = "slim_tapered";
  Object.setPrototypeOf(nullPrototype.pant, null);
  assert.deepEqual(styleDirectorConstructionSuggestions(nullPrototype).map(x =>
    [x.optionGroup, x.proposedId]), [["pant.fit", "wide_leg_drape"]]);
});


test("malformed root payloads fail closed without inventing construction alternatives", () => {
  for (const invalid of [null, undefined, 0, "", false]) {
    assert.deepEqual(
      styleDirectorConstructionSuggestions(invalid as unknown as StyleSpecV2),
      [],
      `malformed saved payload ${String(invalid)} must not be reviewed`,
    );
  }
  const valid = makeSpec();
  valid.pant.type = "wide_leg_relaxed_drape";
  valid.pant.fit = "slim_tapered";
  assert.deepEqual(styleDirectorConstructionSuggestions(valid).map(x => x.proposedId),
    ["wide_leg_drape"], "valid saved garment guidance remains unchanged");
});

test("prototype-backed saved-spec roots cannot certify construction repairs", () => {
  const inherited = makeSpec();
  inherited.pant.type = "wide_leg_relaxed_drape";
  inherited.pant.fit = "slim_tapered";
  let getterCalls = 0;
  const prototype = Object.create(Object.prototype);
  Object.defineProperty(prototype, "legacyApproval", {
    get() { getterCalls++; throw new Error("inherited root getter must not run"); },
  });
  Object.setPrototypeOf(inherited, prototype);
  assert.deepEqual(styleDirectorConstructionSuggestions(inherited), []);
  assert.equal(getterCalls, 0);
  assert.equal(inherited.pant.fit, "slim_tapered");

  const plain = makeSpec();
  plain.pant.type = "wide_leg_relaxed_drape";
  plain.pant.fit = "slim_tapered";
  Object.setPrototypeOf(plain, null);
  assert.deepEqual(styleDirectorConstructionSuggestions(plain).map(x =>
    [x.optionGroup, x.proposedId]), [["pant.fit", "wide_leg_drape"]],
    "null-prototype JSON-shaped root remains supported");
});

test("accessor-backed required construction fields fail closed before issue evaluation", () => {
  for (const [garment, field] of [
    ["shirt", "sleeve"],
    ["shirt", "cuff"],
    ["pant", "type"],
    ["pant", "fit"],
  ] as const) {
    const locked = makeSpec();
    locked.shirt.sleeve = "half_sleeve";
    locked.shirt.cuff = "french_double_cuff";
    locked.pant.type = "wide_leg_relaxed_drape";
    locked.pant.fit = "slim_tapered";
    let getterCalls = 0;
    Object.defineProperty(locked[garment], field, {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls++;
        throw new Error("required construction getter must not execute");
      },
    });
    assert.deepEqual(styleDirectorConstructionSuggestions(locked), [],
      `unsafe ${garment}.${field} must not generate construction guidance`);
    assert.equal(getterCalls, 0);
  }

  const valid = makeSpec();
  valid.shirt.sleeve = "half_sleeve";
  valid.shirt.cuff = "french_double_cuff";
  assert.deepEqual(styleDirectorConstructionSuggestions(valid).map(x =>
    [x.optionGroup, x.proposedId]), [["shirt.cuff", "open_short_hem_cuff"]]);
});

test("retired optional shirt construction IDs block unsupported cuff advice", () => {
  for (const field of ["collar", "placket", "wear", "fit"] as const) {
    const spec = makeSpec();
    spec.shirt.sleeve = "half_sleeve";
    spec.shirt.cuff = "french_double_cuff";
    spec.pant.type = "wide_leg_relaxed_drape";
    spec.pant.fit = "slim_tapered";
    (spec.shirt as unknown as Record<string, string>)[field] = "retired_legacy_option";
    const before = JSON.stringify(spec);
    assert.deepEqual(styleDirectorConstructionSuggestions(spec).map(x =>
      [x.optionGroup, x.proposedId]), [["pant.fit", "wide_leg_drape"]],
      `unknown shirt.${field} must not suppress independent trouser advice`);
    assert.equal(JSON.stringify(spec), before, "saved design must remain unchanged");
  }
  const valid = makeSpec();
  valid.shirt.sleeve = "half_sleeve";
  valid.shirt.cuff = "french_double_cuff";
  assert.deepEqual(styleDirectorConstructionSuggestions(valid).map(x =>
    [x.optionGroup, x.proposedId]), [["shirt.cuff", "open_short_hem_cuff"]]);
});

test("retired shirt button and pocket IDs withhold cuff changes but preserve independent pant advice", () => {
  for (const field of ["button", "pocket"] as const) {
    const spec = makeSpec();
    spec.shirt.sleeve = "half_sleeve";
    spec.shirt.cuff = "french_double_cuff";
    spec.pant.type = "wide_leg_relaxed_drape";
    spec.pant.fit = "slim_tapered";
    (spec.shirt as unknown as Record<string, string>)[field] = "retired_legacy_option";
    const before = JSON.stringify(spec);
    Object.freeze(spec.shirt);
    Object.freeze(spec.pant);
    Object.freeze(spec);
    assert.deepEqual(styleDirectorConstructionSuggestions(spec).map(x =>
      [x.optionGroup, x.proposedId]), [["pant.fit", "wide_leg_drape"]],
      `retired shirt.${field} cannot certify a cuff construction alternative`);
    assert.equal(JSON.stringify(spec), before);
  }
  const valid = makeSpec();
  valid.shirt.sleeve = "half_sleeve";
  valid.shirt.cuff = "french_double_cuff";
  assert.deepEqual(styleDirectorConstructionSuggestions(valid).map(x =>
    [x.optionGroup, x.proposedId]), [["shirt.cuff", "open_short_hem_cuff"]]);
});


test("optional shirt accessors cannot run before construction review", () => {
  for (const field of ["button", "pocket", "collarFinish"] as const) {
    const spec = makeSpec();
    spec.shirt.sleeve = "half_sleeve";
    spec.shirt.cuff = "french_double_cuff";
    spec.pant.type = "wide_leg_relaxed_drape";
    spec.pant.fit = "slim_tapered";
    let getterCalls = 0;
    Object.defineProperty(spec.shirt, field, {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls++;
        throw new Error("untrusted optional shirt getter must not run");
      },
    });
    assert.deepEqual(styleDirectorConstructionSuggestions(spec), [],
      `unsafe shirt.${field} must fail closed before evaluating issues`);
    assert.equal(getterCalls, 0);
  }

  const valid = makeSpec();
  valid.shirt.sleeve = "half_sleeve";
  valid.shirt.cuff = "french_double_cuff";
  assert.deepEqual(styleDirectorConstructionSuggestions(valid).map(x =>
    [x.optionGroup, x.proposedId]), [["shirt.cuff", "open_short_hem_cuff"]]);
});
