import assert from "node:assert/strict";
import test from "node:test";
import { listSavedDesigns, saveDesign, SAVED_DESIGNS_KEY } from "../src/lib/saved-designs.ts";

test("legacy designs without specHash retain distinct version IDs", () => {
  const store = new Map<string, string>();
  const previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
    },
  };
  try {
    const input = (id: string) => ({
      title: id,
      brief: {} as Parameters<typeof saveDesign>[0]["brief"],
      version: { id } as Parameters<typeof saveDesign>[0]["version"],
      renderSet: {} as Parameters<typeof saveDesign>[0]["renderSet"],
    });
    saveDesign(input("legacy-a"));
    saveDesign(input("legacy-b"));
    assert.deepEqual(listSavedDesigns().map((item) => item.id), ["SD-legacy-b", "SD-legacy-a"]);
    saveDesign(input("legacy-a"));
    assert.deepEqual(listSavedDesigns().map((item) => item.id), ["SD-legacy-a", "SD-legacy-b"]);
    assert.ok(store.has(SAVED_DESIGNS_KEY));
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = previousWindow;
  }
});

test("corrupt legacy entries do not block saving or erase valid designs", () => {
  const store = new Map<string, string>();
  const previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
    },
  };
  try {
    const valid = {
      id: "SD-existing",
      title: "Existing",
      savedAt: "2026-01-01T00:00:00.000Z",
      brief: {},
      version: { id: "existing" },
      renderSet: {},
    };
    store.set(SAVED_DESIGNS_KEY, JSON.stringify([
      null, {}, { id: "SD-bad", version: null },
      { id: "SD-bad2", version: {} },
      valid,
    ]));
    assert.deepEqual(listSavedDesigns().map((item) => item.id), ["SD-existing"]);
    saveDesign({
      title: "New",
      brief: {} as Parameters<typeof saveDesign>[0]["brief"],
      version: { id: "new" } as Parameters<typeof saveDesign>[0]["version"],
      renderSet: {} as Parameters<typeof saveDesign>[0]["renderSet"],
    });
    assert.deepEqual(listSavedDesigns().map((item) => item.id), ["SD-new", "SD-existing"]);
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = previousWindow;
  }
});
