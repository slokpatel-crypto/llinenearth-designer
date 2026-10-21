import assert from "node:assert/strict";
import test from "node:test";
import {
  MODEL_LAYER_SLOTS, resolveModelLayerPlan, type OutfitComposition,
} from "../src/lib/designer/model-layer-contract.ts";
import {
  reviewTitanLayerChanges, titanLayerReviewDraft,
} from "../src/lib/titan/layer-plan-review.ts";

const start = { version: 1, composition: "separates", layers: ["shirt", "trouser"] } as const;
const suit = { version: 1, composition: "three-piece-suit", layers: [
  "shirt", "trouser", "belt", "tie", "waistcoat", "blazer", "pocket-square",
] } as const;

test("Explain added, removed and unverified assets without any release claim", () => {
  const forward = reviewTitanLayerChanges(start, suit);
  assert.equal(forward.valid, true);
  assert.equal(forward.changed, true);
  assert.deepEqual(forward.additions, ["belt", "tie", "waistcoat", "blazer", "pocket-square"]);
  assert.deepEqual(forward.removals, []);
  assert.deepEqual(forward.newAssetSlots, forward.additions);
  assert.deepEqual(forward.unverifiedAssetSlots, forward.additions);
  assert.deepEqual([forward.compositionFrom, forward.compositionTo],
    ["separates", "three-piece-suit"]);
  assert.equal(forward.productionApproved, false);
  const back = reviewTitanLayerChanges(suit, start);
  assert.deepEqual(back.additions, []);
  assert.deepEqual(back.removals, forward.additions);
  assert.deepEqual(back.unverifiedAssetSlots, []);
  assert.deepEqual(back.newAssetSlots, []);
  assert.equal(back.productionApproved, false);
});

test("Unchanged, invalid and injected drafts never get a reviewable approval", () => {
  const unchanged = reviewTitanLayerChanges(start, start);
  assert.equal(unchanged.valid, true);
  assert.equal(unchanged.changed, false);
  assert.deepEqual(unchanged.additions, []);
  for (const invalid of [
    null, [], {}, { ...suit, version: 2 },
    { ...suit, layers: ["shirt", "shirt"] },
    { ...suit, model: "new-human" }, { ...suit, productionApproved: true },
    { ...suit, layers: ["shirt", "tie"] }, { ...suit, composition: "four-piece" },
  ]) {
    const broken = reviewTitanLayerChanges(start, invalid);
    assert.equal(broken.valid, false);
    assert.equal(broken.changed, false);
    assert.ok(broken.reasons.length > 0);
    assert.deepEqual(broken.additions, []);
    assert.deepEqual(broken.unverifiedAssetSlots, []);
    assert.equal(broken.productionApproved, false);
  }
  assert.equal(reviewTitanLayerChanges({ ...start, version: 10 }, suit).valid, false);
});

test("Every valid state pair matches canonical symmetric slot differences", () => {
  const plans: Array<{ version: 1; composition: OutfitComposition; layers: string[] }> = [];
  for (let bits = 0; bits < 1 << MODEL_LAYER_SLOTS.length; bits++) {
    const layers = MODEL_LAYER_SLOTS.filter((_, i) => bits & (1 << i)).map(item => item.slot);
    for (const composition of ["separates", "two-piece-suit", "three-piece-suit"] as const) {
      const candidate = { version: 1 as const, composition, layers };
      if (resolveModelLayerPlan(candidate).valid) plans.push(candidate);
    }
  }
  assert.ok(plans.length > 40);
  for (const before of plans) {
    const original = JSON.stringify(before);
    for (const after of plans) {
      const review = reviewTitanLayerChanges(before, after);
      assert.equal(review.valid, true);
      assert.equal(review.changed, JSON.stringify(before) !== JSON.stringify(after));
      assert.deepEqual(review.additions, after.layers.filter(slot => !before.layers.includes(slot)));
      assert.deepEqual(review.removals, before.layers.filter(slot => !after.layers.includes(slot)));
      assert.deepEqual(review.unverifiedAssetSlots,
        resolveModelLayerPlan(after).missingAssetSlots);
      assert.deepEqual(review.newAssetSlots, review.additions.filter(slot =>
        !["shirt", "trouser"].includes(slot)));
    }
    assert.equal(JSON.stringify(before), original);
  }
});

test("Draft constructor detaches the source array and uses versioned canonical fields", () => {
  const slots = ["shirt", "trouser"] as const;
  const draft = titanLayerReviewDraft("separates", slots);
  assert.deepEqual(draft, start);
  assert.notEqual(draft.layers, slots);
});
