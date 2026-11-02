import type { DesignerFabricIntelligence } from "../fabric-intelligence-types";
import type { StyleSpecV2 } from "./style-spec-v2";
import type { DesignerStyle, OccasionTier } from "./engine";

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
    "pleated_front_missing_pleat" | "flat_front_has_pleat" | "cropped_full_break" |
    "formal_camp_collar" | "legacy_wear_mismatch" | "legacy_collar_mismatch";
  explanation: string;
};

/**
 * Non-destructive compatibility checks on versioned construction IDs.
 * These are review signals, not tailor approval or automatic changes to a
 * customer's locked selection. No physical measurements are inferred.
 */
export function styleDirectorConstructionIssues(
  spec: Pick<StyleSpecV2, "shirt" | "pant">,
  occasion?: OccasionTier,
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
  if (shirt.type === "camp_collar_resort" &&
      (occasion === "Formal" || occasion === "Semi-Formal")) {
    issues.push({
      code: "formal_camp_collar",
      explanation: "An open, untucked camp-collar shirt needs an explicit formality review for this occasion; no tailor approval is implied.",
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

/**
 * Fail closed when the legacy photographic style and the versioned garment
 * construction would tell a customer to wear or cut different shirts.
 * Only camp/band collars are compared by label here: other advanced collars
 * may have intentionally approximate legacy previews.
 */
export function styleDirectorPresentationIssues(
  style: Pick<DesignerStyle, "collar" | "shirtWear">,
  spec: Pick<StyleSpecV2, "shirt">,
): DirectorConstructionIssue[] {
  const issues: DirectorConstructionIssue[] = [];
  const expectedWear = style.shirtWear === "Tucked" ? "tucked"
    : style.shirtWear === "Untucked" ? "untucked" : null;
  if (expectedWear !== spec.shirt.wear) {
    issues.push({
      code: "legacy_wear_mismatch",
      explanation: "The photographic shirt-wear choice disagrees with the versioned construction; verify the intended tuck before proceeding.",
    });
  }
  const legacyCollar = /camp|cuban/i.test(style.collar) ? "cuban_camp_collar"
    : /band|mandarin/i.test(style.collar) ? "mandarin_band_collar" : null;
  const versionedCollar = spec.shirt.collar;
  if (legacyCollar !== versionedCollar &&
      (legacyCollar !== null || versionedCollar === "cuban_camp_collar" || versionedCollar === "mandarin_band_collar")) {
    issues.push({
      code: "legacy_collar_mismatch",
      explanation: "The photographic collar choice disagrees with the versioned camp/band collar; review both without changing the locked IDs.",
    });
  }
  return issues;
}

/**
 * Resolve the wear choice of a proposed (not yet locked) Style Director shirt.
 * Camp-collar construction stays untucked even in formal prompts, where it
 * is separately marked needs_review rather than silently changed.
 */
export function styleDirectorWearForCandidate(
  occasion: OccasionTier,
  candidateShirt: string,
  proposedWear: DesignerStyle["shirtWear"],
): DesignerStyle["shirtWear"] {
  if (/camp|cuban/i.test(candidateShirt)) return "Untucked";
  if (occasion === "Formal" || occasion === "Semi-Formal") return "Tucked";
  return proposedWear;
}
