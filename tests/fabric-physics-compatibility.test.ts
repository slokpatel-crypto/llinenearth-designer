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
  assert.equal(physics.drape.evidence, "estimated");
  assert.match(physics.drape.note || "", /not a measured coefficient/);
  assert.equal(physics.structure.value, null);
  assert.equal(physics.wrinkleResistance.evidence, "unknown");
});

test("invalid values are unknown at ingestion and scoring, never clamped into evidence", () => {
  const invalid = [NaN, Infinity, -Infinity, -1, 1001, "150", "", true, null, undefined];
  for (const value of invalid) {
    const raw = value as number;
    const physics = fabricPhysicsFromDesignerFabric({ id: "invalid", weightGsm: raw }, { breathability: raw });
    assert.equal(physics.gsm.value, null, String(value));
    assert.equal(physics.gsm.evidence, "unknown");
    assert.equal(physics.breathability.value, null);
    const direct = profile({ gsm: raw, structure: raw, breathability: raw });
    const scored = scoreFabricPhysicsForGarment(direct, "suit", { climate: "Hot / humid" });
    assert.equal(scored.evidenceCoverage, 0);
    assert.equal(scored.evidenceConfidence, 0);
    assert.equal(scored.status, "insufficient_evidence");
    assert(Number.isFinite(scored.score));
  }
  for (const value of [0, 19.9]) {
    assert.equal(fabricPhysicsFromDesignerFabric({ id: "invalid-gsm", weightGsm: value }).gsm.value, null);
  }
  const boundary = fabricPhysicsFromDesignerFabric({ id: "valid", weightGsm: 20 }, { stretch: 0, structure: 1 });
  assert.equal(boundary.gsm.value, 20);
  assert.equal(boundary.stretch.value, 0);
  assert.equal(boundary.structure.value, 1);
});

test("unknown or invalid evidence cannot influence climate or confidence", () => {
  const empty = profile({});
  const disguised = profile({ gsm: 900, breathability: 1 });
  disguised.gsm.evidence = "unknown";
  disguised.breathability.evidence = "unknown";
  assert.deepEqual(scoreFabricPhysicsForGarment(disguised, "shirt", { climate: "Hot / humid" }),
    scoreFabricPhysicsForGarment(empty, "shirt", { climate: "Hot / humid" }));
  disguised.gsm.evidence = "toString" as "reviewed";
  disguised.breathability.evidence = "approved" as "reviewed";
  assert.deepEqual(scoreFabricPhysicsForGarment(disguised, "shirt"), scoreFabricPhysicsForGarment(empty, "shirt"));
});

test("critical estimates prevent strong results even with high total confidence", () => {
  const facts = profile({ gsm: 285, drape: 0.48, structure: 0.82, breathability: 0.55, wrinkleResistance: 0.75, stretch: 0.05 });
  facts.gsm.evidence = "estimated";
  const score = scoreFabricPhysicsForGarment(facts, "suit");
  assert(score.evidenceConfidence > 65);
  assert(score.score > 85);
  assert.notEqual(score.status, "strong");
  assert(score.warnings.some((warning) => /estimated GSM/.test(warning)));
});

test("reviewing a drape category does not verify its inferred coefficient", () => {
  const source = { id: "category", weightGsm: 280, drape: "Balanced" as const };
  const mapped = fabricPhysicsFromDesignerFabric(source, {}, { drape: "reviewed" });
  assert.equal(mapped.drape.evidence, "estimated");
  const explicit = fabricPhysicsFromDesignerFabric(source, { drape: 0.48 }, { drape: "reviewed" });
  assert.equal(explicit.drape.value, 0.48);
  assert.equal(explicit.drape.evidence, "reviewed");
  assert.equal(explicit.drape.note, undefined);
  const cleared = fabricPhysicsFromDesignerFabric(source, { gsm: null, drape: null });
  assert.equal(cleared.gsm.value, null);
  assert.equal(cleared.drape.value, null);
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
