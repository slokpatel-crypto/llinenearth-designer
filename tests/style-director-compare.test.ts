import test from "node:test";
import assert from "node:assert/strict";
import type { StyleDirectorLook } from "../src/lib/style-director-agent.ts";
import { compareStyleDirectorLooks, STYLE_DIRECTOR_COMPARE_LENSES } from "../src/lib/designer/style-director-compare.ts";

function look(id: string, scores: { total: number; occasion: number; climate: number; originality: number }, status: "preliminary" | "needs_review" | null = "preliminary"): StyleDirectorLook {
  return {
    id, title: id, why: ["Fabric and styling have a visual relationship."],
    fabric: { colorName: "Sky Blue", line: "Linen Plain", pattern: "Plain" },
    candidate: {
      tradeoff: "An expressive silhouette needs more considered styling.",
      reasons: ["Engine reason."],
      scores: { ...scores, fabric: 60, aesthetic: 70, coherence: 80 },
    },
    ...(status === null ? {} : {
      realModel: {
        status, shirtName: "Shirt fabric", pantName: "Pant fabric",
        styleSpec: {
          shirt: { type: "dress_shirt", collar: "spread_collar", cuff: "barrel_cuff_1_button", wear: "tucked" },
          pant: { type: "formal_flat_front", waistband: "belt_loops", break: "slight_break" },
        },
      },
    }),
  } as unknown as StyleDirectorLook;
}

const base = [
  look("balanced", { total: 84, occasion: 92, climate: 61, originality: 68 }),
  look("cool", { total: 78, occasion: 73, climate: 98, originality: 77 }, "needs_review"),
  look("directional", { total: 81, occasion: 76, climate: 62, originality: 95 }, null),
];

test("each lens uses only the corresponding existing deterministic engine score", () => {
  const expected = {
    overall: ["balanced", "directional", "cool"],
    occasion: ["balanced", "directional", "cool"],
    climate: ["cool", "directional", "balanced"],
    expression: ["directional", "cool", "balanced"],
  };
  assert.deepEqual(STYLE_DIRECTOR_COMPARE_LENSES.map((lens) => lens.id), Object.keys(expected));
  for (const lens of STYLE_DIRECTOR_COMPARE_LENSES) {
    const compared = compareStyleDirectorLooks(base, lens.id);
    assert.deepEqual(compared.map((item) => item.lookId), expected[lens.id]);
    assert.deepEqual(compared.map((item) => item.rank), [1, 2, 3]);
    assert.equal(compareStyleDirectorLooks(base, lens.id).map((entry) => entry.lookId).join(","), expected[lens.id].join(","));
  }
});

test("evidence labels never turn preliminary or missing proof into approval", () => {
  const compared = compareStyleDirectorLooks(base, "climate");
  assert.equal(compared[0].state, "needs_review");
  assert.match(compared[0].reviewNote, /human construction review/i);
  assert.equal(compared[1].state, "concept_only");
  assert.equal(compared[1].outfit, null);
  assert.equal(compared[1].construction, null);
  assert.match(compared[1].reviewNote, /concept/i);
  assert.equal(compared[2].state, "preliminary");
  assert.match(compared[2].reviewNote, /not a verified fit/i);
});

test("construction IDs are passed through exactly, never translated or invented", () => {
  const first = compareStyleDirectorLooks(base)[0];
  assert.deepEqual(first.construction, {
    shirtType: "dress_shirt", collar: "spread_collar", cuff: "barrel_cuff_1_button",
    pantType: "formal_flat_front", waistband: "belt_loops", pantBreak: "slight_break", wear: "tucked",
  });
  assert.deepEqual(first.outfit, { shirt: "Shirt fabric", pant: "Pant fabric" });
  assert.deepEqual(first.fabric, { color: "Sky Blue", line: "Linen Plain", pattern: "Plain" });
});

test("ties retain original sequence and share a rank, without changing the input", () => {
  const tied = [look("a", { total: 80, occasion: 85, climate: 60, originality: 75 }),
    look("b", { total: 80, occasion: 85, climate: 60, originality: 75 }),
    look("c", { total: 75, occasion: 85, climate: 60, originality: 75 })];
  const snapshot = structuredClone(tied);
  const actual = compareStyleDirectorLooks(tied);
  assert.deepEqual(actual.map((item) => [item.lookId, item.rank]), [["a", 1], ["b", 1], ["c", 3]]);
  assert.deepEqual(tied, snapshot);
});

test("malformed or out-of-range styling scores cannot win the customer comparison", () => {
  const invalid = [
    look("nan", { total: Number.NaN, occasion: 0, climate: 0, originality: 0 }),
    look("over", { total: 101, occasion: 0, climate: 0, originality: 0 }),
    look("valid", { total: 0, occasion: 0, climate: 0, originality: 0 }),
  ];
  const compared = compareStyleDirectorLooks(invalid);
  assert.deepEqual(compared.map((item) => [item.lookId, item.rank, item.stylingSignal]),
    [["valid", 1, 0], ["nan", null, null], ["over", null, null]]);
  assert.throws(() => compareStyleDirectorLooks(invalid, "unknown" as never), /supported/);
  assert.deepEqual(compareStyleDirectorLooks([]), []);
});
