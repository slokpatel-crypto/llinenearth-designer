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
