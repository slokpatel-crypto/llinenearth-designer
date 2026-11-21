import assert from "node:assert/strict";
import test from "node:test";
import { importCloudDesignExport } from "../src/lib/cloud-design-import.ts";
import { SAVED_DESIGNS_KEY } from "../src/lib/saved-designs.ts";

const exportData = {
  schemaVersion: 1, designId: "SD-abc", title: "Recovered",
  brief: {
    context: { occasion: "Wedding", venue: "Indoor", time: "Evening", environment: "Cool",
      formality: "Formal", aesthetic: "Classic" },
    fabric: { profile: { id: "fabric-a", source: "stock_catalog", summary: "Unverified fabric",
      observations: [{ label: "Likely material family", value: "Linen", confidence: 0.5 }],
      palette: ["#dddccc"], alternatives: [], cautions: [] } },
  },
  version: { id: "v1", specHash: "abc",
    candidate: { concept: "Sample", aesthetic: "Classic", garments: { shirt: "Shirt",
      trouser: "Trouser", layer: "No jacket", footwear: "Loafers" }, palette: ["#dddccc"] } },
  renderSet: { designVersionId: "v1", specHash: "abc", modelId: "LE-MODEL-M01",
    spec: { fabric: { material: "Unverified sample" } },
    renders: [{ view: "front", src: "data:image/svg+xml,example" }] },
};
function store(initial: string | null = null) {
  let value = initial;
  let writes = 0;
  return {
    getItem(key: string) { assert.equal(key, SAVED_DESIGNS_KEY); return value; },
    setItem(key: string, next: string) { assert.equal(key, SAVED_DESIGNS_KEY); writes++; value = next; },
    read() { return value; },
    writes() { return writes; },
  };
}
test("cloud import preserves all local and legacy records and keeps original recipe provenance", () => {
  const original = [{ id: "SD-abc", title: "Old" }, { futureSchema: 42 }];
  const storage = store(JSON.stringify(original));
  const imported = importCloudDesignExport(storage, exportData);
  assert.equal(imported.id, "SD-abc-import-1");
  assert.equal(imported.version.specHash, "abc");
  assert.equal(imported.renderSet.modelId, "LE-MODEL-M01");
  assert.deepEqual(JSON.parse(storage.read()!), [imported, ...original]);
  const again = importCloudDesignExport(storage, exportData);
  assert.equal(again.id, "SD-abc-import-2");
  assert.equal(storage.writes(), 2);
});
test("unsupported versions, unsafe claims, and incomplete renderable recipes leave browser bytes unchanged", () => {
  const storage = store(JSON.stringify([{ legacy: true }]));
  const original = storage.read();
  assert.throws(() => importCloudDesignExport(storage, { ...exportData, schemaVersion: 2 }));
  assert.throws(() => importCloudDesignExport(storage, { ...exportData, brief: { ownerId: "forged" } }));
  assert.throws(() => importCloudDesignExport(storage, { ...exportData, renderSet: { renders: [] } }));
  assert.throws(() => importCloudDesignExport(storage, { ...exportData,
    version: { ...exportData.version, specHash: "mismatched" } }));
  for (const renderSet of [
    { ...exportData.renderSet, designVersionId: 123 },
    { ...exportData.renderSet, designVersionId: null },
    { ...exportData.renderSet, specHash: 123 },
    { ...exportData.renderSet, specHash: null },
  ]) assert.throws(() => importCloudDesignExport(storage, { ...exportData, renderSet }));
  assert.throws(() => importCloudDesignExport(storage, {
    ...exportData, version: { ...exportData.version, specHash: 123 },
  }));
  assert.equal(storage.writes(), 0);
  assert.equal(storage.read(), original);
});
test("invalid local JSON, unsupported store shape and full stores fail closed", () => {
  for (const raw of ["{", JSON.stringify({ futureSchema: 42 }),
    JSON.stringify(Array.from({ length: 24 }, (_, i) => ({ id: i })))]) {
    const storage = store(raw);
    assert.throws(() => importCloudDesignExport(storage, exportData));
    assert.equal(storage.read(), raw);
    assert.equal(storage.writes(), 0);
  }
});
test("new import does not claim original cloud record is a production lock", () => {
  const storage = store();
  const imported = importCloudDesignExport(storage, exportData);
  assert.equal(imported.id, exportData.designId);
  assert.equal(imported.title, "Recovered");
  assert.ok(imported.savedAt);
  assert.equal(storage.writes(), 1);
});
