import test from "node:test";
import assert from "node:assert/strict";
import { MODEL_LAYER_SLOTS, resolveModelLayerPlan, type OutfitComposition } from "../src/lib/designer/model-layer-contract.ts";
import {
  TITAN_LAYER_SHARE_PARAMETER,
  encodeTitanLayerPlan, titanLayerShareHref, readTitanLayerShare,
} from "../src/lib/titan/layer-plan-share.ts";

const starting = { version: 1, composition: "separates", layers: ["shirt", "trouser"] } as const;
const threePiece = { version: 1, composition: "three-piece-suit", layers: ["shirt", "trouser", "waistcoat", "blazer"] } as const;

test("TITAN layer links carry ONLY version, composition and canonical known layer slots", () => {
  assert.equal(TITAN_LAYER_SHARE_PARAMETER, "layer-plan");
  assert.equal(encodeTitanLayerPlan(starting), "v1-0-03");
  assert.equal(encodeTitanLayerPlan(threePiece), "v1-2-33");
  assert.equal(titanLayerShareHref(threePiece), "/titan?layer-plan=v1-2-33");
  assert.deepEqual(readTitanLayerShare("?layer-plan=v1-2-33"), threePiece);
  assert.deepEqual(readTitanLayerShare("layer-plan=v1-0-03"), starting);
  assert.ok(!/measurements|customer|stock|glb|model|fabrics/i.test(titanLayerShareHref(threePiece) ?? ""));
});

test("All valid canonical garment combinations round trip bijectively", () => {
  const tokens = new Set<string>();
  let valid = 0;
  for (let bits = 0; bits < 2 ** MODEL_LAYER_SLOTS.length; bits++) {
    const layers = MODEL_LAYER_SLOTS.filter((_, index) => bits & (1 << index)).map(item => item.slot);
    for (const composition of ["separates", "two-piece-suit", "three-piece-suit"] as OutfitComposition[]) {
      const candidate = { version: 1, composition, layers };
      if (!resolveModelLayerPlan(candidate).valid) {
        assert.equal(encodeTitanLayerPlan(candidate), null);
        continue;
      }
      valid++;
      const token = encodeTitanLayerPlan(candidate);
      assert.ok(token && !tokens.has(token), `Unique canonical token: ${token}`);
      tokens.add(token);
      assert.deepEqual(readTitanLayerShare(`?layer-plan=${token}`), candidate);
      assert.equal(encodeTitanLayerPlan(readTitanLayerShare(`?layer-plan=${token}`)), token);
    }
  }
  assert.ok(valid > 30);
  assert.equal(tokens.size, valid);
});

test("Malformed, foreign, duplicate, injected and unsupported tokens are never imported", () => {
  const invalid = [
    "", "?layer-plan=", "?layer-plan=v1-0-00", "?layer-plan=v1-0-80",
    "?layer-plan=v1-0-FF", "?layer-plan=v1-0-03&layer-plan=v1-0-03",
    "?layer-plan=v2-0-03", "?layer-plan=v1-3-03", "?layer-plan=v1-0-3",
    "?layer-plan=v1-0-003", "?layer-plan=v1-0-03%00", "?layer-plan=%3Cscript%3E",
    "?layer-plan=v1-0-40", // pocket square without blazer
    "?layer-plan=v1-1-03", // suit without blazer
    "?layer-plan=v1-2-23", // three-piece suit without waistcoat
    "?layer-plan=v1-1-33", // two-piece suit with waistcoat
    "?layer-plan=v1-0-0", "x".repeat(1025),
  ];
  for (const value of invalid) assert.equal(readTitanLayerShare(value), null, value.slice(0, 90));
  assert.equal(readTitanLayerShare(null), null);
  assert.equal(readTitanLayerShare({ layer: "v1-0-03" }), null);
  const raw = { ...starting, productionApproved: true };
  assert.equal(encodeTitanLayerPlan(raw), null);
  assert.equal(encodeTitanLayerPlan({ ...starting, modelIdentityId: "another-model" }), null);
  assert.equal(encodeTitanLayerPlan({ ...starting, layers: ["trouser", "shirt"] }), null);
  assert.equal(encodeTitanLayerPlan({ ...starting, layers: ["shirt", "trouser", "tie", "tie"] }), null);
});

test("Existing fabric-reference query params cannot change decoded garment layers", () => {
  const base = "?layer-plan=v1-2-33";
  const withExistingFabricShare = base + "&outfit=v1%3Aunknown&shirt=totally-fake&trouser=not-a-fabric";
  assert.deepEqual(readTitanLayerShare(withExistingFabricShare), threePiece);
  assert.equal(readTitanLayerShare("?shirt=linen-plain-60-peach"), null);
});
