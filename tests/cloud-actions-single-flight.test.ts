import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// React state updates are asynchronous: disabling a button on rerender alone
// cannot prevent two actions dispatched before that rerender.
test("cloud actions use a synchronous in-flight mutex and release it after errors", () => {
  const panel = readFileSync("src/components/CloudSavedDesignsPanel.tsx", "utf8");
  assert.match(panel, /const inFlight = useRef\(false\)/);
  assert.match(panel, /if \(inFlight\.current\) return;\s*inFlight\.current = true;\s*setBusy\(true\)/);
  assert.match(panel, /finally \{ inFlight\.current = false; setBusy\(false\); \}/);
  // Actions now accept an owner-verification callback; retain the synchronous mutex gate.\n  assert.match(panel, /void run\(async \(assertOwner\) => \{/);\n  assert.match(panel, /await assertOwner\(\)/);
});
