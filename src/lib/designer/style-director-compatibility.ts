import type { DesignerFabricIntelligence } from "../fabric-intelligence-types";
import type { StyleSpecV2 } from "./style-spec-v2";
import type { DesignerStyle, OccasionTier } from "./engine";
import { optionsFor } from "./options/library.ts";

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

const candidateCollarFamilies = (name: string) => ({
  camp: /\b(?:camp|cuban)(?:[- ]collar)?\b/i.test(name),
  band: /\b(?:band|mandarin)(?:[- ]collar)?\b/i.test(name),
  cutaway: /\bcutaway(?:[- ]collar)?\b/i.test(name),
});

const candidateSleeveLengths = (name: string) => ({
  short: /\b(?:short|half)[ -]?sleeved?\b/i.test(name),
  long: /\b(?:long|full)[ -]?sleeved?\b/i.test(name),
});

/**
 * One deterministic interpretation of named camp/band shirt candidates for
 * both the photographic legacy selector and the versioned construction.
 * If a legacy photo option is unavailable, keep its existing selection and
 * let presentation parity explicitly require review; never invent a label.
 */
export function styleDirectorCandidateCollar(
  candidateShirt: string,
  legacyChoices: readonly string[],
): { legacy: string | null; versioned: "cuban_camp_collar" | "mandarin_band_collar" | "cutaway_collar" } | null {
  const { camp, band, cutaway } = candidateCollarFamilies(candidateShirt);
  // Conflicting named collar families are ambiguous, not permission to pick
  // the first match and silently rewrite a proposed construction ID.
  if (Number(camp) + Number(band) + Number(cutaway) !== 1) return null;
  const matcher = camp ? /\b(?:camp|cuban)\b/i : band ? /\b(?:band|mandarin)\b/i : /\bcutaway\b/i;
  return {
    legacy: legacyChoices.find((label) => matcher.test(label) &&
      Number(/\b(?:camp|cuban)\b/i.test(label)) +
      Number(/\b(?:band|mandarin)\b/i.test(label)) +
      Number(/\bcutaway\b/i.test(label)) === 1) ?? null,
    versioned: camp ? "cuban_camp_collar" : band ? "mandarin_band_collar" : "cutaway_collar",
  };
}

/** Candidate wording is not a measured sleeve length. Only an explicit
 * short-/half-sleeve request maps to the existing construction IDs. */
export function styleDirectorCandidateSleeve(
  candidateShirt: string,
): { sleeve: "half_sleeve"; cuff: "open_short_hem_cuff" } | null {
  const { short: shortSleeve, long: longSleeve } = candidateSleeveLengths(candidateShirt);
  // Contradictory sleeve descriptions cannot safely select a construction.
  // Retain the existing default rather than silently interpreting one half.
  return shortSleeve && !longSleeve
    ? { sleeve: "half_sleeve", cuff: "open_short_hem_cuff" }
    : null;
}

/**
 * Interpret an untrusted candidate trouser label without turning negative
 * instructions such as "without visible pleats" into positive pleat requests.
 * Null means the label supplies no supported front construction instruction.
 * Ambiguous means the author asked for incompatible front constructions.
 */
// A negative-only trouser name is an explicit flat-front instruction too.
// Normalise once so review, photo and versioned garment selectors cannot
// disagree about "No Pleats" or misread "Non-Pleated" as positive pleats.
function stripNegatedPleatWording(candidateTrouser: string) {
  return candidateTrouser.replace(
    /\b(?:non[- ]?pleated|unpleated|pleat[- ]?free|pleatless|not\s+(?:a\s+)?pleated|(?:no|without|zero|never|avoid|do\s+not|don['’]?t|(?:do\s+not|don['’]?t|never|avoid)\s+(?:use|add|include|choose))\s+(?:(?:a|an|any|visible|front(?:[- ]facing)?|side(?:[- ]facing)?)\s+){0,3}(?:pleats?|pleating|pleated))\b/gi,
    "",
  );
}

export function styleDirectorCandidateTrouserFront(
  candidateTrouser: string,
): "flat_front" | "pleated" | "ambiguous" | null {
  const flatFront = /\bflat[- ]?front\b/i.test(candidateTrouser);
  const positiveWording = stripNegatedPleatWording(candidateTrouser).replace(
    /\bpleat(?:s|ing)?\s+(?:(?:are|is)\s+)?(?:(?:not\s+(?:allowed|permitted)|prohibited|forbidden|banned|disallowed)|(?:(?:should|must)\s+not|cannot|can['’]?t)\s+be\s+(?:used|added|included)|(?:are|is)\s+not\s+to\s+be\s+(?:used|added|included)|(?:must|should)\s+be\s+avoided|(?:aren['’]?t|isn['’]?t)\s+(?:allowed|permitted))\b/gi,
    "",
  );
  const explicitlyNoPleats = positiveWording !== candidateTrouser;
  // Negating a particular pleat count does not prohibit all pleats. In
  // particular, "no double pleats" must not become a positive pleat request.
  const unqualifiedPositiveWording = positiveWording.replace(
    /\b(?:no|without|not|avoid|never|do\s+not|don['’]?t)\s+(?:(?:use|add|include|choose)\s+)?(?:(?:a|an|any|visible|front(?:[- ]facing)?|side(?:[- ]facing)?)\s+){0,3}(?:single|double|one|two|1|2)[ -]?pleat(?:ed|s|ing)?\b/gi,
    "",
  );
  const positivePleat = /\bpleat(?:ed|s|ing)?\b/i.test(unqualifiedPositiveWording);
  if ((flatFront || explicitlyNoPleats) && positivePleat) return "ambiguous";
  if (positivePleat) return "pleated";
  return flatFront || explicitlyNoPleats ? "flat_front" : null;
}

export type DirectorConstructionIssue = {
  code: "camp_collar_construction" | "band_collar_construction" | "short_sleeve_double_cuff" |
    "pleated_front_missing_pleat" | "flat_front_has_pleat" | "cropped_full_break" | "cropped_half_break" | "cropped_slight_break" | "cropped_type_hem_mismatch" |
    "formal_camp_collar" | "legacy_wear_mismatch" | "legacy_collar_mismatch" | "unverified_camp_photo" |
    "camp_collar_type_mismatch" | "band_collar_type_mismatch" | "short_sleeve_type_mismatch" | "short_sleeve_cuff_review" | "full_sleeve_open_hem_cuff" | "unverified_short_sleeve_photo" | "unverified_cutaway_photo" |
    "ambiguous_candidate_collar" | "ambiguous_candidate_sleeve" | "legacy_trouser_mismatch" |
    "ambiguous_candidate_trouser_front" | "legacy_cuff_mismatch" | "legacy_placket_mismatch" | "legacy_shirt_fit_mismatch" |
    "candidate_trouser_pleat_mismatch" | "legacy_rise_mismatch" | "legacy_waistband_mismatch" | "legacy_break_mismatch";
  explanation: string;
};

/**
 * Conflicting proposed garment names must reach recommendation review.
 * A null resolver alone could otherwise leave default full-sleeve construction
 * looking acceptable despite explicitly contradictory instructions.
 */
export function styleDirectorCandidateWordingIssues(candidateShirt: string, candidateTrouser = ""): DirectorConstructionIssue[] {
  const issues: DirectorConstructionIssue[] = [];
  const { camp, band, cutaway } = candidateCollarFamilies(candidateShirt);
  if (Number(camp) + Number(band) + Number(cutaway) > 1) {
    issues.push({
      code: "ambiguous_candidate_collar",
      explanation: "This proposed shirt names conflicting collar families; confirm one construction before approving the recommendation.",
    });
  }
  const sleeves = candidateSleeveLengths(candidateShirt);
  if (sleeves.short && sleeves.long) {
    issues.push({
      code: "ambiguous_candidate_sleeve",
      explanation: "This proposed shirt names both short and long sleeves; confirm one sleeve construction before approving the recommendation.",
    });
  }
  // A single parser owns both candidate-review and construction selection.
  // Without this, "flat-front non-pleated" could pass review but select a
  // *pleated* photographic and versioned trouser via substring matching.
  if (styleDirectorCandidateTrouserFront(candidateTrouser) === "ambiguous") {
    issues.push({
      code: "ambiguous_candidate_trouser_front",
      explanation: "This proposed trouser names both a flat front and positive pleats; confirm one front construction before approving the recommendation.",
    });
  }
  return issues;
}

/**
 * Candidate wording is an intent, not proof of a garment's front construction.
 * A wide-leg option can legitimately retain its silhouette while silently
 * dropping a requested pleat from the versioned spec. Require a review,
 * rather than fabricating a single/double pleat the photo cannot show.
 */
export function styleDirectorCandidateFrontConstructionIssues(
  candidateTrouser: string,
  pant: Pick<StyleSpecV2["pant"], "pleat">,
): DirectorConstructionIssue[] {
  const front = styleDirectorCandidateTrouserFront(candidateTrouser);
  // A labelled double pleat is not equivalent to a generic single pleat.
  // Read count from the canonical option's construction parameters instead
  // of inferring it from the potentially stale photographed trouser label.
  const positiveWording = stripNegatedPleatWording(candidateTrouser).replace(
    /\b(?:no|without|not|avoid|never|do\s+not|don['’]?t)\s+(?:(?:use|add|include|choose)\s+)?(?:(?:a|an|any|visible|front(?:[- ]facing)?|side(?:[- ]facing)?)\s+){0,3}(?:single|double|one|two|1|2)[ -]?pleat(?:ed|s|ing)?\b/gi,
    "",
  );
  const requestsDouble = /\b(?:double|two|2)[ -]?pleats?\b/i.test(positiveWording);
  const requestsSingle = /\b(?:single|one|1)[ -]?pleats?\b/i.test(positiveWording);
  const expectedCount = front === "pleated"
    ? requestsDouble && !requestsSingle ? 2
      : requestsSingle && !requestsDouble ? 1 : null
    : null;
  const pleatOption = optionsFor("pant.pleat").find(option => option.id === pant.pleat);
  const declaredCount = pleatOption?.parameters.pleatCount;
  // The option catalogue also distinguishes forward/reverse pleat direction.
  // Do not silently substitute one for the other in tailoring instructions.
  const requestsForward = front === "pleated" && /\bforward\b/i.test(positiveWording);
  const requestsReverse = front === "pleated" && /\breverse\b/i.test(positiveWording);
  const expectedDirection = requestsForward !== requestsReverse
    ? requestsForward ? "forward" : "reverse" : null;
  const declaredDirection = pleatOption?.parameters.pleatDirection;
  if ((front === "pleated" && pant.pleat === "flat_front") ||
      (front === "flat_front" && pant.pleat !== "flat_front") ||
      (expectedCount !== null && declaredCount !== expectedCount) ||
      (front === "pleated" && requestsSingle && requestsDouble) ||
      (front === "pleated" && requestsForward && requestsReverse) ||
      (expectedDirection !== null && declaredDirection !== expectedDirection)) {
    return [{
      code: "candidate_trouser_pleat_mismatch",
      explanation: "The proposed trouser front, pleat count or direction contradicts its versioned construction; confirm the intended pleats before cutting without inventing a pleat.",
    }];
  }
  return [];
}

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
  if (shirt.collar === "cuban_camp_collar" && shirt.type !== "camp_collar_resort") {
    issues.push({
      code: "camp_collar_type_mismatch",
      explanation: "The selected Cuban/Camp collar is paired with a different shirt type; confirm the intended open-collar construction before cutting.",
    });
  }
  if (shirt.type === "band_collar_shirt" && shirt.collar !== "mandarin_band_collar") {
    issues.push({
      code: "band_collar_construction",
      explanation: "The proposed band-collar shirt type has a different collar construction; confirm the canonical collar before cutting.",
    });
  }
  if (shirt.collar === "mandarin_band_collar" && shirt.type !== "band_collar_shirt") {
    issues.push({
      code: "band_collar_type_mismatch",
      explanation: "The selected Mandarin/Band collar is paired with a different shirt type; confirm the intended collar construction before cutting.",
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
  if (shirt.type === "short_sleeve_shirt" && shirt.sleeve !== "half_sleeve") {
    issues.push({
      code: "short_sleeve_type_mismatch",
      explanation: "The selected short-sleeve shirt type still specifies a full-length sleeve; confirm the actual sleeve before production.",
    });
  }
  if (shirt.sleeve === "half_sleeve" &&
      shirt.cuff !== "open_short_hem_cuff" && shirt.cuff !== "french_double_cuff") {
    issues.push({
      code: "short_sleeve_cuff_review",
      explanation: "The proposed half-sleeve uses a full-length cuff option; confirm a buildable short-sleeve finish.",
    });
  }
  if (shirt.sleeve !== "half_sleeve" && shirt.cuff === "open_short_hem_cuff") {
    issues.push({
      code: "full_sleeve_open_hem_cuff",
      explanation: "An open short-sleeve hem is paired with a non-short sleeve; confirm the sleeve finish.",
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
  if (pant.type === "cropped_ankle" && pant.hem !== "cropped_above_ankle_hem") {
    issues.push({
      code: "cropped_type_hem_mismatch",
      explanation: "The cropped-ankle trouser type uses a non-cropped hem; confirm the intended finished length before cutting.",
    });
  }
  if ((pant.type === "cropped_ankle" || pant.hem === "cropped_above_ankle_hem") &&
      pant.break === "full_break") {
    issues.push({
      code: "cropped_full_break",
      explanation: "A cropped trouser hem conflicts with a full shoe break; confirm the intended length.",
    });
  }
  if ((pant.type === "cropped_ankle" || pant.hem === "cropped_above_ankle_hem") &&
      pant.break === "half_break") {
    issues.push({
      code: "cropped_half_break",
      explanation: "An above-ankle cropped hem cannot form a half shoe break; confirm the intended length before cutting.",
    });
  }
  if ((pant.type === "cropped_ankle" || pant.hem === "cropped_above_ankle_hem") &&
      pant.break === "slight_break") {
    issues.push({
      code: "cropped_slight_break",
      explanation: "An above-ankle cropped hem cannot form a slight shoe break; confirm the intended length before cutting.",
    });
  }
  return issues;
}

/**
 * Fail closed when the legacy photographic style and the versioned garment
 * construction would tell a customer to wear or cut different shirts.
 * Compare named camp/band/cutaway collars by their canonical IDs. Other
 * advanced collars may have intentionally approximate legacy previews.
 */
export function styleDirectorPresentationIssues(
  style: Pick<DesignerStyle, "collar" | "shirtWear"> & Partial<Pick<DesignerStyle, "trouser" | "cuff" | "placket" | "shirtFit" | "rise" | "waistband" | "break">>,
  spec: Pick<StyleSpecV2, "shirt"> & Partial<Pick<StyleSpecV2, "pant">>,
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
  // A photographic label naming multiple collar families is ambiguous. Do
  // not let regex precedence silently assert parity with a locked collar ID.
  const campLabel = /\b(?:camp|cuban)(?:[- ]collar)?\b/i.test(style.collar);
  const bandLabel = /\b(?:band|mandarin)(?:[- ]collar)?\b/i.test(style.collar);
  const cutawayLabel = /\bcutaway(?:[- ]collar)?\b/i.test(style.collar);
  const namedFamilies = Number(campLabel) + Number(bandLabel) + Number(cutawayLabel);
  const legacyCollar = namedFamilies !== 1 ? null
    : campLabel ? "cuban_camp_collar"
    : bandLabel ? "mandarin_band_collar" : "cutaway_collar";
  const versionedCollar = spec.shirt.collar;
  // The real selectable option library is the authority for exact
  // photographic label → versioned collar parity, not only named families.
  // Keep family detection for malformed multi-family or unavailable labels.
  const selectedPhotoOption = optionsFor("shirt.collar").find((option) =>
    option.legacySelectable !== false && (option.legacyLabel || option.label) === style.collar);
  const exactPhotoMismatch = selectedPhotoOption != null &&
    selectedPhotoOption.id !== versionedCollar;
  if (namedFamilies > 1 || exactPhotoMismatch || (!selectedPhotoOption &&
      legacyCollar !== versionedCollar &&
      (legacyCollar !== null || ["cuban_camp_collar", "mandarin_band_collar", "cutaway_collar"].includes(versionedCollar)))) {
    issues.push({
      code: "legacy_collar_mismatch",
      explanation: "The photographic collar choice disagrees with the versioned collar construction; review both without changing the locked IDs.",
    });
  }
  if (versionedCollar === "cuban_camp_collar") {
    // The selectable garment-option library currently declares this advanced
    // collar's livePreview as "none". A matching *label* does not establish a
    // matching photographic garment; retain the canonical ID and review it.
    issues.push({
      code: "unverified_camp_photo",
      explanation: "The Cuban/Camp collar is selectable but has no verified live photographic rendering; confirm the preview against the intended construction.",
    });
  }
  if (versionedCollar === "cutaway_collar") {
    // Reference-library support is approximate, not an approved photographic
    // proof of the actual cutaway shape or measured tailoring.
    issues.push({
      code: "unverified_cutaway_photo",
      explanation: "The cutaway collar is a selectable construction, but its live preview is approximate; confirm the actual collar before production.",
    });
  }
  // Photo labels must not silently certify a different cuff, placket or fit.
  // Use only the canonical selectable option library, not display heuristics.
  const photoShirtDetails = [
    { key: "cuff", group: "shirt.cuff", id: spec.shirt.cuff, code: "legacy_cuff_mismatch" },
    { key: "placket", group: "shirt.placket", id: spec.shirt.placket, code: "legacy_placket_mismatch" },
    { key: "shirtFit", group: "shirt.fit", id: spec.shirt.fit, code: "legacy_shirt_fit_mismatch" },
  ] as const;
  for (const detail of photoShirtDetails) {
    const photoLabel = style[detail.key];
    // Backwards compatibility: pure callers may provide only wear + collar.
    if (photoLabel === undefined) continue;
    const selected = optionsFor(detail.group).find((option) =>
      option.legacySelectable !== false && (option.legacyLabel || option.label) === photoLabel);
    if (!selected || selected.id !== detail.id) {
      issues.push({
        code: detail.code,
        explanation: `The photographic ${detail.key} choice disagrees with the versioned shirt construction; review the locked IDs before tailoring.`,
      });
    }
  }
  if (spec.pant !== undefined) {
    if (style.trouser !== undefined) {
      const selectedTrouser = optionsFor("pant.type").find((option) =>
        option.legacySelectable !== false && (option.legacyLabel || option.label) === style.trouser);
      if (!selectedTrouser || selectedTrouser.id !== spec.pant.type) {
        issues.push({
          code: "legacy_trouser_mismatch",
          explanation: "The photographic trouser type disagrees with the versioned trouser construction; verify the silhouette without changing the locked design.",
        });
      }
    }
    // A correct trouser silhouette does not validate its rise, waistband or
    // shoe break. Compare each displayed selector to its canonical saved ID;
    // never change a locked production recipe to make the photo look valid.
    const photoPantDetails = [
      { key: "rise", group: "pant.rise", id: spec.pant.rise, code: "legacy_rise_mismatch" },
      { key: "waistband", group: "pant.waistband", id: spec.pant.waistband, code: "legacy_waistband_mismatch" },
      { key: "break", group: "pant.break", id: spec.pant.break, code: "legacy_break_mismatch" },
    ] as const;
    for (const detail of photoPantDetails) {
      const photoLabel = style[detail.key];
      // Older independent callers provide collar and wear only.
      if (photoLabel === undefined) continue;
      const selected = optionsFor(detail.group).find((option) =>
        option.legacySelectable !== false && (option.legacyLabel || option.label) === photoLabel);
      if (!selected || selected.id !== detail.id) {
        issues.push({
          code: detail.code,
          explanation: `The photographic ${detail.key} choice disagrees with the versioned trouser construction; review the locked IDs before tailoring.`,
        });
      }
    }
  }
  if (spec.shirt.sleeve === "half_sleeve") {
    // DesignerStyle has no sleeve-length field. A versioned half sleeve can be
    // buildable without being represented by the existing photographic style.
    issues.push({
      code: "unverified_short_sleeve_photo",
      explanation: "The photographic style has no sleeve-length selection, so its preview cannot verify the proposed half-sleeve construction.",
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
  // Ambiguous collar names must not force an untucked photo while the
  // versioned collar resolver correctly declines to choose a construction.
  if (styleDirectorCandidateCollar(candidateShirt, [])?.versioned === "cuban_camp_collar") return "Untucked";
  if (occasion === "Formal" || occasion === "Semi-Formal") return "Tucked";
  return proposedWear;
}
