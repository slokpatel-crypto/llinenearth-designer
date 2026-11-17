import test from "node:test";
import assert from "node:assert/strict";
import { referenceHexToRgb, rankReferenceSwatches, sampleReferencePatch, withReferenceTargetSample } from "../src/lib/designer/reference-look-matcher.ts";

test("only six-digit evidence colours are considered", () => {
  assert.deepEqual(referenceHexToRgb("#12AAff"), [18, 170, 255]);
  assert.equal(referenceHexToRgb("#fff"), null);
  assert.equal(referenceHexToRgb("javascript:alert(1)"), null);
});

test("matching returns nearest actual catalogue IDs, stable ties and no duplicates", () => {
  const swatches = [
    { id: "z", name: "Blue", hex: "#0000ff" },
    { id: "a", name: "Same blue", hex: "#0000ff" },
    { id: "bad", name: "Unknown", hex: "unverified" },
    { id: "w", name: "White", hex: "#ffffff" },
    { id: "z", name: "Duplicate stock row", hex: "#0000ff" },
  ];
  const result = rankReferenceSwatches([0, 0, 255], swatches, 3);
  assert.deepEqual(result.map((item) => item.fabric.id), ["a", "z", "w"]);
  assert.equal(result[0].distance, 0);
  assert.ok(result[2].distance > 0);
  assert.equal(swatches.length, 5);
});

test("invalid photo samples and requested sizes fail closed", () => {
  assert.deepEqual(rankReferenceSwatches([256, 0, 0], [{ id: "x", name: "Red", hex: "#ff0000" }]), []);
  assert.deepEqual(rankReferenceSwatches([255, 0, 0], [{ id: "x", name: "Red", hex: "#ff0000" }], 999), []);
});

test("median sample resists an isolated pixel defect and ignores transparency", () => {
  const data = new Uint8ClampedArray(3 * 3 * 4);
  for (let i = 0; i < 9; i += 1) {
    data.set([40, 70, 90, 255], i * 4);
  }
  data.set([255, 0, 0, 255], 0);
  data.set([0, 0, 0, 0], 4 * 4);
  assert.deepEqual(sampleReferencePatch({ width: 3, height: 3, data }, 1, 1, 1), [40, 70, 90]);
  assert.equal(sampleReferencePatch({ width: 3, height: 3, data }, -1, 0), null);
});

test("empty, transparent, oversized and malformed images never manufacture a colour", () => {
  const transparent = new Uint8ClampedArray(4);
  assert.equal(sampleReferencePatch({ width: 1, height: 1, data: transparent }, 0, 0), null);
  assert.equal(sampleReferencePatch({ width: 1, height: 1, data: new Uint8ClampedArray(3) }, 0, 0), null);
  assert.equal(sampleReferencePatch({ width: 100000, height: 100000, data: transparent }, 0, 0), null);
  assert.equal(sampleReferencePatch({ width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255]) }, 0, 0, 13), null);
});

test("two photo zones stay separate, clear independently and never mutate earlier sample state", () => {
  const empty = { shirt: null, pant: null };
  const shirt = withReferenceTargetSample(empty, "shirt", [20, 30, 40]);
  const both = withReferenceTargetSample(shirt, "pant", [70, 80, 90]);
  assert.deepEqual(empty, { shirt: null, pant: null });
  assert.deepEqual(shirt, { shirt: [20, 30, 40], pant: null });
  assert.deepEqual(both, { shirt: [20, 30, 40], pant: [70, 80, 90] });
  assert.deepEqual(withReferenceTargetSample(both, "pant", null), { shirt: [20, 30, 40], pant: null });
  assert.strictEqual(withReferenceTargetSample(both, "shirt", [300, 0, 0]), both);
  assert.strictEqual(withReferenceTargetSample(both, "unknown" as "shirt", [0, 0, 0]), both);
});

test("photo swatch sampling remains deterministic for each garment without shared mutable RGB arrays", () => {
  const mutable: [number, number, number] = [1, 2, 3];
  const shirt = withReferenceTargetSample({ shirt: null, pant: null }, "shirt", mutable);
  mutable[0] = 200;
  assert.deepEqual(shirt.shirt, [1, 2, 3]);
  const trousers = withReferenceTargetSample(shirt, "pant", [11, 12, 13]);
  assert.deepEqual(rankReferenceSwatches(trousers.shirt!, [{id:"one",name:"one",hex:"#010203"}]).map(x=>x.fabric.id), ["one"]);
  assert.deepEqual(rankReferenceSwatches(trousers.pant!, [{id:"two",name:"two",hex:"#0b0c0d"}]).map(x=>x.fabric.id), ["two"]);
});
