import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorConstructionIssues,
  styleDirectorProposedCroppedHem,
} from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

// A photo's cropped-length label is not permission to alter a saved hem.
// Every footwear break incompatible with a cropped hem must remain review-only.
test("cropped trouser length conflicts are deterministic and non-destructive", () => {
  const conflictingBreaks = [
    ["full_break", "cropped_full_break"],
    ["half_break", "cropped_half_break"],
    ["slight_break", "cropped_slight_break"],
    ["stacked_break", "cropped_stacked_break"],
  ] as const;
  for (const [shoeBreak, expectedCode] of conflictingBreaks) {
    const locked = {
      shirt: { type: "dress_shirt", collar: "spread_collar", wear: "tucked",
        sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" },
      pant: { type: "cropped_ankle", pleat: "flat_front",
        hem: "cropped_above_ankle_hem", break: shoeBreak },
    } as unknown as StyleSpecV2;
    const snapshot = JSON.stringify(locked);
    const first = styleDirectorConstructionIssues(locked);
    assert.ok(first.some(issue => issue.code === expectedCode), shoeBreak);
    assert.deepEqual(styleDirectorConstructionIssues(locked), first, shoeBreak);
    assert.equal(styleDirectorProposedCroppedHem(locked.pant), null, shoeBreak);
    assert.equal(JSON.stringify(locked), snapshot, "saved IDs must not be rewritten");
  }
});

test("matching cropped proposal is a suggestion, never a locked-design mutation", () => {
  const pant = { type: "cropped_ankle", break: "cropped_above_ankle",
    hem: "plain_hem" } as const;
  const original = JSON.stringify(pant);
  assert.equal(styleDirectorProposedCroppedHem(pant), "cropped_above_ankle_hem");
  assert.equal(JSON.stringify(pant), original);
  assert.equal(styleDirectorProposedCroppedHem({
    type: "formal_flat_front", break: "cropped_above_ankle",
  }), null);
});

test("cropped hem proposal fails closed for missing or unrecognized break IDs", () => {
  for (const shoeBreak of [undefined, null, "", "cropped_above_ankle ", "full_break", "stacked_break", "unknown"]) {
    const pant = Object.freeze({
      type: "cropped_ankle",
      break: shoeBreak,
      hem: "plain_hem",
    });
    const snapshot = JSON.stringify(pant);
    const input = pant as unknown as Parameters<typeof styleDirectorProposedCroppedHem>[0];
    assert.equal(styleDirectorProposedCroppedHem(input), null,
      "an invalid or incompatible break must not authorize a cropped hem");
    assert.equal(styleDirectorProposedCroppedHem(input), null, "replay must be stable");
    assert.equal(JSON.stringify(pant), snapshot, "proposal must not mutate the saved pant");
  }
});

test("cropped hem proposal rejects incompatible or malformed trouser type IDs", () => {
  for (const type of [undefined, null, "", "cropped_ankle ", "formal_flat_front", "unknown"]) {
    const pant = Object.freeze({
      type,
      break: "cropped_above_ankle",
      hem: "plain_hem",
    });
    const original = JSON.stringify(pant);
    const input = pant as unknown as Parameters<typeof styleDirectorProposedCroppedHem>[0];
    assert.equal(styleDirectorProposedCroppedHem(input), null,
      "a matching break cannot authorize a cropped hem for another trouser type");
    assert.equal(styleDirectorProposedCroppedHem(input), null, "replay must be stable");
    assert.equal(JSON.stringify(pant), original, "saved IDs must remain unchanged");
  }
});


test("cropped proposal accepts an exact canonical pair without depending on object prototype", () => {
  const pant = Object.assign(Object.create(null) as Record<string, unknown>, {
    type: "cropped_ankle",
    break: "cropped_above_ankle",
    hem: "plain_hem",
  });
  Object.freeze(pant);
  const before = Object.entries(pant);
  const input = pant as Parameters<typeof styleDirectorProposedCroppedHem>[0];
  assert.equal(styleDirectorProposedCroppedHem(input), "cropped_above_ankle_hem");
  assert.equal(styleDirectorProposedCroppedHem(input), "cropped_above_ankle_hem");
  assert.deepEqual(Object.entries(pant), before, "pure proposal must preserve locked fields");
});

test("cropped hem authorization requires own plain data fields", () => {
  const inherited = Object.create({ type: "cropped_ankle", break: "cropped_above_ankle" });
  assert.equal(styleDirectorProposedCroppedHem(inherited), null);
  let getterCalls = 0;
  const forged = Object.create(null);
  Object.defineProperty(forged, "type", {
    enumerable: true,
    get() { getterCalls++; throw new Error("untrusted accessor"); },
  });
  Object.defineProperty(forged, "break", {
    enumerable: true, value: "cropped_above_ankle",
  });
  assert.equal(styleDirectorProposedCroppedHem(forged), null);
  assert.equal(getterCalls, 0, "never execute candidate accessors");
  const mixed = Object.create({ break: "cropped_above_ankle" });
  mixed.type = "cropped_ankle";
  assert.equal(styleDirectorProposedCroppedHem(mixed), null);
  assert.equal(styleDirectorProposedCroppedHem(null as unknown as Parameters<typeof styleDirectorProposedCroppedHem>[0]), null);
});

test("formal and pleated trousers may have cropped hems without forcing cropped trouser type", () => {
  for (const type of ["formal_flat_front", "pleated_trouser"]) {
    const locked = Object.freeze({
      shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar", wear: "tucked",
        sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
      pant: Object.freeze({ type, pleat: type === "pleated_trouser" ? "single_pleat_forward" : "flat_front",
        hem: "cropped_above_ankle_hem", break: "cropped_above_ankle" }),
    }) as unknown as StyleSpecV2;
    const before = JSON.stringify(locked);
    const first = styleDirectorConstructionIssues(locked);
    assert.ok(!first.some(issue => issue.code === "cropped_hem_type_mismatch"), type);
    assert.ok(!first.some(issue => issue.code?.startsWith("cropped_") && issue.code !== "unknown_versioned_option"), type);
    assert.deepEqual(styleDirectorConstructionIssues(locked), first, "review is deterministic");
    assert.equal(JSON.stringify(locked), before, "locked construction must not be mutated");
    assert.equal(styleDirectorProposedCroppedHem(locked.pant), null,
      "a proposed hem must not silently change a non-cropped trouser type");
  }
});

test("cropped hem with ordinary trouser fronts rejects every shoe-resting break", () => {
  const conflicts = [
    ["full_break", "cropped_full_break"],
    ["half_break", "cropped_half_break"],
    ["slight_break", "cropped_slight_break"],
    ["stacked_break", "cropped_stacked_break"],
  ] as const;
  for (const type of ["formal_flat_front", "pleated_trouser"] as const) {
    for (const [shoeBreak, expected] of conflicts) {
      const locked = Object.freeze({
        shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar",
          wear: "tucked", sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
        pant: Object.freeze({ type, pleat: type === "pleated_trouser" ? "single_pleat_forward" : "flat_front",
          hem: "cropped_above_ankle_hem", break: shoeBreak }),
      }) as unknown as StyleSpecV2;
      const before = JSON.stringify(locked);
      const issues = styleDirectorConstructionIssues(locked);
      assert.ok(issues.some(issue => issue.code === expected),
        `${type} / ${shoeBreak}: cropped hem must not claim a shoe-resting break`);
      assert.ok(!issues.some(issue => issue.code === "pleated_front_missing_pleat" || issue.code === "flat_front_has_pleat"),
        `${type}: correctly matched pleat construction must not produce a separate mismatch`);
      assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
      assert.equal(JSON.stringify(locked), before, "locked selections remain immutable");
    }
  }
});

test("ordinary hems retain legitimate shoe-resting breaks without cropped warnings", () => {
  for (const type of ["formal_flat_front", "pleated_trouser"] as const) {
    for (const shoeBreak of ["full_break", "half_break", "slight_break", "stacked_break"] as const) {
      const locked = Object.freeze({
        shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar",
          wear: "tucked", sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
        pant: Object.freeze({ type, pleat: type === "pleated_trouser" ? "single_pleat_forward" : "flat_front",
          hem: "plain_hem", break: shoeBreak }),
      }) as unknown as StyleSpecV2;
      const before = JSON.stringify(locked);
      const issues = styleDirectorConstructionIssues(locked);
      assert.ok(!issues.some(issue => issue.code.startsWith("cropped_")),
        `${type} / ${shoeBreak}: ordinary hems must not be mistaken for cropped construction`);
      assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
      assert.equal(styleDirectorProposedCroppedHem(locked.pant), null);
      assert.equal(JSON.stringify(locked), before);
    }
  }
});


test("cropped-break review does not hide independently invalid trouser front construction", () => {
  for (const [type, pleat, expected] of [
    ["formal_flat_front", "single_pleat_forward", "flat_front_has_pleat"],
    ["pleated_trouser", "flat_front", "pleated_front_missing_pleat"],
  ] as const) {
    const locked = Object.freeze({
      shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar", wear: "tucked",
        sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
      pant: Object.freeze({ type, pleat, hem: "cropped_above_ankle_hem", break: "full_break" }),
    }) as unknown as StyleSpecV2;
    const snapshot = JSON.stringify(locked);
    const issues = styleDirectorConstructionIssues(locked);
    assert.ok(issues.some(issue => issue.code === expected), type);
    assert.ok(issues.some(issue => issue.code === "cropped_full_break"), type);
    assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
    assert.equal(JSON.stringify(locked), snapshot);
  }
});


test("cropped break against an ordinary hem requires review for every supported trouser front", () => {
  for (const type of ["formal_flat_front", "pleated_trouser", "cropped_ankle"] as const) {
    const locked = Object.freeze({
      shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar", wear: "tucked",
        sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
      pant: Object.freeze({ type, pleat: type === "pleated_trouser" ? "single_pleat_forward" : "flat_front",
        hem: "plain_hem", break: "cropped_above_ankle" }),
    }) as unknown as StyleSpecV2;
    const snapshot = JSON.stringify(locked);
    const issues = styleDirectorConstructionIssues(locked);
    assert.ok(issues.some(issue => issue.code === "cropped_break_hem_mismatch"), type);
    assert.equal(issues.filter(issue => issue.code === "cropped_break_hem_mismatch").length, 1);
    assert.ok(!issues.some(issue => issue.code === "pleated_front_missing_pleat" ||
      issue.code === "flat_front_has_pleat"), type);
    assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
    assert.equal(JSON.stringify(locked), snapshot, "review must not rewrite locked selections");
    assert.equal(styleDirectorProposedCroppedHem(locked.pant),
      type === "cropped_ankle" ? "cropped_above_ankle_hem" : null,
      "a suggestion must not authorize a different trouser type");
  }
});


test("cropped type, ordinary hem and shoe-resting break report independent conflicts", () => {
  for (const [shoeBreak, breakIssue] of [
    ["full_break", "cropped_full_break"],
    ["half_break", "cropped_half_break"],
    ["slight_break", "cropped_slight_break"],
    ["stacked_break", "cropped_stacked_break"],
  ] as const) {
    const locked = Object.freeze({
      shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar", wear: "tucked",
        sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
      pant: Object.freeze({ type: "cropped_ankle", pleat: "flat_front",
        hem: "plain_hem", break: shoeBreak }),
    }) as unknown as StyleSpecV2;
    const snapshot = JSON.stringify(locked);
    const issues = styleDirectorConstructionIssues(locked);
    assert.equal(issues.filter(issue => issue.code === "cropped_type_hem_mismatch").length, 1,
      "type/hem mismatch must not disappear behind the shoe-break conflict");
    assert.equal(issues.filter(issue => issue.code === breakIssue).length, 1,
      "shoe-break contradiction must remain independently reviewable");
    assert.equal(styleDirectorProposedCroppedHem(locked.pant), null,
      "a shoe-resting break must never propose a cropped replacement hem");
    assert.deepEqual(styleDirectorConstructionIssues(locked), issues, "deterministic replay");
    assert.equal(JSON.stringify(locked), snapshot, "locked selections remain unchanged");
  }
});


test("invalid pleat IDs remain distinct from real flat-front and pleated conflicts", () => {
  for (const type of ["formal_flat_front", "pleated_trouser", "cropped_ankle"] as const) {
    for (const pleat of [undefined, null, "", "flat_front ", "unrecognized_pleat"]) {
      const locked = Object.freeze({
        shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar", wear: "tucked",
          sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
        pant: Object.freeze({ type, pleat, hem: "cropped_above_ankle_hem",
          break: "full_break" }),
      }) as unknown as StyleSpecV2;
      const snapshot = JSON.stringify(locked);
      const issues = styleDirectorConstructionIssues(locked);
      assert.equal(issues.filter(issue => issue.code === "unknown_trouser_pleat_option").length, 1,
        `${type} / ${String(pleat)}: unknown pleat must require explicit review`);
      assert.ok(!issues.some(issue => issue.code === "flat_front_has_pleat" ||
        issue.code === "pleated_front_missing_pleat"),
        "unknown pleats must not be misreported as known construction");
      assert.equal(issues.filter(issue => issue.code === "cropped_full_break").length, 1,
        "independent hem and break conflict must remain visible");
      assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
      assert.equal(JSON.stringify(locked), snapshot);
    }
  }
});

test("unknown pleats do not fabricate front mismatches on ordinary hems", () => {
  for (const type of ["formal_flat_front", "pleated_trouser", "cropped_ankle"] as const) {
    for (const pleat of [undefined, null, "", "single_pleat_forward ", "retired_pleat"]) {
      const locked = Object.freeze({
        shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar", wear: "tucked",
          sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
        pant: Object.freeze({ type, pleat, hem: "plain_hem", break: "slight_break" }),
      }) as unknown as StyleSpecV2;
      const before = JSON.stringify(locked);
      const issues = styleDirectorConstructionIssues(locked);
      assert.equal(issues.filter(issue => issue.code === "unknown_trouser_pleat_option").length, 1);
      assert.ok(!issues.some(issue => issue.code === "flat_front_has_pleat" ||
        issue.code === "pleated_front_missing_pleat"),
        "unrecognized pleats must not be interpreted as known construction");
      assert.ok(!issues.some(issue => issue.code.startsWith("cropped_") &&
        issue.code !== "cropped_type_hem_mismatch"),
        "ordinary hems must not invent cropped break conflicts");
      assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
      assert.equal(JSON.stringify(locked), before);
    }
  }
});
