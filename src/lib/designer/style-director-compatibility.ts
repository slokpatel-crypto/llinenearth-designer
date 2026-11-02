import type { DesignerFabricIntelligence } from "../fabric-intelligence-types";
import type { StyleSpecV2 } from "./style-spec-v2";

/**
 * Styling confidence is not a physical-fabric approval. A rejected review
 * must not improve ranking, even when stale intelligence says "reviewed".
 */
export function styleDirectorIntelligenceTrustWeight(
  value: Pick<DesignerFabricIntelligence, "trust" | "reviewStatus"> | null | undefined,
): number {
  if (!value || value.reviewStatus === "rejected") return 0;
  if (value.trust === "reviewed") {
    return value.reviewStatus === "approved" || value.reviewStatus === "corrected" ? 1 : 0.28;
  }
  if (value.trust === "high-confidence") return 0.72;
  return 0.28;
}

export type DirectorConstructionIssue = {
  code: "camp_collar_construction" | "short_sleeve_double_cuff" |
    "pleated_front_missing_pleat" | "flat_front_has_pleat" | "cropped_full_break";
  explanation: string;
};

/**
 * Non-destructive compatibility checks on versioned construction IDs.
 * These are review signals, not tailor approval or automatic changes to a
 * customer's locked selection. No physical measurements are inferred.
 */
export function styleDirectorConstructionIssues(
  spec: Pick<StyleSpecV2, "shirt" | "pant">,
): DirectorConstructionIssue[] {
  const issues: DirectorConstructionIssue[] = [];
  const { shirt, pant } = spec;
  if (shirt.type === "camp_collar_resort" &&
      (shirt.wear !== "untucked" || shirt.collar !== "cuban_camp_collar")) {
    issues.push({
      code: "camp_collar_construction",
      explanation: "The proposed camp-collar resort shirt needs an untucked, open camp-collar construction review.",
    });
  }
  if (shirt.sleeve === "half_sleeve" && shirt.cuff === "french_double_cuff") {
    issues.push({
      code: "short_sleeve_double_cuff",
      explanation: "A short-sleeve shirt cannot use the proposed full-length French double-cuff construction.",
    });
  }
  if (pant.type === "pleated_trouser" && pant.pleat === "flat_front") {
    issues.push({
      code: "pleated_front_missing_pleat",
      explanation: "The proposed pleated trouser has a flat-front construction; confirm the intended pleat.",
    });
  }
  if (pant.type === "formal_flat_front" && pant.pleat !== "flat_front") {
    issues.push({
      code: "flat_front_has_pleat",
      explanation: "The proposed flat-front trouser includes pleats; confirm the actual front construction.",
    });
  }
  if ((pant.type === "cropped_ankle" || pant.hem === "cropped_above_ankle_hem") &&
      pant.break === "full_break") {
    issues.push({
      code: "cropped_full_break",
      explanation: "A cropped trouser hem conflicts with a full shoe break; confirm the intended length.",
    });
  }
  return issues;
}
