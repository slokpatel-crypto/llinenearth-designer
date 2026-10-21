import test from "node:test";
import assert from "node:assert/strict";
import {
  MODEL_LAYER_SLOTS, resolveModelLayerPlan, type OutfitComposition,
} from "../src/lib/designer/model-layer-contract.ts";
import { guideTitanLayerDraft } from "../src/lib/titan/layer-compatibility-guidance.ts";

const plan = (layers: readonly string[], composition: OutfitComposition = "separates") =>
  ({ version: 1, composition, layers });

test("All 384 possible masks and compositions receive safe deterministic guidance", () => {
  let invalid = 0;
  for (let mask = 0; mask < 1 << MODEL_LAYER_SLOTS.length; mask++) {
    const layers = MODEL_LAYER_SLOTS.filter((_, index) => mask & (1 << index)).map(item => item.slot);
    for (const composition of ["separates", "two-piece-suit", "three-piece-suit"] as const) {
      const input = plan(layers, composition);
      const before = JSON.stringify(input);
      const reference = resolveModelLayerPlan(input);
      const first = guideTitanLayerDraft(input);
      assert.equal(first.valid, reference.valid, "Validity must match authoritative rules.");
      assert.deepEqual(first, guideTitanLayerDraft(input), "No random or paid API guidance.");
      assert.equal(JSON.stringify(input), before, "Never change caller draft.");
      if (reference.valid) {
        assert.deepEqual(first.suggestions, []);
        assert.deepEqual(first.reasons, []);
      } else {
        invalid++;
        assert.deepEqual(first.reasons, reference.reasons);
        assert.ok(first.suggestions.length > 0 && first.suggestions.length <= 3);
        const distinct = new Set<string>();
        for (const option of first.suggestions) {
          assert.equal(resolveModelLayerPlan(option.plan).valid, true);
          assert.equal(option.plan.version, 1);
          assert.equal(option.description.length > 0, true);
          assert.deepEqual(option.add, option.plan.layers.filter(id => !layers.includes(id)));
          assert.deepEqual(option.remove, layers.filter(id => !option.plan.layers.includes(id)));
          assert.equal(option.compositionChanged, option.plan.composition !== composition);
          const key = JSON.stringify(option.plan);
          assert.ok(!distinct.has(key), "Do not present duplicate fixes.");
          distinct.add(key);
          const unrelated = ["productionApproved", "fabric", "measurements", "modelIdentityId", "asset"];
          unrelated.forEach(field => assert.equal(Object.hasOwn(option.plan, field), false));
        }
      }
    }
  }
  assert.ok(invalid > 100);
});

test("Recommends adding prerequisites before deleting user's selected garments", () => {
  const missingShirt = guideTitanLayerDraft(plan(["trouser", "tie"]));
  assert.equal(missingShirt.valid, false);
  assert.deepEqual(missingShirt.suggestions[0].add, ["shirt"]);
  assert.deepEqual(missingShirt.suggestions[0].remove, []);
  assert.deepEqual(missingShirt.suggestions[0].plan.layers, ["shirt", "trouser", "tie"]);

  const missingBlazer = guideTitanLayerDraft(plan(["shirt", "trouser"], "two-piece-suit"));
  assert.deepEqual(missingBlazer.suggestions[0].add, ["blazer"]);
  assert.equal(missingBlazer.suggestions[0].plan.composition, "two-piece-suit");
  assert.ok(missingBlazer.suggestions.some(x => x.compositionChanged && x.plan.composition === "separates"));
});

test("Unknown, injected, duplicated and future-version inputs receive no repair actions", () => {
  for (const value of [
    null, {}, [], "shirt", { ...plan(["shirt"]), version: 2 },
    { ...plan(["shirt"]), modelIdentityId: "fake" },
    { ...plan(["shirt"]), assets: ["https://example.com/anything.glb"] },
    { ...plan(["shirt"]), productionApproved: true },
    plan(["hoodie"]), plan(["shirt", "shirt"]), plan(["shirt", "unknown"]),
    { ...plan(["shirt"]), layers: new Array(1) },
    { ...plan(["shirt"]), composition: "four-piece-suit" },
  ]) {
    const guidance = guideTitanLayerDraft(value);
    assert.equal(guidance.valid, false);
    assert.deepEqual(guidance.suggestions, []);
  }
});

test("Empty layer draft is never silently filled or accepted", () => {
  const result = guideTitanLayerDraft(plan([]));
  assert.equal(result.valid, false);
  assert.match(result.reasons.join(" "), /Choose at least one garment/);
  assert.deepEqual(plan([]).layers, []);
  assert.ok(result.suggestions.length > 0);
});
