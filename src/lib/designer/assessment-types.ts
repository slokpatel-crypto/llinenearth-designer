import type { DesignerRecommendation } from "@/lib/designer/engine";
import type { FitConstructionAssessment } from "@/lib/designer/fit-construction";
import type { DesignerBlockStrategy } from "@/lib/designer/block-strategy";
import type { BrandLanguageEvaluation } from "@/lib/designer/brand-language";
import type { DesignerNegotiation } from "@/lib/designer/constraint-negotiation";
import type { CanonicalGarmentSpec } from "@/lib/designer/garment-spec";

export type DesignerAssessmentResponse = {
  recommendation:DesignerRecommendation;
  fitConstruction:FitConstructionAssessment;
  blockStrategy:DesignerBlockStrategy;
  brandLanguage:BrandLanguageEvaluation;
  negotiation:DesignerNegotiation;
  garmentSpec:CanonicalGarmentSpec;
};
