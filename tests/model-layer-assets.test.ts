import assert from "node:assert/strict";
import test from "node:test";
import {
  LINEN_EARTH_MODEL_IDENTITY_ID, LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM,
} from "../src/lib/designer/model-identity.ts";
import { MODEL_LAYER_SLOTS } from "../src/lib/designer/model-layer-contract.ts";
import {
  MODEL_LAYER_ASSET_VERSION, inspectModelLayerAssetRegistration,
} from "../src/lib/designer/model-layer-assets.ts";

const future = MODEL_LAYER_SLOTS.filter(item => item.implementation === "new-asset-required");
function candidate(slot: typeof future[number]) {
  return {
    version: MODEL_LAYER_ASSET_VERSION,
    slot: slot.slot,
    modelIdentityId: LINEN_EARTH_MODEL_IDENTITY_ID,
    referenceHeightMm: LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM,
    coordinateSpace: "locked-model-local",
    anchor: slot.anchor,
    glbPath: "/models/garment-extensions/" + slot.slot + "/" + slot.slot + "-v1.glb",
    materialSlots: ["LAYER_" + slot.slot.toUpperCase().replace(/-/g, "_") + "_FRONT"],
    state: "engineering-candidate",
  };
}

test("Every planned garment can register its own independent candidate asset without model replacement", () => {
  assert.equal(future.length, 5);
  for (const slot of future) {
    const input = candidate(slot);
    const original = JSON.stringify(input);
    const result = inspectModelLayerAssetRegistration(input);
    assert.equal(result.valid, true, slot.slot + ": " + result.reasons.join(" "));
    assert.equal(result.productionApproved, false);
    assert.deepEqual(result.candidate?.materialSlots, input.materialSlots);
    assert.equal(result.candidate?.modelIdentityId, "linen-earth-studio-model-v1");
    assert.equal(result.candidate?.slot, slot.slot);
    assert.equal(JSON.stringify(input), original, "Registration cannot mutate caller data.");
  }
});

test("Candidate identity cannot be overwritten with a substitute body, arbitrary skeleton or external attachment", () => {
  const base = candidate(future.find(item => item.slot === "blazer")!);
  const corrupt: unknown[] = [
    { ...base, modelIdentityId: "generic-human-model" },
    { ...base, referenceHeightMm: 1800 },
    { ...base, coordinateSpace: "screen-pixels" },
    { ...base, anchor: "neck" },
    { ...base, slot: "shirt" },
    { ...base, slot: "trouser" },
    { ...base, slot: "suit" },
    { ...base, state: "approved" },
    { ...base, state: "production" },
    { ...base, version: 2 },
    { ...base, styleSpec: { body: "new-body" } },
    { ...base, verifiedDrape: true },
    { ...base, measurements: { chest: 100 } },
    { ...base, stockVerified: true },
    [], null, {}, "garment.glb",
  ];
  for (const input of corrupt) {
    const result = inspectModelLayerAssetRegistration(input);
    assert.equal(result.valid, false, JSON.stringify(input));
    assert.equal(result.candidate, null);
    assert.equal(result.productionApproved, false);
  }
});

test("Only local slot-scoped GLBs are candidates, with no query, traversal, external host or other garment slot", () => {
  const base = candidate(future.find(item => item.slot === "blazer")!);
  const invalidPaths = [
    "https://example.org/garment.glb", "//example.org/model.glb",
    "/models/human.glb", "/models/garment-extensions/trouser/pants-v1.glb",
    "/models/garment-extensions/blazer/../other.glb",
    "/models/garment-extensions/blazer/evil.glb?owner=1",
    "/models/garment-extensions/blazer/evil.glb#hash",
    "/models/garment-extensions/blazer/evil.GLB",
    "/models/garment-extensions/blazer/\\escape.glb",
    "/models/garment-extensions/blazer/" + "a".repeat(201) + ".glb",
    "/models/garment-extensions/blazer/étoile.glb",
  ];
  for (const glbPath of invalidPaths) {
    assert.equal(inspectModelLayerAssetRegistration({ ...base, glbPath }).valid, false, glbPath);
  }
});

test("Additional garments cannot silently reuse original six shirt/trouser materials", () => {
  const base = candidate(future.find(item => item.slot === "pocket-square")!);
  const invalidMaterials: unknown[] = [
    [], Array.from({ length: 25 }, (_, i) => "LAYER_POCKET_SQUARE_PART_" + i),
    ["shirt_torso"], ["LAYER_BLAZER_FRONT"],
    ["LAYER_POCKET_SQUARE_FRONT", "LAYER_POCKET_SQUARE_FRONT"],
    ["LAYER_POCKET_SQUARE_FRONT", "trouser_leg_left"],
    ["LAYER_POCKET_SQUARE_ BAD"],
    ["LAYER_POCKET_SQUARE_BACK;void()"],
    ["layer_pocket_square_front"],
    [null],
  ];
  for (const materialSlots of invalidMaterials) {
    assert.equal(inspectModelLayerAssetRegistration({ ...base, materialSlots }).valid, false,
      JSON.stringify(materialSlots));
  }
});
