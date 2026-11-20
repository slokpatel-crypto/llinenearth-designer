import assert from "node:assert/strict";
import test from "node:test";
import { importCloudDesignExport } from "../src/lib/cloud-design-import";
import { SAVED_DESIGNS_KEY } from "../src/lib/saved-designs";

const exportData = {
  schemaVersion: 1, designId: "SD-abc", title: "Recovered",
  brief: { context: { occasion: "wedding" } },
  version: { id: "v1", specHash: "abc" },
  renderSet: { modelId: "linen-earth-studio-model-v1", renders: [] },
};
function store(initial: string | null = null) {
  let value = initial;
  return {
    getItem(key: string) { assert.equal(key, SAVED_DESIGNS_KEY); return value; },
    setItem(key: string, next: string) { assert.equal(key, SAVED_DESIGNS_KEY); value = next; },
    read() { return value; },
  };
}
test("cloud import preserves existing and unreadable legacy records, resolving id collision", () => {
  const original = [{ id: "SD-abc", title: "Old" }, { futureSchema: 42 }];
  const storage = store(JSON.stringify(original));
  const imported = importCloudDesignExport(storage, exportData);
  assert.equal(imported.id, "SD-abc-import-1");
  assert.deepEqual(JSON.parse(storage.read()!), [imported, ...original]);
});
test("malformed or owner-bearing export fails without mutating existing storage", () => {
  const storage = store(JSON.stringify([{ legacy: true }]));
  const original = storage.read();
  assert.throws(() => importCloudDesignExport(storage, { ...exportData, schemaVersion: 2 }));
  assert.throws(() => importCloudDesignExport(storage, { ...exportData, brief: { ownerId: "forged" } }));
  assert.equal(storage.read(), original);
});
test("invalid local JSON and full stores fail closed", () => {
  const unreadable = store("{");
  assert.throws(() => importCloudDesignExport(unreadable, exportData));
  assert.equal(unreadable.read(), "{");
  const full = store(JSON.stringify(Array.from({ length: 24 }, (_, i) => ({ id: i }))));
  const original = full.read();
  assert.throws(() => importCloudDesignExport(full, exportData));
  assert.equal(full.read(), original);
});
