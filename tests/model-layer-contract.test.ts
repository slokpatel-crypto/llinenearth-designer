import assert from "node:assert/strict";
import test from "node:test";
import { LINEN_EARTH_MODEL_IDENTITY_ID } from "../src/lib/designer/model-identity.ts";
import { GARMENT_CATEGORY_LIBRARY } from "../src/lib/designer/garment-category-library.ts";
import {
  MODEL_LAYER_PLAN_VERSION, MODEL_LAYER_SLOTS, resolveModelLayerPlan,
  type ModelLayerSlot, type OutfitComposition,
} from "../src/lib/designer/model-layer-contract.ts";

const plan = (layers: readonly string[], composition: OutfitComposition = "separates") =>
  resolveModelLayerPlan({ version: MODEL_LAYER_PLAN_VERSION, composition, layers });

test("The extension registry preserves one canonical studio model and uniquely ordered garment slots", () => {
  assert.equal(LINEN_EARTH_MODEL_IDENTITY_ID, "linen-earth-studio-model-v1");
  assert.deepEqual(MODEL_LAYER_SLOTS.slice(0, 2).map(layer => layer.slot), ["shirt", "trouser"]);
  assert.deepEqual(MODEL_LAYER_SLOTS.filter(layer => layer.implementation === "existing-preview").map(layer => layer.slot),
    ["shirt", "trouser"]);
  assert.deepEqual(MODEL_LAYER_SLOTS.filter(layer => layer.implementation === "new-asset-required").map(layer => layer.slot),
    ["belt", "tie", "waistcoat", "blazer", "pocket-square"]);
  assert.equal(new Set(MODEL_LAYER_SLOTS.map(layer => layer.slot)).size, MODEL_LAYER_SLOTS.length);
  for (let i = 1; i < MODEL_LAYER_SLOTS.length; i++) {
    assert.ok(MODEL_LAYER_SLOTS[i].order > MODEL_LAYER_SLOTS[i - 1].order);
  }
  for (const layer of MODEL_LAYER_SLOTS) {
    for (const dependency of layer.prerequisites) {
      const prerequisite = MODEL_LAYER_SLOTS.find(item => item.slot === dependency);
      assert.ok(prerequisite && prerequisite.order < layer.order, "Dependencies must precede attachments.");
    }
  }
});

test("Current shirt and trouser previews remain their own layers with no new-asset claim", () => {
  for (const layers of [["shirt"], ["trouser"], ["trouser", "shirt"]]) {
    const result = plan(layers);
    assert.equal(result.valid, true);
    assert.equal(result.modelIdentityId, LINEN_EARTH_MODEL_IDENTITY_ID);
    assert.equal(result.productionApproved, false);
    assert.deepEqual(result.missingAssetSlots, []);
    assert.deepEqual(result.layers.map(item => item.slot), layers.includes("shirt") && layers.includes("trouser")
      ? ["shirt", "trouser"] : layers);
  }
});

test("Blazers, ties, belts, waistcoats and accessories use explicit anchors and cannot float", () => {
  const complete = plan(["pocket-square", "blazer", "waistcoat", "tie", "trouser", "shirt", "belt"]);
  assert.equal(complete.valid, true);
  assert.deepEqual(complete.layers.map(item => item.slot), [
    "shirt", "trouser", "belt", "tie", "waistcoat", "blazer", "pocket-square",
  ]);
  assert.deepEqual(complete.missingAssetSlots, ["belt", "tie", "waistcoat", "blazer", "pocket-square"]);
  assert.equal(complete.productionApproved, false);
  assert.equal(complete.layers.find(item => item.slot === "pocket-square")?.anchor, "blazer-chest");
  assert.equal(plan(["pocket-square", "shirt", "trouser"]).valid, false);
  assert.equal(plan(["blazer", "trouser"]).valid, false);
  assert.equal(plan(["tie", "trouser"]).valid, false);
  assert.equal(plan(["belt", "shirt"]).valid, false);
  assert.equal(plan(["waistcoat", "trouser"]).valid, false);
});

test("Suit is a blazer/trouser composition, not an additional replaceable mannequin", () => {
  assert.equal(plan(["shirt", "trouser", "blazer"], "two-piece-suit").valid, true);
  assert.equal(plan(["shirt", "trouser", "blazer", "waistcoat"], "three-piece-suit").valid, true);
  assert.equal(plan(["shirt", "trouser"], "two-piece-suit").valid, false);
  assert.equal(plan(["shirt", "trouser", "waistcoat"], "three-piece-suit").valid, false);
  assert.equal(plan(["shirt", "trouser", "blazer", "waistcoat"], "two-piece-suit").valid, false);
  assert.equal(plan(["shirt", "trouser", "blazer"], "three-piece-suit").valid, false);
  assert.ok(!MODEL_LAYER_SLOTS.some(item => (item.slot as string) === "suit"));
});

test("Import rejects unknown garment geometries, injected claims and corrupt forms without mutating input", () => {
  const validInput = { version: 1, composition: "separates", layers: ["trouser", "shirt"] };
  const before = JSON.stringify(validInput);
  assert.equal(resolveModelLayerPlan(validInput).valid, true);
  assert.equal(JSON.stringify(validInput), before);
  const invalidInputs: unknown[] = [
    null, [], "", {}, { version: 2, composition: "separates", layers: ["shirt"] },
    { version: 1, composition: "unknown", layers: ["shirt"] },
    { version: 1, composition: "separates", layers: [] },
    { version: 1, composition: "separates", layers: ["shirt", "shirt"] },
    { version: 1, composition: "separates", layers: ["shirt", "hoodie"] },
    { version: 1, composition: "separates", layers: ["shirt"], modelId: "new-body" },
    { version: 1, composition: "separates", layers: ["shirt"], stockVerified: true },
    { version: 1, composition: "separates", layers: ["shirt"], bodyMeasurements: { chest: 95 } },
    { version: 1, composition: "separates", layers: ["shirt"], glbUrl: "https://example.test/remote.glb" },
    { version: 1, composition: "separates", layers: ["shirt", null] },
    { version: 1, composition: "separates", layers: "shirt" },
  ];
  for (const input of invalidInputs) {
    const result = resolveModelLayerPlan(input);
    assert.equal(result.valid, false, JSON.stringify(input));
    assert.equal(result.productionApproved, false);
  }
});

test("Every subset stays deterministic and never claims certified geometry or physical material", () => {
  const slots: ModelLayerSlot[] = MODEL_LAYER_SLOTS.map(layer => layer.slot);
  for (let mask = 0; mask < 2 ** slots.length; mask++) {
    const selected = slots.filter((_, index) => Boolean(mask & (1 << index)));
    for (const composition of ["separates", "two-piece-suit", "three-piece-suit"] as const) {
      const result = plan([...selected].reverse(), composition);
      assert.equal(result.productionApproved, false);
      assert.equal(result.modelIdentityId, LINEN_EARTH_MODEL_IDENTITY_ID);
      assert.deepEqual(result, plan(selected, composition));
      assert.deepEqual(result.layers.map(item => item.slot),
        MODEL_LAYER_SLOTS.filter(item => selected.includes(item.slot)).map(item => item.slot));
      if (result.valid) {
        for (const layer of result.layers) {
          assert.ok(layer.prerequisites.every(dep => selected.includes(dep)));
        }
      }
    }
  }
});

test("Existing Designer and 3D roadmap categories map to the same extension registry without enabling new renderers", () => {
  const byId = new Map(GARMENT_CATEGORY_LIBRARY.map(item => [item.id, item]));
  assert.deepEqual(byId.get("shirt")?.layerSlots, ["shirt"]);
  assert.deepEqual(byId.get("trouser")?.layerSlots, ["trouser"]);
  assert.deepEqual(byId.get("blazer")?.layerSlots, ["blazer"]);
  assert.deepEqual(byId.get("suit")?.layerSlots, ["shirt", "trouser", "blazer"]);
  assert.deepEqual(byId.get("waistcoat")?.layerSlots, ["waistcoat"]);
  assert.deepEqual(byId.get("accessories")?.layerSlots, ["tie", "pocket-square", "belt"]);
  for (const category of GARMENT_CATEGORY_LIBRARY) {
    assert.ok(category.layerSlots.length > 0);
    for (const slot of category.layerSlots) {
      const descriptor = MODEL_LAYER_SLOTS.find(layer => layer.slot === slot);
      assert.ok(descriptor, "Garment cards must map to real logical slots.");
      if (descriptor.implementation === "new-asset-required") {
        assert.equal(category.status, "planned", "Never mark an unverified garment extension live.");
      }
    }
  }
});
