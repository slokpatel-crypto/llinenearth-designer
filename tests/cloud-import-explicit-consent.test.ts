import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync("src/components/CloudSavedDesignsPanel.tsx", "utf8");
const atelier = readFileSync("src/components/SavedDesignsClient.tsx", "utf8");

test("cloud-to-local recovery requires explicit user confirmation and stays local-only", () => {
  assert.match(panel, /Import into browser drafts<\/button>/);
  assert.match(panel, /window\.confirm\(/);
  assert.match(panel, /importCloudDesignExport\(window\.localStorage/);
  assert.match(panel, /schemaVersion: 1, designId: selected\.id, title: selected\.title/);
  assert.match(panel, /onImported\(recovered\)/);
  assert.match(panel, /production lock not verified/i);
  const recovery = panel.split("Import into browser drafts</button>")[0].split("Export recovered recipe JSON</button>").pop();
  assert.ok(recovery);
  assert.ok(recovery.indexOf("window.confirm") < recovery.indexOf("importCloudDesignExport"),
    "import must be gated by a confirmation action");
  assert.doesNotMatch(recovery, /saveCloudDesign\(|deleteCloudDesign\(/);
});

test("local drafts refresh after import in empty and populated atelier states", () => {
  const occurrences = atelier.match(/<CloudSavedDesignsPanel localDesigns=\{designs\} onImported=\{onCloudImported\} \/>/g);
  assert.equal(occurrences?.length, 2);
  assert.match(atelier, /function onCloudImported\(imported: SavedDesign\)/);
  assert.match(atelier, /const recovered = listSavedDesigns\(\)/);
  assert.match(atelier, /setDesigns\(recovered\)/);
  assert.match(atelier, /setActiveId\(imported\.id\)/);
});
