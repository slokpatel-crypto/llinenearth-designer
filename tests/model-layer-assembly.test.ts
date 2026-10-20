import assert from "node:assert/strict";
import test from "node:test";
import { inspectModelLayerAssembly } from "../src/lib/designer/model-layer-assembly.ts";
import { MODEL_LAYER_SLOTS, resolveModelLayerPlan, type ModelLayerSlot, type OutfitComposition } from "../src/lib/designer/model-layer-contract.ts";
import { layerRegistration } from "./helpers/model-layer-glb-fixture.ts";

const extensionSlots = ["belt", "tie", "waistcoat", "blazer", "pocket-square"] as const;
function bundle(layers: ModelLayerSlot[] = ["shirt", "trouser", "blazer"], composition: OutfitComposition = "two-piece-suit") {
  return {
    version: 1,
    plan: { version: 1, composition, layers },
    assets: extensionSlots.filter(slot => layers.includes(slot)).map(slot => layerRegistration(slot)),
  };
}

test("Every possible layer/composition assembly follows the existing canonical plan", () => {
  for (let mask = 0; mask < 1 << MODEL_LAYER_SLOTS.length; mask++) {
    const layers = MODEL_LAYER_SLOTS.filter((_, i) => mask & (1 << i)).map(x => x.slot);
    for (const composition of ["separates", "two-piece-suit", "three-piece-suit"] as const) {
      const input = bundle(layers, composition), before = JSON.stringify(input);
      const plan = resolveModelLayerPlan(input.plan), result = inspectModelLayerAssembly(input);
      assert.equal(result.valid, plan.valid, `${mask}/${composition}: ${result.reasons.join(" ")}`);
      assert.equal(result.productionApproved, false);
      assert.equal(JSON.stringify(input), before);
      if (result.valid) {
        assert.deepEqual(result.candidates.map(x => x.slot), plan.missingAssetSlots);
        assert.ok(result.candidates.every(x => x.state === "engineering-candidate"));
      } else assert.deepEqual(result.candidates, []);
    }
  }
});

test("Input order is normalized without mutating the caller or canonical dependencies", () => {
  const input = bundle(["pocket-square", "blazer", "waistcoat", "tie", "belt", "trouser", "shirt"], "three-piece-suit");
  input.assets.reverse();
  const result = inspectModelLayerAssembly(input);
  assert.equal(result.valid, true);
  assert.deepEqual(result.candidates.map(x => x.slot), extensionSlots);
  const first = result.candidates[0];
  input.assets.find(x => x.slot === first.slot)!.materialSlots[0] = "INJECTED";
  assert.notEqual(first.materialSlots[0], "INJECTED");
});

test("Missing, duplicated, swapped or unrelated registrations fail as a whole", () => {
  const valid = bundle(["shirt", "trouser", "blazer", "tie"]);
  const corrupt: unknown[] = [
    { ...valid, assets: [] }, { ...valid, assets: valid.assets.slice(1) },
    { ...valid, assets: [valid.assets[0], valid.assets[0]] },
    { ...valid, assets: [valid.assets[0], layerRegistration("belt")] },
    { ...valid, assets: [...valid.assets, layerRegistration("waistcoat")] },
    { ...valid, assets: [{ ...valid.assets[0], slot: "shirt" }, valid.assets[1]] },
    { ...valid, assets: new Array(2) },
    { ...valid, assets: [valid.assets[0], { ...valid.assets[1], state: "approved" }] },
    { ...valid, assets: [valid.assets[0], { ...valid.assets[1], modelIdentityId: "replacement-body" }] },
    { ...valid, assets: [valid.assets[0], { ...valid.assets[1], glbPath: "/models/body.glb" }] },
    { ...valid, version: 2 }, { ...valid, productionApproved: true },
    { ...valid, measurements: { chest: 100 } }, { ...valid, plan: { ...valid.plan, layers: ["pocket-square"] } },
    { ...valid, baseModelUrl: "https://example.org/body.glb" }, null, [], "assembly", {},
  ];
  for (const input of corrupt) {
    const result = inspectModelLayerAssembly(input);
    assert.equal(result.valid, false, JSON.stringify(input));
    assert.equal(result.productionApproved, false); assert.deepEqual(result.candidates, []);
  }
});

test("Legacy base-layer-only plans need no extension and cannot register base replacements", () => {
  for (const layers of [["shirt"], ["trouser"], ["shirt", "trouser"]] as ModelLayerSlot[][]) {
    const input = bundle(layers, "separates"), result = inspectModelLayerAssembly(input);
    assert.equal(result.valid, true); assert.deepEqual(result.candidates, []); assert.equal(result.productionApproved, false);
    assert.equal(inspectModelLayerAssembly({ ...input, assets: [layerRegistration()] }).valid, false);
  }
});
