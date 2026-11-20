import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

const makeSpec = (pleat: unknown): StyleSpecV2 => ({
  shirt: {
    type: "dress_shirt", collar: "spread_collar", wear: "tucked",
    sleeve: "full_sleeve", cuff: "barrel_cuff_1_button",
  },
  pant: {
    type: "formal_flat_front", hem: "plain_hem", break: "slight_break",
    pleat,
  },
} as unknown as StyleSpecV2);

test("supplied malformed pleat IDs fail closed without fabricating front construction", () => {
  for (const pleat of [null, "", 0, false, [], {}, "retired_pleat"]) {
    const locked = makeSpec(pleat);
    const before = JSON.stringify(locked);
    const issues = styleDirectorConstructionIssues(locked);
    assert.equal(issues.filter(issue => issue.code === "unknown_trouser_pleat_option").length, 1,
      "supplied malformed pleat must require review: " + JSON.stringify(pleat));
    assert.ok(!issues.some(issue => issue.code === "flat_front_has_pleat" ||
      issue.code === "pleated_front_missing_pleat"),
      "invalid pleat must not be treated as a verified construction");
    assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
    assert.equal(JSON.stringify(locked), before, "locked selection must not be rewritten");
  }
});

test("absent pleat remains distinct from malformed supplied IDs", () => {
  const absent = makeSpec(undefined);
  assert.ok(!styleDirectorConstructionIssues(absent).some(issue =>
    issue.code === "unknown_trouser_pleat_option"));
  const valid = makeSpec("flat_front");
  assert.deepEqual(styleDirectorConstructionIssues(valid), []);
});
