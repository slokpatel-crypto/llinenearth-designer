import test from "node:test";
import assert from "node:assert/strict";
import { listSavedDesigns, saveDesign, SAVED_DESIGNS_KEY } from "../src/lib/saved-designs.ts";

test("saving a new design preserves unknown legacy records and caps only readable designs", () => {
  const storage = new Map<string, string>();
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    },
  };
  try {
    const unknown = [null, { id: "future-format", fields: { recoverable: true } }, "legacy"];
    const valid = Array.from({ length: 24 }, (_, i) => ({
      id: `SD-old-${i}`, title: "Old", savedAt: "2026-01-01",
      brief: {}, version: { id: `old-${i}` }, renderSet: {},
    }));
    storage.set(SAVED_DESIGNS_KEY, JSON.stringify([...unknown, ...valid]));
    saveDesign({ title: "New", brief: {} as never, version: { id: "new" } as never, renderSet: {} as never });
    const stored = JSON.parse(storage.get(SAVED_DESIGNS_KEY)!) as unknown[];
    assert.deepEqual(stored.slice(-unknown.length), unknown);
    assert.equal(listSavedDesigns().length, 24);
    assert.equal(listSavedDesigns()[0].id, "SD-new");
    assert.equal(listSavedDesigns().some(item => item.id === "SD-old-23"), false);
    saveDesign({ title: "Updated", brief: {} as never, version: { id: "new" } as never, renderSet: {} as never });
    assert.deepEqual((JSON.parse(storage.get(SAVED_DESIGNS_KEY)!) as unknown[]).slice(-unknown.length), unknown);
    assert.equal(listSavedDesigns().filter(item => item.id === "SD-new").length, 1);
  } finally {
    if (previous === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = previous;
  }
});
