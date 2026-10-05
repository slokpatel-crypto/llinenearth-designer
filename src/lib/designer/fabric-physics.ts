export type FabricPhysicsEvidence = "reviewed" | "declared" | "estimated" | "unknown";
export type FabricPhysicsDimension = "gsm" | "drape" | "structure" | "breathability" | "wrinkleResistance" | "stretch";
export type CompatibilityGarmentType = "shirt" | "trouser" | "suit" | "blazer" | "kurta" | "bandhgala";
export type FabricCompatibilityStatus = "strong" | "workable" | "review" | "not_recommended" | "insufficient_evidence";

export type FabricPhysicsValue = {
  value: number | null;
  evidence: FabricPhysicsEvidence;
  note?: string;
};

export type FabricPhysicsProfile = {
  version: "linen-earth-fabric-physics-v1";
  fabricId: string;
  gsm: FabricPhysicsValue;
  drape: FabricPhysicsValue;
  structure: FabricPhysicsValue;
  breathability: FabricPhysicsValue;
  wrinkleResistance: FabricPhysicsValue;
  stretch: FabricPhysicsValue;
};

export type FabricPhysicsSource = {
  id: string;
  weightGsm: number | null;
  drape?: "Fluid" | "Balanced" | "Structured" | null;
};

export type FabricPhysicsEvidenceOverrides = Partial<Record<FabricPhysicsDimension, FabricPhysicsEvidence>>;
export type FabricPhysicsPatch = Partial<Record<FabricPhysicsDimension, number | null>>;

export type FabricCompatibilityContext = {
  climate?: "Not specified" | "Hot / humid" | "Cool" | "Air-conditioned";
};

export type FabricCompatibilityResult = {
  version: "linen-earth-fabric-compatibility-v1";
  garmentType: CompatibilityGarmentType;
  label: string;
  score: number;
  status: FabricCompatibilityStatus;
  evidenceCoverage: number;
  evidenceConfidence: number;
  criticalUnknowns: FabricPhysicsDimension[];
  reasons: string[];
  warnings: string[];
  ruleSource: "prototype-adapted-provisional-v1";
};

type DimensionTarget =
  | { kind: "range"; range: [number, number]; tolerance: number }
  | { kind: "target"; target: number; tolerance: number }
  | { kind: "minimum"; min: number; tolerance: number };

type GarmentPhysicsTarget = {
  label: string;
  weights: Record<FabricPhysicsDimension, number>;
  targets: Record<FabricPhysicsDimension, DimensionTarget>;
  critical: FabricPhysicsDimension[];
};

const qualityWeight: Record<FabricPhysicsEvidence, number> = {
  reviewed: 1,
  declared: 0.75,
  estimated: 0.35,
  unknown: 0,
};

/**
 * Adapted from the uploaded Fabric -> Design Engine prototype, but intentionally
 * limited to physical suitability. Occasion, colour, construction taste and
 * outfit intelligence remain owned by the existing Linen Earth Designer.
 *
 * These targets are provisional until Linen Earth calibrates them against real
 * rolls and finished garments.
 */
const GARMENT_PHYSICS_TARGETS: Record<CompatibilityGarmentType, GarmentPhysicsTarget> = {
  shirt: {
    label: "Shirt",
    weights: { gsm: 0.22, drape: 0.18, structure: 0.18, breathability: 0.22, wrinkleResistance: 0.12, stretch: 0.08 },
    targets: {
      gsm: { kind: "range", range: [110, 220], tolerance: 90 },
      drape: { kind: "target", target: 0.55, tolerance: 0.55 },
      structure: { kind: "range", range: [0.15, 0.75], tolerance: 0.35 },
      breathability: { kind: "minimum", min: 0.5, tolerance: 0.5 },
      wrinkleResistance: { kind: "minimum", min: 0.3, tolerance: 0.3 },
      stretch: { kind: "target", target: 0.12, tolerance: 0.5 },
    },
    critical: ["gsm"],
  },
  trouser: {
    label: "Trouser",
    weights: { gsm: 0.24, drape: 0.2, structure: 0.24, breathability: 0.12, wrinkleResistance: 0.12, stretch: 0.08 },
    targets: {
      gsm: { kind: "range", range: [220, 380], tolerance: 120 },
      drape: { kind: "target", target: 0.55, tolerance: 0.5 },
      structure: { kind: "range", range: [0.3, 0.9], tolerance: 0.35 },
      breathability: { kind: "minimum", min: 0.4, tolerance: 0.45 },
      wrinkleResistance: { kind: "minimum", min: 0.4, tolerance: 0.4 },
      stretch: { kind: "target", target: 0.16, tolerance: 0.5 },
    },
    critical: ["gsm", "structure"],
  },
  suit: {
    label: "Suit",
    weights: { gsm: 0.22, drape: 0.2, structure: 0.32, breathability: 0.08, wrinkleResistance: 0.12, stretch: 0.06 },
    targets: {
      gsm: { kind: "range", range: [240, 400], tolerance: 120 },
      drape: { kind: "target", target: 0.45, tolerance: 0.4 },
      structure: { kind: "range", range: [0.65, 1], tolerance: 0.35 },
      breathability: { kind: "minimum", min: 0.3, tolerance: 0.4 },
      wrinkleResistance: { kind: "minimum", min: 0.55, tolerance: 0.5 },
      stretch: { kind: "target", target: 0.06, tolerance: 0.35 },
    },
    critical: ["gsm", "structure", "drape"],
  },
  blazer: {
    label: "Blazer",
    weights: { gsm: 0.22, drape: 0.2, structure: 0.32, breathability: 0.08, wrinkleResistance: 0.12, stretch: 0.06 },
    targets: {
      gsm: { kind: "range", range: [220, 380], tolerance: 120 },
      drape: { kind: "target", target: 0.45, tolerance: 0.4 },
      structure: { kind: "range", range: [0.6, 1], tolerance: 0.35 },
      breathability: { kind: "minimum", min: 0.3, tolerance: 0.4 },
      wrinkleResistance: { kind: "minimum", min: 0.5, tolerance: 0.5 },
      stretch: { kind: "target", target: 0.06, tolerance: 0.35 },
    },
    critical: ["gsm", "structure", "drape"],
  },
  kurta: {
    label: "Kurta",
    weights: { gsm: 0.18, drape: 0.28, structure: 0.14, breathability: 0.22, wrinkleResistance: 0.1, stretch: 0.08 },
    targets: {
      gsm: { kind: "range", range: [120, 280], tolerance: 100 },
      drape: { kind: "target", target: 0.75, tolerance: 0.55 },
      structure: { kind: "range", range: [0.1, 0.7], tolerance: 0.4 },
      breathability: { kind: "minimum", min: 0.6, tolerance: 0.5 },
      wrinkleResistance: { kind: "minimum", min: 0.25, tolerance: 0.35 },
      stretch: { kind: "target", target: 0.1, tolerance: 0.5 },
    },
    critical: ["gsm", "drape"],
  },
  bandhgala: {
    label: "Bandhgala / Jodhpuri",
    weights: { gsm: 0.22, drape: 0.18, structure: 0.34, breathability: 0.08, wrinkleResistance: 0.12, stretch: 0.06 },
    targets: {
      gsm: { kind: "range", range: [220, 360], tolerance: 110 },
      drape: { kind: "target", target: 0.5, tolerance: 0.4 },
      structure: { kind: "range", range: [0.55, 1], tolerance: 0.35 },
      breathability: { kind: "minimum", min: 0.3, tolerance: 0.4 },
      wrinkleResistance: { kind: "minimum", min: 0.5, tolerance: 0.5 },
      stretch: { kind: "target", target: 0.05, tolerance: 0.35 },
    },
    critical: ["gsm", "structure", "drape"],
  },
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function unknownValue(): FabricPhysicsValue {
  return { value: null, evidence: "unknown" };
}

function knownValue(value: number | null, evidence: FabricPhysicsEvidence, note?: string): FabricPhysicsValue {
  if (value === null || !Number.isFinite(value)) return unknownValue();
  return { value, evidence, ...(note ? { note } : {}) };
}

/**
 * Existing catalogue fields are mapped conservatively. GSM and the current
 * categorical drape can enter as declared evidence; no structure,
 * breathability, wrinkle or stretch values are invented.
 */
export function fabricPhysicsFromDesignerFabric(
  fabric: FabricPhysicsSource,
  patch: FabricPhysicsPatch = {},
  evidence: FabricPhysicsEvidenceOverrides = {},
): FabricPhysicsProfile {
  const drapeMap: Record<NonNullable<FabricPhysicsSource["drape"]>, number> = {
    Fluid: 0.85,
    Balanced: 0.55,
    Structured: 0.25,
  };
  const baseDrape = fabric.drape ? drapeMap[fabric.drape] : null;
  const value = (key: FabricPhysicsDimension, fallback: number | null) =>
    Object.hasOwn(patch, key) ? patch[key] ?? null : fallback;
  const evidenceFor = (key: FabricPhysicsDimension, present: boolean): FabricPhysicsEvidence =>
    evidence[key] ?? (present ? "declared" : "unknown");

  const gsm = value("gsm", fabric.weightGsm);
  const drape = value("drape", baseDrape);
  const structure = value("structure", null);
  const breathability = value("breathability", null);
  const wrinkleResistance = value("wrinkleResistance", null);
  const stretch = value("stretch", null);

  return {
    version: "linen-earth-fabric-physics-v1",
    fabricId: fabric.id,
    gsm: knownValue(gsm, evidenceFor("gsm", gsm !== null), "Physical fabric weight in GSM."),
    drape: knownValue(drape, evidenceFor("drape", drape !== null), fabric.drape ? `Mapped from ${fabric.drape} drape classification.` : undefined),
    structure: knownValue(structure, evidenceFor("structure", structure !== null)),
    breathability: knownValue(breathability, evidenceFor("breathability", breathability !== null)),
    wrinkleResistance: knownValue(wrinkleResistance, evidenceFor("wrinkleResistance", wrinkleResistance !== null)),
    stretch: knownValue(stretch, evidenceFor("stretch", stretch !== null)),
  };
}

function scoreTarget(value: number, target: DimensionTarget) {
  if (target.kind === "range") {
    const [min, max] = target.range;
    if (value >= min && value <= max) return 1;
    const distance = value < min ? min - value : value - max;
    return clamp01(1 - distance / target.tolerance);
  }
  if (target.kind === "minimum") {
    if (value >= target.min) return 1;
    return clamp01(1 - (target.min - value) / target.tolerance);
  }
  return clamp01(1 - Math.abs(value - target.target) / target.tolerance);
}

function dimensionLabel(key: FabricPhysicsDimension) {
  return ({
    gsm: "GSM",
    drape: "drape",
    structure: "structure",
    breathability: "breathability",
    wrinkleResistance: "wrinkle resistance",
    stretch: "stretch",
  } as const)[key];
}

function normalizePhysicsValue(key: FabricPhysicsDimension, value: number) {
  if (key === "gsm") return value;
  return clamp01(value);
}

function climateAdjustment(
  profile: FabricPhysicsProfile,
  context: FabricCompatibilityContext,
  reasons: string[],
  warnings: string[],
) {
  if (context.climate !== "Hot / humid") return 0;
  let adjustment = 0;
  if (profile.gsm.value !== null && profile.gsm.value > 300) {
    adjustment -= 0.08;
    warnings.push("Heavy cloth needs extra comfort review for hot/humid wear.");
  }
  if (profile.breathability.value !== null) {
    if (profile.breathability.value >= 0.7) {
      adjustment += 0.05;
      reasons.push("Measured/declared breathability supports hot-humid wear.");
    } else if (profile.breathability.value < 0.45) {
      adjustment -= 0.08;
      warnings.push("Breathability is weak for hot/humid wear.");
    }
  }
  return adjustment;
}

export function scoreFabricPhysicsForGarment(
  profile: FabricPhysicsProfile,
  garmentType: CompatibilityGarmentType,
  context: FabricCompatibilityContext = {},
): FabricCompatibilityResult {
  const garment = GARMENT_PHYSICS_TARGETS[garmentType];
  const dimensions = Object.keys(garment.weights) as FabricPhysicsDimension[];
  const totalWeight = dimensions.reduce((sum, key) => sum + garment.weights[key], 0);
  let knownWeight = 0;
  let scoredWeight = 0;
  let confidenceWeight = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  for (const key of dimensions) {
    const fact = profile[key];
    if (fact.value === null || fact.evidence === "unknown") continue;
    const weight = garment.weights[key];
    const value = normalizePhysicsValue(key, fact.value);
    const fit = scoreTarget(value, garment.targets[key]);
    knownWeight += weight;
    scoredWeight += fit * weight;
    confidenceWeight += weight * qualityWeight[fact.evidence];
    if (fit >= 0.9) reasons.push(`${dimensionLabel(key)} sits in the preferred ${garment.label.toLowerCase()} zone.`);
    else if (fit < 0.5) warnings.push(`${dimensionLabel(key)} is outside the preferred ${garment.label.toLowerCase()} zone.`);
  }

  const evidenceCoverage = totalWeight ? (knownWeight / totalWeight) * 100 : 0;
  const evidenceConfidence = totalWeight ? (confidenceWeight / totalWeight) * 100 : 0;
  const baseScore = knownWeight ? (scoredWeight / knownWeight) : 0.5;
  const adjusted = clamp01(baseScore + climateAdjustment(profile, context, reasons, warnings));
  const score = round1(adjusted * 100);
  const criticalUnknowns = garment.critical.filter((key) => profile[key].value === null || profile[key].evidence === "unknown");

  if (criticalUnknowns.length) {
    warnings.push(`Need ${criticalUnknowns.map(dimensionLabel).join(", ")} before treating this as a production-grade compatibility result.`);
  }

  let status: FabricCompatibilityStatus;
  if (evidenceCoverage < 35 || criticalUnknowns.length) status = "insufficient_evidence";
  else if (score >= 85 && evidenceConfidence >= 65) status = "strong";
  else if (score >= 70) status = "workable";
  else if (score >= 50) status = "review";
  else status = "not_recommended";

  return {
    version: "linen-earth-fabric-compatibility-v1",
    garmentType,
    label: garment.label,
    score,
    status,
    evidenceCoverage: round1(evidenceCoverage),
    evidenceConfidence: round1(evidenceConfidence),
    criticalUnknowns,
    reasons: [...new Set(reasons)].slice(0, 4),
    warnings: [...new Set(warnings)].slice(0, 4),
    ruleSource: "prototype-adapted-provisional-v1",
  };
}

export function fabricCompatibilityMatrix(
  profile: FabricPhysicsProfile,
  context: FabricCompatibilityContext = {},
): FabricCompatibilityResult[] {
  const garments = Object.keys(GARMENT_PHYSICS_TARGETS) as CompatibilityGarmentType[];
  return garments
    .map((garment) => scoreFabricPhysicsForGarment(profile, garment, context))
    .sort((a, b) => b.score - a.score || b.evidenceConfidence - a.evidenceConfidence || a.label.localeCompare(b.label));
}

export function compatibilityGarmentTypes(): CompatibilityGarmentType[] {
  return Object.keys(GARMENT_PHYSICS_TARGETS) as CompatibilityGarmentType[];
}
