import type { MeasurementProfile } from "@/lib/measurements";
import type { DesignerRecommendation } from "@/lib/designer/engine";
import type { FitConstructionAssessment, FinishedTarget } from "@/lib/designer/fit-construction";
import type { BrandLanguageEvaluation } from "@/lib/designer/brand-language";
import type { DesignerBlockStrategy } from "@/lib/designer/block-strategy";
import type { CreativeDirection } from "@/lib/designer/creative-engine";
import type { StyleSpecV2 } from "@/lib/designer/style-spec-v2";
import type { BodyPreviewProfile } from "@/lib/designer/body-profile";

export type CanonicalGarmentSpecStatus = "draft" | "review_required" | "ready_for_tailor_review";

export type CanonicalCreativeVisualReview = {
  status:"pass"|"review";
  heroVisibility:number;
  boundaryIntegrity:number;
  protectedChange:number;
  evidenceAvailable:boolean;
  semanticAvailable:boolean;
  semanticStatus?:"pass"|"review";
  semanticIssue?:string;
  redesignReason?:string;
};

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
    styleSchemaVersion:2|null;
  };
  styleSpec:StyleSpecV2|null;
  bodyProfile:BodyPreviewProfile|null;
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
  creative: {
    conceptId:string;
    name:string;
    thesis:string;
    explorationClass:CreativeDirection["explorationClass"];
    iteration:number;
    researchUtilization:number;
    treatments:Array<{
      id:string;
      zone:string;
      label:string;
      instruction:string;
      visualPurpose:string;
      intensity:number;
      buildability:string;
    }>;
    pattern: {
      id:string;
      name:string;
      family:string;
      layout:string;
      scale:string;
      coverage:number;
      palette:string[];
      placement:string;
      note:string;
    } | null;
    research:Array<{
      id:string;
      sourceTitle:string;
      sourceUrl:string;
      extractedPrinciple:string;
      transformedInto:string;
    }>;
    visualReview:CanonicalCreativeVisualReview | null;
  } | null;
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
  block?: DesignerBlockStrategy | null,
  creative?: CreativeDirection | null,
  creativeVisualReview?: CanonicalCreativeVisualReview | null,
  styleSpec?:StyleSpecV2|null,
  bodyProfile?:BodyPreviewProfile|null,
): CanonicalGarmentSpec {
  const materialMissing = recommendation.materialEvidence.missing;
  const fitChecks = fit?.checks ?? [];
  const blockingConstruction = fitChecks.some((item) => item.severity === "warning");
  const reviewConstruction = fitChecks.some((item) => item.severity === "review");
  const insufficientMeasurements = !fit || fit.status === "insufficient_measurements";
  const hardDesignerFlag = recommendation.rules.some((item) => item.status === "flag" && item.severity === "High");
  const creativeVisualReviewRequired = Boolean(
    creative && (
      !creativeVisualReview?.evidenceAvailable ||
      creativeVisualReview.status !== "pass" ||
      (creativeVisualReview.semanticAvailable && creativeVisualReview.semanticStatus === "review")
    )
  );

  const unresolved = [
    ...recommendation.confirmationsNeeded,
    ...fitChecks.filter((item) => item.severity !== "info").map((item) => item.message),
    ...(creativeVisualReviewRequired ? [
      creativeVisualReview?.semanticIssue || "Creative concept still needs a passing photoreal visual review."
    ] : []),
  ].filter((value, index, all) => all.indexOf(value) === index);

  const status: CanonicalGarmentSpecStatus =
    hardDesignerFlag || blockingConstruction || creativeVisualReviewRequired ? "review_required"
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
      styleSchemaVersion:styleSpec?.styleSchemaVersion ?? null,
    },
    styleSpec:styleSpec ? {
      ...styleSpec,
      shirt:{...styleSpec.shirt},
      pant:{...styleSpec.pant},
      legacy:{...styleSpec.legacy},
    } : null,
    bodyProfile:bodyProfile ? {...bodyProfile} : null,
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
    creative: creative ? {
      conceptId:creative.id,
      name:creative.name,
      thesis:creative.thesis,
      explorationClass:creative.explorationClass,
      iteration:creative.iteration,
      researchUtilization:creative.researchUtilization,
      treatments:creative.treatments.map((item)=>({
        id:item.id,
        zone:item.zone,
        label:item.label,
        instruction:item.instruction,
        visualPurpose:item.visualPurpose,
        intensity:item.intensity,
        buildability:item.buildability,
      })),
      pattern:creative.pattern ? {
        id:creative.pattern.id,
        name:creative.pattern.name,
        family:creative.pattern.family,
        layout:creative.pattern.layout,
        scale:creative.pattern.scale,
        coverage:creative.pattern.coverage,
        palette:[...creative.pattern.palette],
        placement:creative.pattern.placement,
        note:creative.pattern.note,
      } : null,
      research:creative.research.map((item)=>({...item})),
      visualReview:creativeVisualReview ? {
        status:creativeVisualReview.status,
        heroVisibility:creativeVisualReview.heroVisibility,
        boundaryIntegrity:creativeVisualReview.boundaryIntegrity,
        protectedChange:creativeVisualReview.protectedChange,
        evidenceAvailable:creativeVisualReview.evidenceAvailable,
        semanticAvailable:creativeVisualReview.semanticAvailable,
        semanticStatus:creativeVisualReview.semanticStatus,
        semanticIssue:creativeVisualReview.semanticIssue,
        redesignReason:creativeVisualReview.redesignReason,
      } : null,
    } : null,
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
      visualization: hardDesignerFlag || blockingConstruction || creativeVisualReviewRequired ? "visual_review_required" : "supported_with_current_template",
      tailoring: insufficientMeasurements ? "insufficient_measurements" : "tailor_review_required",
      materialVerification: materialMissing.length ? "verification_required" : "verified",
    },
    caveats: [
      ...(fit?.caveats ?? []),
      ...(block?.caveats ?? []),
      "This specification coordinates Designer, visualization and tailoring review; it is not a cutting pattern.",
      "Verified physical cloth data takes precedence over catalogue-derived appearance.",
      ...(styleSpec ? ["Expanded shirt and trouser construction is stored as stable StyleSpec v2 IDs."] : []),
      ...(bodyProfile ? ["Body preview settings guide visualization only and do not replace tailoring measurements."] : []),
      ...(creative ? ["Creative treatments are design instructions for visualization and tailor/pattern-maker review; they are not production-ready pattern pieces."] : []),
      ...(creativeVisualReviewRequired ? ["A creative concept is not visualization-ready until the rendered result passes the visual QA loop or receives explicit human review."] : []),
    ],
  };
}

export function canonicalGarmentSpecSummary(spec: CanonicalGarmentSpec) {
  const shirt = `${spec.fabrics.shirt.name} · ${spec.shirt.fit} · ${spec.shirt.collar} · ${spec.shirt.wear}`;
  const trouser = `${spec.fabrics.trouser.name} · ${spec.trouser.shape} · ${spec.trouser.rise} · ${spec.trouser.break}`;
  return { shirt, trouser, status: spec.status };
}
