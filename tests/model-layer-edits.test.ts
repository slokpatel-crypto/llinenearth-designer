import assert from "node:assert/strict";
import test from "node:test";
import { applyModelLayerEdits } from "../src/lib/designer/model-layer-edits.ts";
import { MODEL_LAYER_SLOTS, resolveModelLayerPlan, type ModelLayerSlot, type OutfitComposition } from "../src/lib/designer/model-layer-contract.ts";
import { inspectModelLayerAssembly } from "../src/lib/designer/model-layer-assembly.ts";
import { layerRegistration } from "./helpers/model-layer-glb-fixture.ts";

const plan = (layers: readonly string[] = ["shirt", "trouser"], composition: OutfitComposition = "separates") => ({ version: 1, layers, composition });
const batch = (...actions: unknown[]) => ({ version: 1, actions });
const slot = (id: ModelLayerSlot, selected: boolean) => ({ type: "set-slot", slot: id, selected });
const composition = (value: OutfitComposition) => ({ type: "set-composition", composition: value });

test("Adding a coordinated three-piece suit and removing it is atomic and reversible", () => {
  const base = plan(), before = JSON.stringify(base);
  const next = applyModelLayerEdits(base, batch(slot("blazer", true), slot("waistcoat", true), composition("three-piece-suit")));
  assert.equal(next.applied, true); assert.equal(next.changed, true); assert.equal(next.productionApproved, false);
  assert.deepEqual(next.addedSlots, ["waistcoat", "blazer"]); assert.deepEqual(next.removedSlots, []);
  assert.deepEqual(next.plan, plan(["shirt", "trouser", "waistcoat", "blazer"], "three-piece-suit"));
  assert.equal(JSON.stringify(base), before);
  const restore = applyModelLayerEdits(next.plan, batch(slot("blazer", false), slot("waistcoat", false), composition("separates")));
  assert.equal(restore.applied, true); assert.deepEqual(restore.plan, base);
});

test("Removing a parent never silently drops accessories or partially changes an outfit", () => {
  const original = plan(["shirt", "trouser", "tie", "blazer", "pocket-square"]);
  for (const actions of [[slot("blazer", false)], [slot("shirt", false)], [slot("trouser", false), slot("blazer", false)]]) {
    const result = applyModelLayerEdits(original, batch(...actions));
    assert.equal(result.applied, false); assert.equal(result.changed, false);
    assert.deepEqual(result.plan, original); assert.deepEqual(result.addedSlots, []); assert.deepEqual(result.removedSlots, []);
  }
  const result = applyModelLayerEdits(original, batch(slot("pocket-square", false), slot("blazer", false)));
  assert.equal(result.applied, true); assert.deepEqual(result.removedSlots, ["blazer", "pocket-square"]);
  assert.deepEqual(result.plan, plan(["shirt", "trouser", "tie"]));
});

test("Suit transitions must explicitly include all changed garments and composition", () => {
  const twoPiece = plan(["shirt", "trouser", "blazer"], "two-piece-suit");
  const incomplete = applyModelLayerEdits(twoPiece, batch(slot("waistcoat", true)));
  assert.equal(incomplete.applied, false); assert.deepEqual(incomplete.plan, twoPiece);
  const threePiece = applyModelLayerEdits(twoPiece, batch(slot("waistcoat", true), composition("three-piece-suit")));
  assert.equal(threePiece.applied, true);
  assert.equal(applyModelLayerEdits(threePiece.plan, batch(slot("waistcoat", false))).applied, false);
  const downgraded = applyModelLayerEdits(threePiece.plan, batch(slot("waistcoat", false), composition("two-piece-suit")));
  assert.equal(downgraded.applied, true); assert.deepEqual(downgraded.plan, twoPiece);
});

test("Every single-slot edit across all valid logical plans agrees with the canonical validator", () => {
  let attempted = 0;
  for (let mask = 0; mask < 1 << MODEL_LAYER_SLOTS.length; mask++) {
    const layers = MODEL_LAYER_SLOTS.filter((_, i) => mask & (1 << i)).map(x => x.slot);
    for (const kind of ["separates", "two-piece-suit", "three-piece-suit"] as const) {
      const input = plan(layers, kind), original = JSON.stringify(input);
      if (!resolveModelLayerPlan(input).valid) continue;
      for (const layer of MODEL_LAYER_SLOTS) for (const selected of [false, true]) {
        const expectedLayers = layers.filter(x => x !== layer.slot);
        if (selected) expectedLayers.push(layer.slot);
        const expected = resolveModelLayerPlan(plan(expectedLayers, kind));
        const result = applyModelLayerEdits(input, batch(slot(layer.slot, selected))); attempted++;
        assert.equal(result.applied, expected.valid, `${mask}/${kind}/${layer.slot}/${selected}`);
        assert.equal(result.productionApproved, false);
        if (result.applied) assert.deepEqual(result.plan?.layers, expected.layers.map(x => x.slot));
        else assert.deepEqual(result.plan, plan(layers, kind));
        assert.equal(JSON.stringify(input), original);
      }
    }
  }
  assert.ok(attempted > 500);
});

test("Order of distinct actions cannot affect the normalized final outfit", () => {
  const actions = [slot("blazer", true), slot("tie", true), slot("pocket-square", true), composition("two-piece-suit")];
  const expected = applyModelLayerEdits(plan(), batch(...actions));
  for (let offset = 0; offset < actions.length; offset++) {
    assert.deepEqual(applyModelLayerEdits(plan(), batch(...actions.slice(offset), ...actions.slice(0, offset))), expected);
  }
});

test("Idempotent explicit selections preserve IDs without unnecessary changed status", () => {
  const input = plan(["trouser", "shirt"]);
  const result = applyModelLayerEdits(input, batch(slot("shirt", true), slot("blazer", false), composition("separates")));
  assert.equal(result.applied, true); assert.equal(result.changed, false);
  assert.deepEqual(result.plan, plan()); assert.deepEqual(result.addedSlots, []); assert.deepEqual(result.removedSlots, []);
});

test("Bad transactions cannot inject assets, approval, measurements or model replacements", () => {
  const input = plan(), valid = batch(slot("blazer", true));
  const malformed: unknown[] = [null, [], "edit", {}, { ...valid, version: 2 }, { ...valid, modelIdentityId: "another-body" },
    { ...valid, assets: [] }, { ...valid, productionApproved: true }, { version: 1, actions: [] },
    { version: 1, actions: new Array(1) }, { version: 1, actions: Array(9).fill(slot("blazer", true)) },
    batch(slot("blazer", true), slot("blazer", false)), batch(composition("separates"), composition("two-piece-suit")),
    batch({ type: "set-slot", slot: "hoodie", selected: true }), batch({ type: "set-slot", slot: "blazer", selected: "true" }),
    batch({ ...slot("blazer", true), glbPath: "https://example.org/replacement.glb" }), batch({ ...slot("blazer", true), measurements: {} }),
    batch({ type: "replace-model", model: "another-body" }), batch({ type: "set-composition", composition: "unknown" }),
    batch({ type: "set-composition", composition: "separates", stockVerified: true }), batch(null), batch([]),
  ];
  for (const request of malformed) {
    const before = JSON.stringify(request), result = applyModelLayerEdits(input, request);
    assert.equal(result.applied, false, JSON.stringify(request)); assert.deepEqual(result.plan, input);
    assert.equal(result.changed, false); assert.equal(result.productionApproved, false);
    assert.equal(JSON.stringify(request), before);
  }
});

test("Corrupt previous state is never repaired or replaced silently", () => {
  for (const input of [null, {}, plan([]), plan(["tie"]), { ...plan(), modelIdentityId: "another-body" }]) {
    const result = applyModelLayerEdits(input, batch(slot("shirt", true), slot("trouser", true)));
    assert.equal(result.applied, false); assert.equal(result.plan, null); assert.equal(result.changed, false);
    assert.equal(result.productionApproved, false);
  }
});

test("Returned editable data is detached from caller arrays and round-trips the existing plan parser", () => {
  const layers = ["shirt", "trouser"], original = plan(layers);
  const result = applyModelLayerEdits(original, batch(slot("blazer", true)));
  assert.equal(result.applied, true);
  layers.push("hoodie");
  assert.deepEqual(result.plan?.layers, ["shirt", "trouser", "blazer"]);
  assert.equal(resolveModelLayerPlan(JSON.parse(JSON.stringify(result.plan))).valid, true);
});

test("A logical edit cannot bypass independent addon registration and asset preflight", () => {
  const result = applyModelLayerEdits(plan(), batch(slot("blazer", true), composition("two-piece-suit")));
  assert.equal(result.applied, true);
  assert.equal(inspectModelLayerAssembly({ version: 1, plan: result.plan, assets: [] }).valid, false);
  const assembly = inspectModelLayerAssembly({ version: 1, plan: result.plan, assets: [layerRegistration("blazer")] });
  assert.equal(assembly.valid, true);
  assert.equal(result.productionApproved, false); assert.equal(assembly.productionApproved, false);
  assert.equal(assembly.candidates[0].state, "engineering-candidate");
});
