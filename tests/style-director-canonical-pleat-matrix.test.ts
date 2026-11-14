import test from "node:test";
import assert from "node:assert/strict";
import { optionsFor } from "../src/lib/designer/options/library.ts";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

// This matrix uses the catalogue itself: deprecated display aliases must not
// masquerade as versioned, physically buildable pleat construction.
test("every canonical front-pleat ID has deterministic, non-mutating trouser type parity", () => {
  const pleats = optionsFor("pant.pleat").map(option => option.id);
  assert.ok(pleats.includes("flat_front"), "the approved vocabulary must represent no pleats");
  assert.ok(pleats.some(pleat => pleat !== "flat_front"),
    "the approved vocabulary must represent at least one pleated construction");

  for (const type of ["formal_flat_front", "pleated_trouser", "cropped_ankle"] as const) {
    for (const pleat of pleats) {
      const cropped = type === "cropped_ankle";
      const spec = Object.freeze({
        shirt: Object.freeze({
          type: "dress_shirt", collar: "spread_collar", wear: "tucked",
          sleeve: "full_sleeve", cuff: "barrel_cuff_1_button",
        }),
        pant: Object.freeze({
          type, pleat,
          hem: cropped ? "cropped_above_ankle_hem" : "plain_hem",
          break: cropped ? "cropped_above_ankle" : "no_break",
        }),
      }) as unknown as StyleSpecV2;
      const snapshot = JSON.stringify(spec);
      const issues = styleDirectorConstructionIssues(spec);
      const frontIssues = issues.filter(issue =>
        issue.code === "flat_front_has_pleat" || issue.code === "pleated_front_missing_pleat");
      const expected = type === "formal_flat_front" && pleat !== "flat_front"
        ? "flat_front_has_pleat"
        : type === "pleated_trouser" && pleat === "flat_front"
          ? "pleated_front_missing_pleat" : null;

      assert.deepEqual(frontIssues.map(issue => issue.code), expected ? [expected] : [],
        `${type} / ${pleat}: only a real incompatible canonical pleat should trigger review`);
      assert.ok(!issues.some(issue => issue.code === "unknown_trouser_pleat_option"),
        `${type} / ${pleat}: a catalogue ID must not be labelled unknown`);
      assert.ok(!issues.some(issue => issue.code.startsWith("cropped_")),
        `${type} / ${pleat}: matching length choices must not invent crop conflicts`);
      assert.deepEqual(styleDirectorConstructionIssues(spec), issues, "deterministic replay");
      assert.equal(JSON.stringify(spec), snapshot, "locked construction stays unchanged");
    }
  }
});
