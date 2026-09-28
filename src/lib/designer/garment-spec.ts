import type { MeasurementProfile } from "@/lib/measurements";
import type { DesignerRecommendation } from "@/lib/designer/engine";
import type { FitConstructionAssessment, FinishedTarget } from "@/lib/designer/fit-construction";
import type { BrandLanguageEvaluation } from "@/lib/designer/brand-language";
import type { DesignerBlockStrategy } from "@/lib/designer/block-strategy";

export type CanonicalGarmentSpecStatus = "draft" | "review_required" | "ready_for_tailor_review";

export type CanonicalGarmentMeasurement = {
  label: string;
  bodyCm: number;
  finishedCm: { min: number; max: number };
  easeCm?: { min: number; max: number };
  basis: FinishedTarget["basis"];
};

export type CanonicalGarmentSpec = {
  version: "linen-earth-garment-spec-v1";
  status: CanonicalGarmentSpecStatus;
  source: {
    designerRuleSetVersion: string;
    fitConstructionVersion: FitConstructionAssessment["version"] | null;
    measurementProfileVersion: MeasurementProfile["version"] | null;
    blockStrategyVersion: DesignerBlockStrategy["version"] | null;
  };
  context: {
    occasion: DesignerRecommendation["occasion"];
    climate: DesignerRecommendation["context"]["climate"];
    intention: DesignerRecommendation["context"]["intention"];
  };
  fabrics: {
    shirt: {
      id: string;
      name: string;
      line: string;
      source: string;
      verifiedMaterialFacts: number;
    };
    trouser: {
      id: string;
      name: string;
      line: string;
      source: string;
      verifiedMaterialFacts: number;
    };
  };
  shirt: {
    fit: string;
    wear: string;
    collar: string;
    collarFinish: string;
    cuff: string;
    placket: string;
    button: string;
    finishedTargets: CanonicalGarmentMeasurement[];
  };
  trouser: {
    shape: string;
    rise: string;
    waistband: string;
    break: string;
    finishedTargets: CanonicalGarmentMeasurement[];
  };
  decision: {
    designFitScore: number;
    confidenceScore: number;
    fitConstructionScore: number | null;
    brandLanguageScore: number | null;
    blockStrategyScore: number | null;
  };
  blockStrategy: {
    shirtBlock: DesignerBlockStrategy["shirtBlock"];
    trouserBlock: DesignerBlockStrategy["trouserBlock"];
    torsoShape: DesignerBlockStrategy["torsoShape"];
    seatShape: DesignerBlockStrategy["seatShape"];
    adjustments: DesignerBlockStrategy["adjustments"];
  } | null;
  constructionChecks: Array<{
    id: string;
    severity: "info" | "review" | "warning";
    message: string;
  }>;
  unresolved: string[];
  readiness: {
    visualization: "supported_with_current_template" | "visual_review_required";
    tailoring: "insufficient_measurements" | "tailor_review_required";
    materialVerification: "verified" | "verification_required";
  };
  caveats: string[];
};

function target(target: FinishedTarget): CanonicalGarmentMeasurement {
  return {
    label: target.label,
    bodyCm: target.bodyCm,
    finishedCm: { ...target.finishedCm },
    ...(target.easeCm ? { easeCm: { ...target.easeCm } } : {}),
    basis: target.basis,
  };
}

function fabricVerifiedFacts(name: string, missing: string[]) {
  return missing.filter((item) => item.startsWith(`${name}:`)).length;
}

export function buildCanonicalGarmentSpec(
  recommendation: DesignerRecommendation,
  fit: FitConstructionAssessment | null | undefined,
  measurements: MeasurementProfile | null | undefined,
  brand?: BrandLanguageEvaluation | null,
): CanonicalGarmentSpec {
  const materialMissing = recommendation.materialEvidence.missing;
  const fitChecks = fit?.checks ?? [];
  const blockingConstruction = fitChecks.some((item) => item.severity === "warning");
  const reviewConstruction = fitChecks.some((item) => item.severity === "review");
  const insufficientMeasurements = !fit || fit.status === "insufficient_measurements";
  const hardDesignerFlag = recommendation.rules.some((item) => item.status === "flag" && item.severity === "High");

  const unresolved = [
    ...recommendation.confirmationsNeeded,
    ...fitChecks.filter((item) => item.severity !== "info").map((item) => item.message),
  ].filter((value, index, all) => all.indexOf(value) === index);

  const status: CanonicalGarmentSpecStatus =
    hardDesignerFlag || blockingConstruction ? "review_required"
      : insufficientMeasurements || reviewConstruction || materialMissing.length > 0 ? "draft"
        : "ready_for_tailor_review";

  return {
    version: "linen-earth-garment-spec-v1",
    status,
    source: {
      designerRuleSetVersion: recommendation.ruleSetVersion,
      fitConstructionVersion: fit?.version ?? null,
      measurementProfileVersion: measurements?.version ?? null,
      blockStrategyVersion: block?.version ?? null,
    },
    context: {
      occasion: recommendation.occasion,
      climate: recommendation.context.climate,
      intention: recommendation.context.intention,
    },
    fabrics: {
      shirt: {
        id: recommendation.shirt.id,
        name: recommendation.shirt.name,
        line: recommendation.shirt.line,
        source: recommendation.shirt.source,
        verifiedMaterialFacts: 8 - fabricVerifiedFacts(recommendation.shirt.name, materialMissing),
      },
      trouser: {
        id: recommendation.pant.id,
        name: recommendation.pant.name,
        line: recommendation.pant.line,
        source: recommendation.pant.source,
        verifiedMaterialFacts: 8 - fabricVerifiedFacts(recommendation.pant.name, materialMissing),
      },
    },
    shirt: {
      fit: recommendation.style.shirtFit,
      wear: recommendation.style.shirtWear,
      collar: recommendation.style.collar,
      collarFinish: recommendation.style.collarFinish,
      cuff: recommendation.style.cuff,
      placket: recommendation.style.placket,
      button: recommendation.style.button,
      finishedTargets: (fit?.shirtTargets ?? []).map(target),
    },
    trouser: {
      shape: recommendation.style.trouser,
      rise: recommendation.style.rise,
      waistband: recommendation.style.waistband,
      break: recommendation.style.break,
      finishedTargets: (fit?.trouserTargets ?? []).map(target),
    },
    decision: {
      designFitScore: recommendation.designFitScore,
      confidenceScore: recommendation.confidenceScore,
      fitConstructionScore: fit?.fitScore ?? null,
      brandLanguageScore: brand?.score ?? null,
      blockStrategyScore: block?.score ?? null,
    },
    blockStrategy: block ? {
      shirtBlock: block.shirtBlock,
      trouserBlock: block.trouserBlock,
      torsoShape: block.torsoShape,
      seatShape: block.seatShape,
      adjustments: block.adjustments.map((item) => ({ ...item })),
    } : null,
    constructionChecks: fitChecks.map((item) => ({ ...item })),
    unresolved,
    readiness: {
      visualization: hardDesignerFlag || blockingConstruction ? "visual_review_required" : "supported_with_current_template",
      tailoring: insufficientMeasurements ? "insufficient_measurements" : "tailor_review_required",
      materialVerification: materialMissing.length ? "verification_required" : "verified",
    },
    caveats: [
      ...(fit?.caveats ?? []),
      ...(block?.caveats ?? []),
      "This specification coordinates Designer, visualization and tailoring review; it is not a cutting pattern.",
      "Verified physical cloth data takes precedence over catalogue-derived appearance.",
    ],
  };
}

export function canonicalGarmentSpecSummary(spec: CanonicalGarmentSpec) {
  const shirt = `${spec.fabrics.shirt.name} · ${spec.shirt.fit} · ${spec.shirt.collar} · ${spec.shirt.wear}`;
  const trouser = `${spec.fabrics.trouser.name} · ${spec.trouser.shape} · ${spec.trouser.rise} · ${spec.trouser.break}`;
  return { shirt, trouser, status: spec.status };
}
