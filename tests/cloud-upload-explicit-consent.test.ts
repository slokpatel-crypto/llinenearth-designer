import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/** Source-level privacy tripwire; real browser interaction remains a separate release gate. */
test("choosing a browser draft never initiates a cloud upload", () => {
  const source = readFileSync("src/components/CloudSavedDesignsPanel.tsx", "utf8");
  const selection = source.match(/<select\b[\s\S]*?<\/select>/)?.[0];
  assert.ok(selection, "local draft selection control must exist");
  assert.match(selection, /onChange=\{\(event\) => setUploadId\(event\.currentTarget\.value\)\}/);
  assert.doesNotMatch(selection, /saveCloudDesign|fetch\s*\(|run\s*\(/);
  const upload = source.match(/<button\b[\s\S]*?>Upload selected draft<\/button>/)?.[0];
  assert.ok(upload, "separate explicit upload button must exist");
  assert.match(upload, /disabled=\{busy \|\| !uploadId\}/);
  assert.match(upload, /onClick=/);
  assert.match(upload, /await saveCloudDesign\(draft\)/);
  assert.match(source, /Browser drafts stay on this device until you explicitly choose to upload one/);
});
