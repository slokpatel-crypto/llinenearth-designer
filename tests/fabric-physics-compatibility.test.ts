import test from "node:test";
import assert from "node:assert/strict";
import {
  compatibilityGarmentTypes,
  fabricCompatibilityMatrix,
  fabricPhysicsFromDesignerFabric,
  scoreFabricPhysicsForGarment,
  type FabricPhysicsProfile,
} from "../src/lib/designer/fabric-physics.ts";

type PhysicsKey = "gsm" | "drape" | "structure" | "breathability" | "wrinkleResistance" | "stretch";

function profile(
  values: Partial<Record<PhysicsKey, number>>,
  evidence: "reviewed" | "declared" | "estimated" = "reviewed",
): FabricPhysicsProfile {
  const fact = (key: PhysicsKey) => values[key] === undefined
    ? { value: null, evidence: "unknown" as const }
    : { value: values[key]!, evidence };
  return {
    version: "linen-earth-fabric-physics-v1",
    fabricId: "test",
    gsm: fact("gsm"),
    drape: fact("drape"),
    structure: fact("structure"),
    breathability: fact("breathability"),
    wrinkleResistance: fact("wrinkleResistance"),
    stretch: fact("stretch"),
  };
}

test("physics layer covers current and future garment taxonomy", () => {
  assert.deepEqual(
    compatibilityGarmentTypes().sort(),
    ["bandhgala", "blazer", "kurta", "shirt", "suit", "trouser"],
  );
});

test("structured midweight cloth ranks structured garments strongly", () => {
  const matrix = fabricCompatibilityMatrix(profile({
    gsm: 285,
    drape: 0.48,
    structure: 0.82,
    breathability: 0.55,
    wrinkleResistance: 0.75,
    stretch: 0.05,
  }));
  const suit = matrix.find((item) => item.garmentType === "suit")!;
  const blazer = matrix.find((item) => item.garmentType === "blazer")!;
  assert(suit.score >= 85);
  assert(blazer.score >= 85);
  assert.equal(suit.status, "strong");
  assert.equal(suit.criticalUnknowns.length, 0);
});

test("fluid breathable lightweight cloth favors kurta and shirt over suit", () => {
  const matrix = fabricCompatibilityMatrix(profile({
    gsm: 150,
    drape: 0.85,
    structure: 0.22,
    breathability: 0.9,
    wrinkleResistance: 0.35,
    stretch: 0.08,
  }), { climate: "Hot / humid" });
  const kurta = matrix.find((item) => item.garmentType === "kurta")!;
  const shirt = matrix.find((item) => item.garmentType === "shirt")!;
  const suit = matrix.find((item) => item.garmentType === "suit")!;
  assert(kurta.score > suit.score);
  assert(shirt.score > suit.score);
  assert.equal(suit.status, "not_recommended");
});

test("missing physical truth never becomes a confident compatibility claim", () => {
  const physics = fabricPhysicsFromDesignerFabric({ id: "stock-a", weightGsm: null, drape: null });
  const shirt = scoreFabricPhysicsForGarment(physics, "shirt");
  assert.equal(shirt.status, "insufficient_evidence");
  assert.equal(shirt.evidenceCoverage, 0);
  assert(shirt.criticalUnknowns.includes("gsm"));
  assert.equal(physics.structure.value, null);
  assert.equal(physics.breathability.value, null);
});

test("existing categorical drape maps conservatively while unknown dimensions stay unknown", () => {
  const physics = fabricPhysicsFromDesignerFabric({ id: "stock-b", weightGsm: 160, drape: "Balanced" });
  assert.equal(physics.gsm.value, 160);
  assert.equal(physics.gsm.evidence, "declared");
  assert.equal(physics.drape.value, 0.55);
  assert.equal(physics.drape.evidence, "declared");
  assert.equal(physics.structure.value, null);
  assert.equal(physics.wrinkleResistance.evidence, "unknown");
});

test("estimated physics lowers confidence without changing physical-fit math", () => {
  const values = {
    gsm: 280,
    drape: 0.48,
    structure: 0.8,
    breathability: 0.55,
    wrinkleResistance: 0.7,
    stretch: 0.05,
  };
  const reviewed = scoreFabricPhysicsForGarment(profile(values, "reviewed"), "blazer");
  const estimated = scoreFabricPhysicsForGarment(profile(values, "estimated"), "blazer");
  assert.equal(reviewed.score, estimated.score);
  assert(reviewed.evidenceConfidence > estimated.evidenceConfidence);
  assert.equal(reviewed.status, "strong");
  assert.notEqual(estimated.status, "strong");
});
