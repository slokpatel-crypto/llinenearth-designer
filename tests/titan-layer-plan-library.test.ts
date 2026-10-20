import assert from "node:assert/strict";
import test from "node:test";
import {
  TITAN_LAYER_PLANS_KEY, TITAN_LAYER_PLANS_LIMIT,
  readTitanLayerPlanLibrary, serializeTitanLayerPlanLibrary,
  addTitanLayerPlan, removeTitanLayerPlan,
} from "../src/lib/titan/layer-plan-library.ts";
import { MODEL_LAYER_SLOTS, resolveModelLayerPlan, type OutfitComposition } from "../src/lib/designer/model-layer-contract.ts";

const base = { version: 1, composition: "separates", layers: ["shirt", "trouser"] } as const;
const twoPiece = { version: 1, composition: "two-piece-suit", layers: ["shirt", "trouser", "blazer"] } as const;
const threePiece = { version: 1, composition: "three-piece-suit", layers: ["shirt", "trouser", "waistcoat", "blazer"] } as const;

test("TITAN bookmark namespace is separate from Designer and catalogue lookbook", () => {
  assert.equal(TITAN_LAYER_PLANS_KEY, "linen-earth:titan-layer-plans:v1");
  assert.deepEqual(readTitanLayerPlanLibrary(null), { ok: true, plans: [] });
  const text = serializeTitanLayerPlanLibrary([base, threePiece]);
  assert.deepEqual(JSON.parse(text), { version: 1, plans: [base, threePiece] });
  assert.deepEqual(readTitanLayerPlanLibrary(text), { ok: true, plans: [base, threePiece] });
  assert.equal(/body|measurement|glb|asset|productionApproved|stock|email|customer/.test(text), false);
});

test("Never mutate input and never add duplicates or evict an existing bookmark", () => {
  const saved = [base];
  const original = JSON.stringify(saved);
  const next = addTitanLayerPlan(saved, twoPiece);
  assert.equal(next.changed, true);
  assert.deepEqual(next.plans, [base, twoPiece]);
  assert.equal(JSON.stringify(saved), original);
  assert.equal(addTitanLayerPlan(next.plans, base).changed, false);
  assert.deepEqual(removeTitanLayerPlan(next.plans, base), { changed: true, plans: [twoPiece] });
  assert.deepEqual(removeTitanLayerPlan(next.plans, base), { changed: true, plans: [twoPiece] });
  assert.equal(removeTitanLayerPlan(next.plans, { ...base, modelIdentityId: "replacement" }).changed, false);
});

test("Reject invalid, future, partial and tampered stored data rather than silently overwriting it", () => {
  const bad = [
    "", "{", "null", "[]", "42", " ".repeat(2049),
    JSON.stringify({ version: 2, plans: [base] }),
    JSON.stringify({ version: 1, plans: [base], profile: "fake" }),
    JSON.stringify({ version: 1, plans: [base, base] }),
    JSON.stringify({ version: 1, plans: [base, { ...base, glb: "https://invalid.example/model.glb" }] }),
    JSON.stringify({ version: 1, plans: [{ ...base, productionApproved: true }] }),
    JSON.stringify({ version: 1, plans: [{ ...base, layers: ["trouser", "shirt"] }] }),
    JSON.stringify({ version: 1, plans: [{ ...base, layers: ["tie"] }] }),
    JSON.stringify({ version: 1, plans: [{ ...base, version: 3 }] }),
    JSON.stringify({ version: 1, plans: [{ ...base, layers: ["shirt", "trouser", "shirt"] }] }),
    JSON.stringify({ version: 1, plans: Array(7).fill(base) }),
  ];
  for (const value of bad) assert.deepEqual(readTitanLayerPlanLibrary(value), { ok: false, plans: [] });
  for (const injected of [
    { ...base, modelIdentityId: "different-human" },
    { ...base, fit: "tailor-approved" },
    { ...base, layers: ["shirt", "unknown"] },
    { ...base, layers: ["pocket-square"] },
    { ...twoPiece, layers: ["shirt", "trouser"] },
  ]) assert.equal(addTitanLayerPlan([base], injected).changed, false);
  assert.throws(() => serializeTitanLayerPlanLibrary([base, base]));
});

test("All canonical outfit compositions/slot combinations round trip safely", () => {
  let count = 0;
  for (let mask = 0; mask < 2 ** MODEL_LAYER_SLOTS.length; mask++) {
    const layers = MODEL_LAYER_SLOTS.filter((_, bit) => mask & (1 << bit)).map(item => item.slot);
    for (const composition of ["separates", "two-piece-suit", "three-piece-suit"] as OutfitComposition[]) {
      const candidate = { version: 1, composition, layers };
      if (!resolveModelLayerPlan(candidate).valid) continue;
      count++;
      const saved = addTitanLayerPlan([], candidate);
      assert.equal(saved.changed, true, JSON.stringify(candidate));
      assert.deepEqual(readTitanLayerPlanLibrary(serializeTitanLayerPlanLibrary(saved.plans)).plans, [candidate]);
    }
  }
  assert.ok(count > 30);
});

test("Hard cap six and honest failure on damaged existing collection", () => {
  const options = [
    base, twoPiece, threePiece,
    { version: 1, composition: "separates", layers: ["shirt"] },
    { version: 1, composition: "separates", layers: ["trouser"] },
    { version: 1, composition: "separates", layers: ["shirt", "trouser", "tie"] },
    { version: 1, composition: "separates", layers: ["shirt", "trouser", "blazer"] },
  ] as const;
  let saved = [] as readonly (typeof options)[number][];
  for (const candidate of options.slice(0, TITAN_LAYER_PLANS_LIMIT)) {
    const next = addTitanLayerPlan(saved, candidate);
    assert.equal(next.changed, true);
    saved = next.plans as typeof saved;
  }
  assert.equal(addTitanLayerPlan(saved, options[6]).changed, false);
  const unchanged = addTitanLayerPlan([{ ...base, layers: ["shirt", "fake"] }] as never, twoPiece);
  assert.equal(unchanged.changed, false);
});
