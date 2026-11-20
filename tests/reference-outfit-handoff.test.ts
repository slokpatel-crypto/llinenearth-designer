import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReferenceOutfitHref,
  chooseReferenceOutfitFabric,
  readReferenceOutfitHandoff,
} from "../src/lib/designer/reference-outfit-handoff.ts";
import { withReferenceTargetSample } from "../src/lib/designer/reference-look-matcher.ts";

const shirts = [
  { id: "shirt-blue", allowedGarments: ["shirt"] as const },
  { id: "shirt-green", allowedGarments: ["shirt"] as const },
];
const pants = [
  { id: "pant-beige", allowedGarments: ["pant"] as const },
  { id: "pant-charcoal", allowedGarments: ["pant"] as const },
];
const empty = { shirt: null, pant: null };

test("photo samples remain separate and replacing one cannot mutate the other", () => {
  const shirt = withReferenceTargetSample({ shirt: null, pant: null }, "shirt", [10, 20, 30]);
  const pair = withReferenceTargetSample(shirt, "pant", [40, 50, 60]);
  assert.deepEqual(pair, { shirt: [10, 20, 30], pant: [40, 50, 60] });
  assert.deepEqual(withReferenceTargetSample(pair, "pant", null), { shirt: [10, 20, 30], pant: null });
  assert.deepEqual(shirt, { shirt: [10, 20, 30], pant: null });
});

test("each garment must be chosen explicitly from the corresponding real catalogue", () => {
  const first = chooseReferenceOutfitFabric(empty, "shirt", "shirt-blue", shirts, pants);
  assert.deepEqual(first, { shirt: "shirt-blue", pant: null });
  assert.equal(buildReferenceOutfitHref(first, shirts, pants), null, "no automatic second garment");
  assert.strictEqual(chooseReferenceOutfitFabric(first, "pant", "shirt-blue", shirts, pants), first);
  assert.strictEqual(chooseReferenceOutfitFabric(first, "shirt", "unknown-id", shirts, pants), first);
  assert.strictEqual(chooseReferenceOutfitFabric(first, "other" as "shirt", "shirt-blue", shirts, pants), first);
  const selected = chooseReferenceOutfitFabric(first, "pant", "pant-beige", shirts, pants);
  assert.deepEqual(selected, { shirt: "shirt-blue", pant: "pant-beige" });
  assert.deepEqual(first, { shirt: "shirt-blue", pant: null }, "prior choice immutable");
  assert.deepEqual(chooseReferenceOutfitFabric(selected, "shirt", null, shirts, pants), { shirt: null, pant: "pant-beige" });
});

test("only the validated pair of IDs is transported, with no photo pixels, PII or stock assertion", () => {
  const url = buildReferenceOutfitHref({ shirt: "shirt-blue", pant: "pant-beige" }, shirts, pants);
  assert.ok(url?.startsWith("/designer-studio?"));
  const params = new URL(url!, "https://example.invalid").searchParams;
  assert.deepEqual(readReferenceOutfitHandoff(params, shirts, pants), {
    shirtId: "shirt-blue", pantId: "pant-beige",
  });
  assert.deepEqual([...params.keys()].sort(), ["from", "pant", "referenceVersion", "shirt"].sort());
  assert.equal(params.get("referenceVersion"), "1");
  assert.equal(params.get("from"), "reference-match");
});

test("invalid, duplicate, unknown or category-swapped handoff parameters fail closed", () => {
  const valid = new URLSearchParams({ from: "reference-match", referenceVersion: "1", shirt: "shirt-green", pant: "pant-charcoal" });
  assert.deepEqual(readReferenceOutfitHandoff(valid, shirts, pants), { shirtId: "shirt-green", pantId: "pant-charcoal" });
  for (const [field, value] of [
    ["from", "style-director"], ["referenceVersion", "2"],
    ["shirt", "pant-beige"], ["pant", "shirt-blue"], ["shirt", "unknown-id"],
  ]) {
    const tampered = new URLSearchParams(valid);
    tampered.set(field, value);
    assert.equal(readReferenceOutfitHandoff(tampered, shirts, pants), null, field);
  }
  const duplicate = new URLSearchParams(valid);
  duplicate.append("shirt", "shirt-blue");
  assert.equal(readReferenceOutfitHandoff(duplicate, shirts, pants), null);
  const missing = new URLSearchParams(valid);
  missing.delete("pant");
  assert.equal(readReferenceOutfitHandoff(missing, shirts, pants), null);
  assert.equal(buildReferenceOutfitHref({ shirt: "pant-beige", pant: "pant-beige" }, shirts, pants), null);
});
