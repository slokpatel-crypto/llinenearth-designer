import test from "node:test";
import assert from "node:assert/strict";
import {
  MODEL_LAYER_SLOTS, resolveModelLayerPlan,
} from "../src/lib/designer/model-layer-contract.ts";
import {
  TITAN_PLAN_HISTORY_DEPTH, createTitanPlanHistory, recordTitanPlanHistory,
  undoTitanPlanHistory, redoTitanPlanHistory,
} from "../src/lib/titan/layer-plan-history.ts";

const base = { version: 1, composition: "separates", layers: ["shirt", "trouser"] } as const;
const twoPiece = { version: 1, composition: "two-piece-suit", layers: ["shirt", "trouser", "blazer"] } as const;
const threePiece = {
  version: 1, composition: "three-piece-suit", layers: ["shirt", "trouser", "waistcoat", "blazer"],
} as const;

test("Applied plans undo and redo without staging or persisting anything", () => {
  const initial = createTitanPlanHistory(base)!;
  const one = recordTitanPlanHistory(initial, twoPiece)!;
  const two = recordTitanPlanHistory(one, threePiece)!;
  assert.deepEqual(initial, { current: base, undo: [], redo: [] });
  assert.deepEqual(one, { current: twoPiece, undo: [base], redo: [] });
  assert.deepEqual(two, { current: threePiece, undo: [base, twoPiece], redo: [] });
  const back = undoTitanPlanHistory(two)!;
  assert.deepEqual(back.current, twoPiece);
  assert.deepEqual(back.undo, [base]);
  assert.deepEqual(back.redo, [threePiece]);
  assert.deepEqual(undoTitanPlanHistory(back)?.current, base);
  assert.equal(undoTitanPlanHistory(initial), null);
  assert.deepEqual(redoTitanPlanHistory(back)?.current, threePiece);
  assert.equal(redoTitanPlanHistory(two), null);
  assert.deepEqual(two.current, threePiece, "History transitions cannot modify old state");
  assert.deepEqual(base.layers, ["shirt", "trouser"], "Caller arrays cannot be mutated");
});

test("Committing a new plan after undo cuts the redo branch; no-op preserves it", () => {
  const initial = createTitanPlanHistory(base)!;
  const stage = recordTitanPlanHistory(recordTitanPlanHistory(initial, twoPiece), threePiece)!;
  const undone = undoTitanPlanHistory(stage)!;
  const unchanged = recordTitanPlanHistory(undone, twoPiece)!;
  assert.deepEqual(unchanged.redo, [threePiece], "Do not erase redo on duplicate commit");
  const branch = recordTitanPlanHistory(undone, base)!;
  assert.deepEqual(branch.redo, []);
  assert.equal(redoTitanPlanHistory(branch), null);
  assert.deepEqual(undoTitanPlanHistory(branch)?.current, twoPiece);
});

test("History is bounded to twelve commits and has no implicit session persistence", () => {
  let history = createTitanPlanHistory(base)!;
  for (let i = 0; i < TITAN_PLAN_HISTORY_DEPTH + 8; i++) {
    history = recordTitanPlanHistory(history, i % 2 ? base : twoPiece)!;
    assert.ok(history.undo.length <= TITAN_PLAN_HISTORY_DEPTH);
    assert.deepEqual(history.redo, []);
  }
  let steps = 0;
  while (true) {
    const previous = undoTitanPlanHistory(history);
    if (!previous) break;
    history = previous; steps++;
  }
  assert.equal(steps, TITAN_PLAN_HISTORY_DEPTH);
  assert.equal(history.undo.length, 0);
  assert.equal(history.redo.length, TITAN_PLAN_HISTORY_DEPTH);
  assert.deepEqual(createTitanPlanHistory(base)?.undo, [], "A new mount starts with empty history");
});

test("Reject malformed, future, unordered or injected plans and corrupted history fail-closed", () => {
  for (const invalid of [
    null, {}, [], { ...base, version: 2 }, { ...base, model: "different-person" },
    { ...base, productionApproved: true }, { ...base, layers: ["trouser", "shirt"] },
    { ...base, layers: ["shirt", "shirt"] }, { ...base, layers: ["shirt", "tie"] },
    { ...base, composition: "four-piece-suit" },
  ]) {
    assert.equal(createTitanPlanHistory(invalid), null);
    assert.equal(recordTitanPlanHistory(createTitanPlanHistory(base), invalid), null);
  }
  const history = createTitanPlanHistory(base)!;
  for (const invalid of [
    null, [], {}, { ...history, assets: [] },
    { ...history, undo: [null] }, { ...history, redo: [{ ...base, glbUrl: "/new-human.glb" }] },
    { ...history, undo: Array(TITAN_PLAN_HISTORY_DEPTH + 1).fill(base) },
    { ...history, redo: new Array(1) },
    { ...history, current: { ...base, measurements: {} } },
  ]) {
    assert.equal(recordTitanPlanHistory(invalid, twoPiece), null);
    assert.equal(undoTitanPlanHistory(invalid), null);
    assert.equal(redoTitanPlanHistory(invalid), null);
  }
});

test("Every valid canonical model-layer plan is safe as a reversible commit", () => {
  const plans = [];
  for (let bits = 0; bits < 1 << MODEL_LAYER_SLOTS.length; bits++) {
    const layers = MODEL_LAYER_SLOTS.filter((_, i) => bits & (1 << i)).map(item => item.slot);
    for (const composition of ["separates", "two-piece-suit", "three-piece-suit"] as const) {
      const candidate = { version: 1 as const, composition, layers };
      if (resolveModelLayerPlan(candidate).valid) plans.push(candidate);
    }
  }
  assert.ok(plans.length >= 50);
  for (const plan of plans) {
    const initial = createTitanPlanHistory(plan)!;
    for (const next of plans) {
      const recorded = recordTitanPlanHistory(initial, next)!;
      assert.deepEqual(recorded.current, next);
      if (JSON.stringify(plan) === JSON.stringify(next)) {
        assert.equal(recorded.undo.length, 0);
      } else {
        assert.deepEqual(undoTitanPlanHistory(recorded)?.current, plan);
        assert.deepEqual(redoTitanPlanHistory(undoTitanPlanHistory(recorded))?.current, next);
      }
      assert.deepEqual(initial.current, plan);
    }
  }
});
