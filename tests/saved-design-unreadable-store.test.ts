import test from "node:test";
import assert from "node:assert/strict";
import { SAVED_DESIGNS_KEY, saveDesign } from "../src/lib/saved-designs.ts";

test("unreadable legacy saved-design data is never overwritten by a new save", () => {
  const data = new Map<string, string>();
  const originalWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
    },
  };
  try {
    for (const raw of ["{broken-json", '{"unexpected":"object"}', "null"]) {
      data.set(SAVED_DESIGNS_KEY, raw);
      assert.throws(
        () => saveDesign({ title: "New", brief: {} as never, version: { id: "v2" } as never, renderSet: {} as never }),
        /Existing browser data was preserved/,
      );
      assert.equal(data.get(SAVED_DESIGNS_KEY), raw);
    }
  } finally {
    if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = originalWindow;
  }
});
