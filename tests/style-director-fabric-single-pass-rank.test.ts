import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorRankFabricCandidatesOnce,
} from "../src/lib/designer/style-director-intelligence-scoring.ts";

test("rank each eligible fabric exactly once even if its intelligence signal changes per read", () => {
  const stock = Object.freeze([
    Object.freeze({ id: "linen-60-blue" }),
    Object.freeze({ id: "linen-60-sage" }),
    Object.freeze({ id: "linen-60-ivory" }),
    Object.freeze({ id: "linen-60-check" }),
  ]);
  const before = JSON.stringify(stock);
  const reads = new Map<string, number>();
  const first = new Map([
    ["linen-60-blue", 20],
    ["linen-60-sage", 90],
    ["linen-60-ivory", 50],
    ["linen-60-check", 40],
  ]);
  const result = styleDirectorRankFabricCandidatesOnce(stock, item => {
    const count = (reads.get(item.id) ?? 0) + 1;
    reads.set(item.id, count);
    // A repeated comparator read would move these fabrics unpredictably.
    return count === 1 ? first.get(item.id)! : -1000 * count;
  }, 3);
  assert.deepEqual(result.map(x => x.id), [
    "linen-60-sage", "linen-60-ivory", "linen-60-check",
  ]);
  assert.deepEqual([...reads.entries()], stock.map(item => [item.id, 1]));
  assert.equal(JSON.stringify(stock), before, "do not reorder or mutate caller stock");
});

test("stable equal-score results retain the physical catalogue order", () => {
  const catalogue = ["sage", "blue", "ivory", "check"] as const;
  const ranked = styleDirectorRankFabricCandidatesOnce(catalogue, () => 50, 3);
  assert.deepEqual(ranked, ["sage", "blue", "ivory"]);
  assert.deepEqual(catalogue, ["sage", "blue", "ivory", "check"]);
  assert.deepEqual(styleDirectorRankFabricCandidatesOnce(catalogue, () => 5, 10), [...catalogue]);
  assert.deepEqual(styleDirectorRankFabricCandidatesOnce(catalogue, () => 5, 0), []);
  assert.deepEqual(styleDirectorRankFabricCandidatesOnce(catalogue, () => 5, -1), []);
  assert.deepEqual(styleDirectorRankFabricCandidatesOnce(catalogue, () => 5, Number.NaN), []);
  assert.deepEqual(styleDirectorRankFabricCandidatesOnce([], () => {
    throw new Error("empty stock cannot invoke ranking");
  }, 3), []);
});

test("invalid candidate scores cannot rank above valid finite evidence", () => {
  const catalogue = ["nan", "finite-high", "positive-infinity", "finite-low", "negative-infinity"] as const;
  const ranking: Record<string, number> = {
    nan: Number.NaN,
    "finite-high": 40,
    "positive-infinity": Number.POSITIVE_INFINITY,
    "finite-low": -30,
    "negative-infinity": Number.NEGATIVE_INFINITY,
  };
  assert.deepEqual(styleDirectorRankFabricCandidatesOnce(catalogue, id => ranking[id], 5),
    ["finite-high", "finite-low"],
    "nonfinite results cannot backfill an otherwise short styling recommendation");
  assert.deepEqual(styleDirectorRankFabricCandidatesOnce(catalogue, id => ranking[id], 2),
    ["finite-high", "finite-low"]);
  assert.deepEqual(styleDirectorRankFabricCandidatesOnce(["nan", "positive-infinity"] as const,
    id => ranking[id], 3), [], "never recommend a fabric with unrankable score");
  let unnecessaryReads = 0;
  assert.deepEqual(styleDirectorRankFabricCandidatesOnce(catalogue, () => {
    unnecessaryReads++;
    return 1;
  }, 0), []);
  assert.equal(unnecessaryReads, 0, "zero-result requests must not evaluate untrusted scores");
});

test("the scorer's output is a separate array and never changes saved fabric objects", () => {
  const options = [
    { id: "first", physicalGsm: null, measuredRepeatMm: null },
    { id: "second", physicalGsm: null, measuredRepeatMm: null },
  ];
  const snapshot = structuredClone(options);
  const scored = styleDirectorRankFabricCandidatesOnce(options, option =>
    option.id === "second" ? 42 : 9, 2);
  assert.notEqual(scored, options);
  assert.equal(scored[0], options[1], "refer to original stock objects without forging new properties");
  assert.equal(scored[1], options[0]);
  assert.deepEqual(options, snapshot);
});
