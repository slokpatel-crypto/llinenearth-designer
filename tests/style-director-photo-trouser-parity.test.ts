import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorPresentationIssues } from "../src/lib/designer/style-director-compatibility.ts";
import { optionsFor } from "../src/lib/designer/options/library.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";
import type { DesignerStyle } from "../src/lib/designer/engine.ts";

// Photographic selector parity is independent of physical fit approval.
// Every displayed option must agree with the locked canonical ID.
test("photographic trouser selectors independently fail closed on locked ID mismatch", () => {
  const groups = [
    ["rise", "pant.rise", "legacy_rise_mismatch"],
    ["waistband", "pant.waistband", "legacy_waistband_mismatch"],
    ["break", "pant.break", "legacy_break_mismatch"],
  ] as const;
  const collar = optionsFor("shirt.collar").find(o => o.id === "spread_collar");
  assert.ok(collar);
  const baseStyle = { collar: collar.legacyLabel || collar.label, shirtWear: "Tucked" } as DesignerStyle;
  for (const [key, group, code] of groups) {
    const selectable = optionsFor(group).filter(o => o.legacySelectable !== false);
    assert.ok(selectable.length >= 2, group + " needs two real selectable options");
    const [shown, locked] = selectable;
    const saved = {
      shirt: { collar: "spread_collar", wear: "tucked", sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" },
      pant: { [key]: locked.id },
    } as unknown as StyleSpecV2;
    const original = JSON.stringify(saved);
    const displayed = { ...baseStyle, [key]: shown.legacyLabel || shown.label };
    const first = styleDirectorPresentationIssues(displayed, saved);
    const second = styleDirectorPresentationIssues(displayed, saved);
    assert.deepEqual(first, second, group + " review must be deterministic");
    assert.ok(first.some(issue => issue.code === code), group + " mismatch must be flagged");
    assert.equal(JSON.stringify(saved), original, group + " must preserve saved IDs");
    const matching = { ...baseStyle, [key]: locked.legacyLabel || locked.label };
    assert.equal(styleDirectorPresentationIssues(matching, saved).some(issue => issue.code === code),
      false, group + " matching selectable label must not be falsely rejected");
  }
});
