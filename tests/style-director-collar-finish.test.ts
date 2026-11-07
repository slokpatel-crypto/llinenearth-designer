import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

function lockedShirt(
  updates: Partial<StyleSpecV2["shirt"]> = {},
): Pick<StyleSpecV2, "shirt" | "pant"> {
  return {
    shirt: {
      type: "short_sleeve_shirt",
      collar: "spread_collar",
      wear: "untucked",
      sleeve: "half_sleeve",
      cuff: "open_short_hem_cuff",
      collarFinish: "Self-fabric",
      ...updates,
    } as StyleSpecV2["shirt"],
    pant: {
      type: "formal_flat_front",
      fit: "straight_classic",
      pleat: "flat_front",
      hem: "plain_hem",
      break: "slight_break",
    } as StyleSpecV2["pant"],
  };
}

const issues = (s: Pick<StyleSpecV2, "shirt" | "pant">) =>
  styleDirectorConstructionIssues(s).map(issue => issue.code);

test("open short-sleeve hem cannot certify a separate white contrast cuff finish", () => {
  const saved = lockedShirt({ collarFinish: "White contrast collar + cuffs" });
  const before = JSON.stringify(saved);
  assert.deepEqual(issues(saved), ["short_sleeve_contrast_cuff_finish"]);
  assert.deepEqual(issues(saved), issues(saved), "review must be deterministic");
  assert.equal(JSON.stringify(saved), before, "review cannot modify locked construction IDs");
});

test("valid short hem with self fabric or contrast collar alone is not a cuff conflict", () => {
  for (const collarFinish of ["Self-fabric", "White contrast collar"] as const) {
    const saved = lockedShirt({ collarFinish });
    assert.deepEqual(issues(saved), [], collarFinish);
  }
});

test("full-length cuff construction can use the contrast-cuff finish", () => {
  const saved = lockedShirt({
    type: "dress_shirt",
    sleeve: "full_sleeve",
    cuff: "barrel_cuff_1_button",
    collarFinish: "White contrast collar + cuffs",
  });
  assert.deepEqual(issues(saved), [], "an ordinary full cuff has no open-short-hem contradiction");
});

test("unsupported collar finish values fail closed without inventing material approval", () => {
  const saved = lockedShirt({
    collarFinish: "Retired metallic collar finish" as StyleSpecV2["shirt"]["collarFinish"],
  });
  const before = JSON.stringify(saved);
  assert.deepEqual(issues(saved), ["unknown_collar_finish"]);
  assert.equal(JSON.stringify(saved), before);
});

test("a complete valid collar finish does not erase existing short-sleeve cuff review", () => {
  const saved = lockedShirt({
    cuff: "barrel_cuff_1_button",
    collarFinish: "White contrast collar + cuffs",
  });
  assert.deepEqual(issues(saved), ["short_sleeve_cuff_review"],
    "a different full-length cuff option already requires construction review");
});
