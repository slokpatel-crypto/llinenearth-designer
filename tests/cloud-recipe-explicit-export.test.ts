import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/CloudSavedDesignsPanel.tsx", "utf8");

test("recovered cloud recipe export is explicit and versioned", () => {
  assert.match(source, /Export recovered recipe JSON/);
  assert.match(source, /schemaVersion: 1, designId: selected\.id/);
  assert.match(source, /version: selected\.version, renderSet: selected\.renderSet/);
  assert.match(source, /application\/json/);
  assert.match(source, /URL\.revokeObjectURL\(url\)/);
});
test("cloud export never silently changes browser saved designs", () => {
  const exportSection = source.split("Export recovered recipe JSON")[0].split("Cloud recovery does not overwrite browser drafts").pop();
  assert.ok(exportSection);
  assert.doesNotMatch(exportSection, /localStorage|saveDesign\(|removeSavedDesign\(/);
});
