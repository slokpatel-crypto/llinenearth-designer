import test from "node:test";
import assert from "node:assert/strict";
import {
  MODEL_LAYER_SLOTS, resolveModelLayerPlan, type OutfitComposition,
} from "../src/lib/designer/model-layer-contract.ts";
import {
  TITAN_LAYER_PRESET_CHOICES, previewTitanLayerPreset,
} from "../src/lib/titan/layer-plan-presets.ts";

const base = { version: 1, composition: "separates", layers: ["shirt", "trouser"] } as const;

test("Every preset is canonical, structurally valid, unique and strictly planning-only", () => {
  assert.equal(TITAN_LAYER_PRESET_CHOICES.length, 5);
  assert.equal(new Set(TITAN_LAYER_PRESET_CHOICES.map(item => item.id)).size, 5);
  for (const preset of TITAN_LAYER_PRESET_CHOICES) {
    const preview = previewTitanLayerPreset(base, preset.id);
    assert.ok(preview, preset.id);
    assert.equal(preview.title, preset.title);
    assert.equal(resolveModelLayerPlan(preview.plan).valid, true);
    assert.deepEqual(preview.plan.layers, resolveModelLayerPlan(preview.plan).layers.map(x => x.slot));
    assert.equal(preview.productionApproved, false);
    assert.deepEqual(
      preview.requiresUnverifiedAssets,
      resolveModelLayerPlan(preview.plan).missingAssetSlots,
    );
    assert.deepEqual(Object.keys(preview.plan).sort(), ["composition", "layers", "version"]);
    assert.equal(/glb|measurement|customer|stock|modelIdentityId|productionApproved/.test(JSON.stringify(preview.plan)), false);
  }
});

test("Exhaustive valid-to-preset transitions are deterministic and atomic", () => {
  let checked = 0;
  for (let mask = 0; mask < 1 << MODEL_LAYER_SLOTS.length; mask++) {
    const layers = MODEL_LAYER_SLOTS.filter((_, i) => mask & (1 << i)).map(x => x.slot);
    for (const composition of ["separates", "two-piece-suit", "three-piece-suit"] as OutfitComposition[]) {
      const current = { version: 1, composition, layers };
      if (!resolveModelLayerPlan(current).valid) continue;
      const untouched = JSON.stringify(current);
      for (const preset of TITAN_LAYER_PRESET_CHOICES) {
        const result = previewTitanLayerPreset(current, preset.id);
        assert.ok(result, preset.id);
        assert.deepEqual(result, previewTitanLayerPreset(current, preset.id));
        assert.equal(JSON.stringify(current), untouched);
        assert.equal(resolveModelLayerPlan(result.plan).valid, true);
        assert.deepEqual(result.added, result.plan.layers.filter(slot => !layers.includes(slot)));
        assert.deepEqual(result.removed, layers.filter(slot => !result.plan.layers.includes(slot)));
        assert.equal(result.compositionChanged, composition !== result.plan.composition);
        assert.equal(result.changed, result.added.length > 0 || result.removed.length > 0 || result.compositionChanged);
        assert.equal(result.productionApproved, false);
        checked++;
      }
    }
  }
  assert.ok(checked > 150);
});

test("Invalid, injected, duplicate, future-version and unknown data never stage a preset", () => {
  for (const state of [
    null, undefined, {}, [], base.layers, { ...base, version: 2 },
    { ...base, layers: ["shirt", "shirt"] },
    { ...base, layers: ["tie"] },
    { ...base, modelIdentityId: "a-new-person" },
    { ...base, approved: true }, { ...base, composition: "four-piece-suit" },
  ]) assert.equal(previewTitanLayerPreset(state, "two-piece"), null);
  for (const id of [null, 0, {}, " ", "suit", "toString", "__proto__", "two-piece?glb=external"]) {
    assert.equal(previewTitanLayerPreset(base, id), null);
  }
});

test("Choosing the currently applied preset is a no-op and never aliases caller arrays", () => {
  const a = previewTitanLayerPreset(base, "essential-pair");
  const b = previewTitanLayerPreset(base, "essential-pair");
  assert.ok(a && b);
  assert.equal(a.changed, false);
  assert.deepEqual(a.added, []);
  assert.deepEqual(a.removed, []);
  assert.deepEqual(a.requiresUnverifiedAssets, []);
  assert.notEqual(a.plan.layers, base.layers);
  assert.notEqual(a.plan.layers, b.plan.layers);
});
