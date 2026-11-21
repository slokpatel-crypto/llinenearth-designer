import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Source contract: the destructive cloud action must be separately confirmed and
// must never call the browser-local removeSavedDesign implementation.
test("cloud deletion is explicit, confirmed, and separate from browser drafts", () => {
  const panel = readFileSync("src/components/CloudSavedDesignsPanel.tsx", "utf8");
  assert.match(panel, /Delete cloud copy/);
  assert.match(panel, /window\.confirm\(/);
  assert.match(panel, /if \(!window\.confirm\([\s\S]*?\)\) return;/);
  assert.match(panel, /await deleteCloudDesign\(item\.id\)/);
  assert.match(panel, /if \(!deleted\) throw new Error/);
  assert.match(panel, /const designs = await listCloudDesigns\(\)/);
  // Cloud records must not be republished before the session is reverified.
  assert.match(panel, /await assertOwner\(\);\s*setCloud\(designs\)/);
  assert.doesNotMatch(panel, /removeSavedDesign|localStorage\.removeItem/);
});
