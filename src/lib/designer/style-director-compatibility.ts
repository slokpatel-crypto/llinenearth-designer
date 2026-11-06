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
  // Unrecognised, incomplete or rejected provenance must not influence
  // ranking. A persisted object may predate the current closed vocabulary.
  if (!value ||
      !["unreviewed", "approved", "corrected", "rejected"].includes(value.reviewStatus) ||
      !["reviewed", "high-confidence", "provisional"].includes(value.trust) ||
      value.reviewStatus === "rejected") return 0;
  if (value.trust === "reviewed") {
    return value.reviewStatus === "approved" || value.reviewStatus === "corrected" ? 1 : 0.28;
  }
  return value.trust === "high-confidence" ? 0.72 : 0.28;
}

const candidateCollarFamilies = (name: string) => ({
  camp: /\b(?:camp|cuban)(?:[- ]collar)?\b/i.test(name),
  band: /\b(?:band|mandarin)(?:[- ]collar)?\b/i.test(name),
  cutaway: /\bcutaway(?:[- ]collar)?\b/i.test(name),
  // These ordinary collars have legacy photographic IDs. They still conflict
  // with a simultaneously named camp, band or cutaway construction.
  spread: /\bspread[- ]collar\b/i.test(name),
  buttonDown: /\bbutton[- ]?down(?:[- ]collar)?\b/i.test(name),
  point: /\bpoint(?:[ -]?(?:standard|\(standard\)))?[- ]collar\b/i.test(name),
  club: /\bclub[- ]collar\b/i.test(name),
  wing: /\bwing[- ]collar\b/i.test(name),
  tab: /\btab[- ]collar\b/i.test(name),
  pin: /\bpin[- ]collar\b/i.test(name),
});

/**
 * Only select an ordinary photographed collar when exactly one explicit
 * collar family is named. This rejects "widespread", "button-downish" and
 * contradictory mixed-collar labels instead of taking substring precedence.
 * Oxford weave alone does not prove a button-down collar construction.
 */
export function styleDirectorCandidateOrdinaryCollar(
  candidateShirt: string,
): "spread" | "button_down" | null {
  const families = candidateCollarFamilies(candidateShirt);
  if (Object.values(families).filter(Boolean).length !== 1) return null;
  return families.spread ? "spread" : families.buttonDown ? "button_down" : null;
}

// A prohibition of a sleeve length is not a positive request for it.
// Keep both positive and negative intent so contradictions and locked-ID
// mismatches can be reviewed without inventing a replacement construction.
const candidateSleeveLengths = (name: string) => {
  let bannedShort = false;
  let bannedLong = false;
  const ban = (word: string) => {
    if (/^(?:short|half)/i.test(word)) bannedShort = true;
    else bannedLong = true;
    return " ";
  };
  const withoutPrefixedBans = name.replace(
    /\b(?:no|without|avoid|never|not|do\s+not|don['’]?t)\s+(?:(?:use|include|choose|wear|add|have)\s+)?(?:(?:a|any)\s+)?((?:short|half|long|full)[ -]?sleeve(?:s|d)?)\b/gi,
    (_match, word: string) => ban(word),
  );
  const affirmative = withoutPrefixedBans.replace(
    /\b((?:short|half|long|full)[ -]?sleeve(?:s|d)?)\s+(?:(?:are|is)\s+)?(?:forbidden|prohibited|banned|not\s+(?:allowed|permitted)|(?:must|should)\s+not\s+be\s+(?:used|worn))\b/gi,
    (_match, word: string) => ban(word),
  );
  return {
    short: /\b(?:short|half)[ -]?sleeve(?:s|d)?\b/i.test(affirmative),
    long: /\b(?:long|full)[ -]?sleeve(?:s|d)?\b/i.test(affirmative),
    bannedShort,
    bannedLong,
  };
};

// Wear words are instructions, not evidence of physical tuck length. A
// negative instruction must not become a *positive* tuck merely because the
// word "tucked" occurs in it. Remove recognized negations before looking for
// affirmative wear words; conflicting remaining intents still require review.
const candidateShirtWear = (name: string) => {
  let remaining = name;
  let tuckedFromNegation = false;
  let untuckedFromNegation = false;
  remaining = remaining.replace(/\b(?:not|never|avoid)\s+(?:being\s+)?untucked\b/gi, () => {
    tuckedFromNegation = true;
    return " ";
  });
  remaining = remaining.replace(/\b(?:not|never|avoid)\s+(?:being\s+)?tucked\b/gi, () => {
    untuckedFromNegation = true;
    return " ";
  });
  remaining = remaining.replace(/\b(?:do\s+not|don['’]?t|never|avoid|no)\s+(?:(?:the|any)\s+)?tuck(?:ing)?\b/gi, () => {
    untuckedFromNegation = true;
    return " ";
  });
  return {
    tucked: tuckedFromNegation || /\btucked\b/i.test(remaining),
    untucked: untuckedFromNegation || /\buntucked\b/i.test(remaining),
  };
};

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
  const collarFamilies = candidateCollarFamilies(candidateShirt);
  const { camp, band, cutaway } = collarFamilies;
  // Resolve only a single advanced collar. Named ordinary collars retain
  // their existing legacy path, and mixed requests cannot silently choose
  // one construction just because it matches a recognised advanced ID.
  if (Number(camp) + Number(band) + Number(cutaway) !== 1 ||
      Object.values(collarFamilies).filter(Boolean).length !== 1) return null;
  const matcher = camp ? /\b(?:camp|cuban)\b/i : band ? /\b(?:band|mandarin)\b/i : /\bcutaway\b/i;
  return {
    // A photographed label mixing an advanced collar with an ordinary
    // collar is no more trustworthy than an ambiguous candidate description.
    // Resolve with the same family classifier for both directions.
    legacy: legacyChoices.find((label) => matcher.test(label) &&
      Object.values(candidateCollarFamilies(label)).filter(Boolean).length === 1) ?? null,
    versioned: camp ? "cuban_camp_collar" : band ? "mandarin_band_collar" : "cutaway_collar",
  };
}

/**
 * Resolve explicitly named classic and specialty collars into real existing
 * versioned IDs. Only allow a photographic selection when that same option is
 * selectable in the legacy style contract. Wing/tab/pin photos must not be
 * invented: a null legacy value makes presentation parity require review.
 */
export function styleDirectorCandidateSpecialCollar(
  candidateShirt: string,
  legacyChoices: readonly string[],
): { versioned: "point_standard_collar" | "club_collar" | "wing_collar" | "tab_collar" | "pin_collar"; legacy: string | null } | null {
  const families = candidateCollarFamilies(candidateShirt);
  if (Object.values(families).filter(Boolean).length !== 1) return null;
  const id = families.point ? "point_standard_collar"
    : families.club ? "club_collar"
    : families.wing ? "wing_collar"
    : families.tab ? "tab_collar"
    : families.pin ? "pin_collar" : null;
  if (!id) return null;
  const option = optionsFor("shirt.collar").find((entry) => entry.id === id);
  if (!option) return null;
  const label = option.legacyLabel || option.label;
  return {
    versioned: id,
    legacy: option.legacySelectable !== false &&
      option.renderSupport.livePreview !== "none" && legacyChoices.includes(label) ? label : null,
  };
}

/**
 * A single named collar is a construction request, even when there is no
 * matching legacy photographic selector. Do not silently keep an unrelated
 * default collar on the locked design. Multiple family names are handled by
 * the separate ambiguity gate, not by guessing precedence here.
 */
export function styleDirectorCandidateCollarIssues(
  candidateShirt: string,
  shirt: Pick<StyleSpecV2["shirt"], "collar">,
): DirectorConstructionIssue[] {
  const families = candidateCollarFamilies(candidateShirt);
  if (Object.values(families).filter(Boolean).length !== 1) return [];
  const accepted: readonly string[] = families.camp ? ["cuban_camp_collar"]
    : families.band ? ["mandarin_band_collar"]
    : families.cutaway ? ["cutaway_collar"]
    : families.spread ? ["spread_collar", "english_spread_collar"]
    : families.buttonDown ? ["button_down_collar", "soft_button_down"]
    : families.point ? ["point_standard_collar"]
    : families.club ? ["club_collar"]
    : families.wing ? ["wing_collar"]
    : families.tab ? ["tab_collar"]
    : families.pin ? ["pin_collar"] : [];
  return accepted.includes(shirt.collar) ? [] : [{
    code: "candidate_collar_mismatch",
    explanation: "The proposed shirt names a collar construction different from its locked versioned collar ID; confirm the collar before tailoring.",
  }];
}

/** Candidate wording is not a measured sleeve length. Only an explicit
 * short-/half-sleeve request maps to the existing construction IDs. */
/**
 * Detect a requested or prohibited sleeve length that does not agree with the
 * canonical proposed garment. Do not alter a locked ID or infer an arm length.
 */
export function styleDirectorCandidateSleeveIssues(
  candidateShirt: string,
  shirt: Pick<StyleSpecV2["shirt"], "sleeve">,
): DirectorConstructionIssue[] {
  const intent = candidateSleeveLengths(candidateShirt);
  // Contradictory phrasing is already reported by the wording gate.
  if ((intent.short && intent.long) || (intent.short && intent.bannedShort) ||
      (intent.long && intent.bannedLong) || (intent.bannedShort && intent.bannedLong)) return [];
  const invalid = (intent.short && shirt.sleeve !== "half_sleeve") ||
    (intent.long && shirt.sleeve !== "full_sleeve") ||
    (intent.bannedShort && shirt.sleeve === "half_sleeve") ||
    (intent.bannedLong && shirt.sleeve !== "half_sleeve");
  return invalid ? [{
    code: "candidate_sleeve_mismatch",
    explanation: "The proposed shirt's requested or prohibited sleeve length conflicts with its versioned construction; confirm the sleeve before tailoring.",
  }] : [];
}

export function styleDirectorCandidateSleeve(
  candidateShirt: string,
): { sleeve: "half_sleeve"; cuff: "open_short_hem_cuff" } | null {
  const { short: shortSleeve, long: longSleeve, bannedShort, bannedLong } = candidateSleeveLengths(candidateShirt);
  // Contradictory sleeve descriptions cannot safely select a construction.
  // Retain the existing default rather than silently interpreting one half.
  return shortSleeve && !longSleeve && !bannedShort
    ? { sleeve: "half_sleeve", cuff: "open_short_hem_cuff" }
    : null;
}

/**
 * Width intent is independent of waistband, fabric stripes and pleat count.
 * Remove explicit bans / optional choices before treating wide-leg wording as
 * a positive instruction. Conflicting requests must receive review rather
 * than silently taking the first mention.
 */
export function styleDirectorCandidateWideLegIntent(
  candidateTrouser: string,
): "requested" | "prohibited" | "ambiguous" | null {
  const width = String.raw`(?:wide[- ]?leg(?:ged)?|wide[- ]?fit[- ]?(?:trousers?|pants?)|wide[- ]?(?:trousers?|pants?))`;
  const beforeBan = new RegExp(String.raw`\b(?:no|without|avoid|never|not|do\s+not|don['’]?t)\s+(?:(?:use|choose|wear|include|add|have|want)\s+)?(?:(?:a|any)\s+)?${width}\b`, "gi");
  const afterBan = new RegExp(String.raw`\b${width}\s+(?:(?:are|is)\s+)?(?:forbidden|prohibited|banned|not\s+(?:allowed|permitted))\b`, "gi");
  const optional = new RegExp(String.raw`\b(?:optional\s+${width}|${width}\s+(?:(?:is|are)\s+)?(?:optional|unnecessary|not\s+(?:required|needed|mandatory)))\b`, "gi");
  let prohibited = false;
  let remaining = candidateTrouser.replace(beforeBan, () => { prohibited = true; return " "; });
  remaining = remaining.replace(afterBan, () => { prohibited = true; return " "; });
  remaining = remaining.replace(optional, " ");
  const requested = new RegExp(String.raw`\b${width}\b`, "i").test(remaining);
  if (requested && prohibited) return "ambiguous";
  return requested ? "requested" : prohibited ? "prohibited" : null;
}

/** A positive wide-leg instruction shared by the photo and saved-spec paths. */
export function styleDirectorCandidateWideLeg(candidateTrouser: string): boolean {
  return styleDirectorCandidateWideLegIntent(candidateTrouser) === "requested";
}

/** Compare explicit wide-leg requests / prohibitions with locked trouser IDs. */
export function styleDirectorCandidateWideLegIssues(
  candidateTrouser: string,
  pant: Pick<StyleSpecV2["pant"], "type">,
): DirectorConstructionIssue[] {
  const intent = styleDirectorCandidateWideLegIntent(candidateTrouser);
  if (intent === null || intent === "ambiguous") return [];
  const isWideLeg = pant.type === "wide_leg_relaxed_drape";
  return (intent === "requested") === isWideLeg ? [] : [{
    code: "candidate_wide_leg_mismatch",
    explanation: "The named wide-leg silhouette request or prohibition conflicts with the saved versioned trouser type; confirm the cut before tailoring.",
  }];
}

/**
 * A drawstring waistband request is independent of silhouette and pleat count.
 * Negated or explicitly optional wording is not a positive manufacturing
 * instruction. Persisted IDs must be compared separately, never rewritten.
 */
export function styleDirectorCandidateDrawstringWaistband(
  candidateTrouser: string,
): "requested" | "prohibited" | "ambiguous" | null {
  const token = String.raw`draw[- ]?string`;
  const preBan = new RegExp(String.raw`\b(?:no|without|avoid|never|not|do\s+not|don['’]?t)\s+(?:(?:use|add|include|choose|wear|have)\s+)?(?:a\s+)?${token}\b`, "gi");
  const postBan = new RegExp(String.raw`\b${token}(?:[- ]?(?:free|less)|\s+(?:(?:is|are)\s+)?(?:forbidden|prohibited|banned|not\s+(?:allowed|permitted)))\b`, "gi");
  const optional = new RegExp(String.raw`\b${token}\s+(?:(?:is|are)\s+)?(?:optional|unnecessary|not\s+(?:required|mandatory|needed|necessary))\b`, "gi");
  const optionalPrefix = new RegExp(String.raw`\b(?:optional|unnecessary)\s+${token}\b`, "gi");
  let banned = false;
  let neutral = candidateTrouser.replace(preBan, () => { banned = true; return " "; });
  neutral = neutral.replace(postBan, () => { banned = true; return " "; });
  neutral = neutral.replace(optional, " ").replace(optionalPrefix, " ");
  if (/\bwith\s+(?:or\s+)?without\s+draw[- ]?string\b/i.test(candidateTrouser)) return "ambiguous";
  const requested = /\bdraw[- ]?string\b/i.test(neutral);
  if (requested && banned) return "ambiguous";
  return requested ? "requested" : banned ? "prohibited" : null;
}

/**
 * A requested drawstring must match the canonical waistband independently of
 * the trouser front (flat/pleated) or width. A prohibition must not silently
 * approve a drawstring. An ambiguous request gets its own wording review.
 */
export function styleDirectorCandidateWaistbandIssues(
  candidateTrouser: string,
  pant: Pick<StyleSpecV2["pant"], "waistband">,
): DirectorConstructionIssue[] {
  const intent = styleDirectorCandidateDrawstringWaistband(candidateTrouser);
  if (intent === null || intent === "ambiguous") return [];
  const isDrawstring = pant.waistband === "drawstring_elastic";
  if ((intent === "requested" && isDrawstring) || (intent === "prohibited" && !isDrawstring)) return [];
  return [{
    code: "candidate_waistband_mismatch",
    explanation: "The proposed drawstring request or prohibition conflicts with the saved waistband option; confirm the locked construction before tailoring.",
  }];
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


// A postposed prohibition of a particular pleat count does not prohibit all
// pleats. Reuse this exact matcher for candidate-front intent, counted
// requirement parsing and verification of a versioned locked pleat ID.
const postposedCountPleatBan = /\b(single|double|one|two|1|2)[ -]?pleat(?:ed|s|ing)?\s+(?:(?:are|is)\s+)?(?:prohibited|forbidden|banned|disallowed|not\s+(?:allowed|permitted)|(?:(?:must|should|shall|may)\s+(?:not|never)|cannot|can['’]?t)\s+be\s+(?:used|added|included)|not\s+to\s+be\s+(?:used|added|included)|(?:aren['’]?t|isn['’]?t)\s+(?:allowed|permitted)|(?:must|should|shall|(?:are|is)\s+to|to)\s+be\s+avoided)\b/gi;

export function styleDirectorCandidateTrouserFront(
  candidateTrouser: string,
): "flat_front" | "pleated" | "ambiguous" | null {
  // A direction-specific prohibition is not a ban on all pleats.
  // Interpret front intent without it, but retain the original candidate
  // for the directional conflict checks against the locked option ID.
  const frontWording = candidateTrouser
    .replace(postposedCountPleatBan, "")
    .replace(
      /\b(?:no|without|avoid|never|do\s+not|don['’]?t)\s+(?:(?:use|add|include|choose)\s+)?(?:forward|reverse)[ -]?pleats?\b/gi,
      "",
    )
    .replace(
      /\b(?:forward|reverse)[ -]?pleats?\s+(?:(?:are|is)\s+)?(?:prohibited|forbidden|banned|disallowed|not\s+(?:allowed|permitted)|(?:(?:must|should|shall|may)\s+(?:not|never)|cannot|can['’]?t)\s+be\s+(?:used|added|included)|not\s+to\s+be\s+(?:used|added|included)|(?:aren['’]?t|isn['’]?t)\s+(?:allowed|permitted)|(?:must|should|shall|(?:are|is)\s+to|to)\s+be\s+avoided)\b/gi,
      "",
    );
  const flatFront = /\bflat[- ]?front\b/i.test(frontWording);
  const positiveWording = stripNegatedPleatWording(frontWording).replace(
    /\bpleat(?:s|ing)?\s+(?:(?:are|is)\s+)?(?:(?:not\s+(?:allowed|permitted)|prohibited|forbidden|banned|disallowed)|(?:(?:should|must|shall|may)\s+(?:not|never)|cannot|can['’]?t)\s+be\s+(?:used|added|included)|not\s+to\s+be\s+(?:used|added|included)|(?:must|should|shall)\s+be\s+omitted|(?:must|should|(?:are|is)\s+to)\s+be\s+avoided|(?:aren['’]?t|isn['’]?t)\s+(?:allowed|permitted))\b/gi,
    "",
  );
  // Optional pleat language describes a choice, not an instruction to cut pleats.
  // Keep explicit positive instructions elsewhere in the same candidate intact.
  const optionalNeutralWording = positiveWording.replace(
    /\b(?:(?:single|double|one|two|1|2)[ -]?)?(?:pleats?|pleating)\s+(?:(?:are|is)\s+)?(?:optional|unnecessary|not\s+(?:required|necessary|mandatory|needed)|(?:need\s+not|(?:do|does)\s+not\s+need\s+to)\s+be\s+(?:used|added|included)|(?:may|can|could)\s+be\s+(?:used|added|included|omitted))\b/gi,
    "",
  );
  const explicitlyNoPleats = positiveWording !== frontWording;
  // Negating a particular pleat count does not prohibit all pleats. In
  // particular, "no double pleats" must not become a positive pleat request.
  const unqualifiedPositiveWording = optionalNeutralWording.replace(
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
    "pleated_front_missing_pleat" | "flat_front_has_pleat" | "cropped_full_break" | "cropped_half_break" | "cropped_slight_break" | "cropped_stacked_break" | "cropped_break_hem_mismatch" | "cropped_type_hem_mismatch" |
    "formal_camp_collar" | "legacy_wear_mismatch" | "legacy_collar_mismatch" | "unverified_camp_photo" | "unverified_special_collar_photo" |
    "camp_collar_type_mismatch" | "band_collar_type_mismatch" | "short_sleeve_type_mismatch" | "short_sleeve_cuff_review" | "full_sleeve_open_hem_cuff" | "unverified_short_sleeve_photo" | "unverified_cutaway_photo" |
    "ambiguous_candidate_collar" | "candidate_collar_mismatch" | "ambiguous_candidate_sleeve" | "candidate_sleeve_mismatch" | "ambiguous_candidate_wear" |
    "candidate_shirt_wear_mismatch" | "legacy_trouser_mismatch" |
    "ambiguous_candidate_trouser_front" | "legacy_cuff_mismatch" | "legacy_placket_mismatch" | "legacy_shirt_fit_mismatch" |
    "candidate_trouser_pleat_mismatch" | "unknown_trouser_pleat_option" | "unknown_versioned_option" |
    "candidate_waistband_mismatch" | "ambiguous_candidate_waistband" | "candidate_wide_leg_mismatch" | "ambiguous_candidate_wide_leg" |
    "legacy_rise_mismatch" | "legacy_waistband_mismatch" | "legacy_break_mismatch";
  explanation: string;
};

/**
 * Conflicting proposed garment names must reach recommendation review.
 * A null resolver alone could otherwise leave default full-sleeve construction
 * looking acceptable despite explicitly contradictory instructions.
 */
export function styleDirectorCandidateWordingIssues(candidateShirt: string, candidateTrouser = ""): DirectorConstructionIssue[] {
  const issues: DirectorConstructionIssue[] = [];
  const collarFamilies = candidateCollarFamilies(candidateShirt);
  if (Object.values(collarFamilies).filter(Boolean).length > 1) {
    issues.push({
      code: "ambiguous_candidate_collar",
      explanation: "This proposed shirt names conflicting collar families; confirm one construction before approving the recommendation.",
    });
  }
  const sleeves = candidateSleeveLengths(candidateShirt);
  if ((sleeves.short && sleeves.long) ||
      (sleeves.short && sleeves.bannedShort) ||
      (sleeves.long && sleeves.bannedLong) ||
      (sleeves.bannedShort && sleeves.bannedLong)) {
    issues.push({
      code: "ambiguous_candidate_sleeve",
      explanation: "This proposed shirt names both short and long sleeves; confirm one sleeve construction before approving the recommendation.",
    });
  }
  const wear = candidateShirtWear(candidateShirt);
  if (wear.tucked && wear.untucked) {
    issues.push({
      code: "ambiguous_candidate_wear",
      explanation: "This proposed shirt requests both tucked and untucked wear; confirm one construction before approving the recommendation.",
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
  if (styleDirectorCandidateDrawstringWaistband(candidateTrouser) === "ambiguous") {
    issues.push({
      code: "ambiguous_candidate_waistband",
      explanation: "The proposed trouser both requests and forbids a drawstring waistband; confirm a single construction before approving.",
    });
  }
  if (styleDirectorCandidateWideLegIntent(candidateTrouser) === "ambiguous") {
    issues.push({
      code: "ambiguous_candidate_wide_leg",
      explanation: "The proposed trouser both requests and prohibits a wide-leg silhouette; confirm the cut before approving.",
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
  const positiveWording = stripNegatedPleatWording(candidateTrouser)
    .replace(postposedCountPleatBan, "")
    .replace(
    /\b(?:no|without|not|avoid|never|do\s+not|don['’]?t)\s+(?:(?:use|add|include|choose)\s+)?(?:(?:a|an|any|visible|front(?:[- ]facing)?|side(?:[- ]facing)?)\s+){0,3}(?:single|double|one|two|1|2)[ -]?pleat(?:ed|s|ing)?\b/gi,
    "",
  );
  // Optional counts do not constrain a separately requested pleat.
  // Reuse the candidate-front neutralisation so "double pleats may be
  // added; single pleat required" checks only the mandatory single pleat.
  const requiredWording = positiveWording.replace(
    /\b(?:(?:single|double|one|two|1|2)[ -]?)?(?:pleats?|pleating)\s+(?:(?:are|is)\s+)?(?:optional|unnecessary|not\s+(?:required|necessary|mandatory|needed)|(?:need\s+not|(?:do|does)\s+not\s+need\s+to)\s+be\s+(?:used|added|included)|(?:may|can|could)\s+be\s+(?:used|added|included|omitted))\b/gi,
    "",
  );
  const requestsDouble = /\b(?:double|two|2)[ -]?pleats?\b/i.test(requiredWording);
  const requestsSingle = /\b(?:single|one|1)[ -]?pleats?\b/i.test(requiredWording);
  const expectedCount = front === "pleated"
    ? requestsDouble && !requestsSingle ? 2
      : requestsSingle && !requestsDouble ? 1 : null
    : null;
  const pleatOption = optionsFor("pant.pleat").find(option => option.id === pant.pleat);
  const declaredCount = pleatOption?.parameters.pleatCount;
  // A ban on a specific count is not a blanket no-pleat instruction.
  // Preserve an allowed single/double/flat-front choice, but never silently
  // approve the forbidden canonical count (or an ID whose count is unknown).
  const prohibitedCountLabels = [
    ...[...candidateTrouser.matchAll(
      /\b(?:no|without|not|avoid|never|do\s+not|don['’]?t)\s+(?:(?:use|add|include|choose)\s+)?(?:(?:a|an|any|visible|front(?:[- ]facing)?|side(?:[- ]facing)?)\s+){0,3}(single|double|one|two|1|2)[ -]?pleat(?:ed|s|ing)?\b/gi,
    )].map(match => match[1].toLowerCase()),
    ...[...candidateTrouser.matchAll(postposedCountPleatBan)].map(match => match[1].toLowerCase()),
  ];
  const prohibitsSingleCount = prohibitedCountLabels.some(value => ["single", "one", "1"].includes(value));
  const prohibitsDoubleCount = prohibitedCountLabels.some(value => ["double", "two", "2"].includes(value));
  const hasCountBan = prohibitsSingleCount || prohibitsDoubleCount;
  // The option catalogue also distinguishes forward/reverse pleat direction.
  // Do not silently substitute one for the other in tailoring instructions.
  // A prohibited direction is not a requested direction. Preserve positive
  // direction instructions elsewhere (e.g. "no reverse pleats; forward pleats").
  const directionWording = positiveWording.replace(
    /\b(?:no|without|avoid|never|do\s+not|don['’]?t)\s+(?:(?:use|add|include|choose)\s+)?(?:forward|reverse)[ -]?pleats?\b/gi,
    "",
  ).replace(
    /\b(?:forward|reverse)[ -]?pleats?\s+(?:(?:are|is)\s+)?(?:prohibited|forbidden|banned|disallowed|not\s+(?:allowed|permitted)|(?:(?:must|should|shall|may)\s+(?:not|never)|cannot|can['’]?t)\s+be\s+(?:used|added|included)|not\s+to\s+be\s+(?:used|added|included)|(?:aren['’]?t|isn['’]?t)\s+(?:allowed|permitted)|(?:must|should|shall|(?:are|is)\s+to|to)\s+be\s+avoided)\b/gi,
    "",
  );
  const requestsForward = front === "pleated" && /\bforward\b/i.test(directionWording);
  const requestsReverse = front === "pleated" && /\breverse\b/i.test(directionWording);
  const expectedDirection = requestsForward !== requestsReverse
    ? requestsForward ? "forward" : "reverse" : null;
  const declaredDirection = pleatOption?.parameters.pleatDirection;
  // A negative direction instruction constrains the selected pleat even
  // when no alternative direction is explicitly requested. Do not treat
  // "avoid reverse pleats" as a blanket ban on all pleated construction.
  const prohibitsForward = /\b(?:no|without|avoid|never|do\s+not|don['’]?t)\s+(?:(?:use|add|include|choose)\s+)?forward[ -]?pleats?\b/i.test(candidateTrouser);
  const prohibitsReverse = /\b(?:no|without|avoid|never|do\s+not|don['’]?t)\s+(?:(?:use|add|include|choose)\s+)?reverse[ -]?pleats?\b/i.test(candidateTrouser);
  // Direction prohibitions can follow the noun as well as precede it.
  const prohibitedDirections = [...candidateTrouser.matchAll(
    /\b(forward|reverse)[ -]?pleats?\s+(?:(?:are|is)\s+)?(?:prohibited|forbidden|banned|disallowed|not\s+(?:allowed|permitted)|(?:(?:must|should|shall|may)\s+(?:not|never)|cannot|can['’]?t)\s+be\s+(?:used|added|included)|not\s+to\s+be\s+(?:used|added|included)|(?:aren['’]?t|isn['’]?t)\s+(?:allowed|permitted)|(?:must|should|shall|(?:are|is)\s+to|to)\s+be\s+avoided)\b/gi,
  )].map(match => match[1].toLowerCase());
  // A direction-only ban also requires a known canonical pleat ID:
  // with a stale/unknown ID we cannot verify which direction was locked.
  // Do not infer that an unknown selection is flat-front.
  const hasDirectionBan = prohibitsForward || prohibitsReverse || prohibitedDirections.length > 0;
  // Unknown/stale option IDs cannot certify named front or direction constraints.
  if ((((front !== null && front !== "ambiguous") || hasDirectionBan || hasCountBan) && !pleatOption) ||
      (declaredCount === 1 && prohibitsSingleCount) ||
      (declaredCount === 2 && prohibitsDoubleCount) ||
      (requestsSingle && prohibitsSingleCount) ||
      (requestsDouble && prohibitsDoubleCount) ||
      (front === "pleated" && pant.pleat === "flat_front") ||
      (front === "flat_front" && pant.pleat !== "flat_front") ||
      (expectedCount !== null && declaredCount !== expectedCount) ||
      (front === "pleated" && requestsSingle && requestsDouble) ||
      (front === "pleated" && requestsForward && requestsReverse) ||
      (expectedDirection !== null && declaredDirection !== expectedDirection) ||
      (declaredDirection === "forward" && (prohibitsForward || prohibitedDirections.includes("forward"))) ||
      (declaredDirection === "reverse" && (prohibitsReverse || prohibitedDirections.includes("reverse")))) {
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
  // Saved designs are reconstructed from canonical option IDs, not labels.
  // These pure checks also accept partial isolated test fixtures: validate
  // every supplied ID, but do not fabricate missing selections. The full
  // locked-spec parser separately enforces the presence of every field.
  const selectedOptions = [
    ["shirt.type", shirt.type], ["shirt.collar", shirt.collar],
    ["shirt.cuff", shirt.cuff], ["shirt.placket", shirt.placket],
    ["shirt.pocket", shirt.pocket], ["shirt.sleeve", shirt.sleeve],
    ["shirt.fit", shirt.fit], ["shirt.length", shirt.length],
    ["shirt.hem", shirt.hem], ["shirt.back", shirt.back],
    ["shirt.wear", shirt.wear], ["shirt.button", shirt.button],
    ["pant.type", pant.type], ["pant.fit", pant.fit],
    ["pant.rise", pant.rise], ["pant.waistband", pant.waistband],
    ["pant.hem", pant.hem], ["pant.break", pant.break],
  ] as const;
  for (const [group, id] of selectedOptions) {
    if (id === undefined) continue;
    if (typeof id !== "string" || !optionsFor(group).some((option) => option.id === id)) {
      issues.push({
        code: "unknown_versioned_option",
        explanation: `The saved ${group} selection does not match the versioned option catalogue; review its locked ID without substituting a display label.`,
      });
    }
  }
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
  // A stale or fabricated pleat ID must not pass construction review merely
  // because it differs from flat_front. Keep the saved ID unchanged.
  if (!optionsFor("pant.pleat").some(option => option.id === pant.pleat)) {
    issues.push({
      code: "unknown_trouser_pleat_option",
      explanation: "The selected trouser pleat ID is not in the versioned option catalogue; confirm its construction before production.",
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
  // Stacking needs sufficient length to rest and fold over footwear; a
  // cropped above-ankle hem cannot deliver that construction simultaneously.
  if ((pant.type === "cropped_ankle" || pant.hem === "cropped_above_ankle_hem") &&
      pant.break === "stacked_break") {
    issues.push({
      code: "cropped_stacked_break",
      explanation: "A cropped above-ankle trouser cannot also stack over footwear; confirm the requested finished hem and break before cutting.",
    });
  }
  // The photographed 'cropped above-ankle' break is a length claim. Matching
  // it to a non-cropped construction without any supporting length evidence
  // would misstate a customer's locked trouser specification.
  if (pant.break === "cropped_above_ankle" && pant.hem !== "cropped_above_ankle_hem") {
    issues.push({
      code: "cropped_break_hem_mismatch",
      explanation: "The selected cropped above-ankle break conflicts with the saved non-cropped hem; confirm the versioned length choices.",
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
  // Unknown legacy labels cannot certify photographic parity, even for an
  // ordinary collar. Do not infer a valid selection from an unrecognised name.
  const unknownPhotoCollar = selectedPhotoOption == null;
  if (unknownPhotoCollar || namedFamilies > 1 || exactPhotoMismatch || (!selectedPhotoOption &&
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
  // A legacy-selectable text label is not proof that the deterministic
  // photographic compositor supports its actual collar geometry. Specialty
  // collars without a live preview, or intentionally non-legacy wing collars,
  // must remain review-only even when a label matches the saved ID.
  const versionedCollarOption = optionsFor("shirt.collar").find(option => option.id === versionedCollar);
  if (versionedCollar !== "cuban_camp_collar" &&
      (versionedCollarOption?.renderSupport.livePreview === "none" ||
       versionedCollarOption?.legacySelectable === false)) {
    issues.push({
      code: "unverified_special_collar_photo",
      explanation: "This versioned collar has no approved corresponding live photographic selector; its label must not be treated as a verified shape.",
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
/**
 * A candidate's explicit tuck preference must survive the deterministic
 * photo-to-spec bridge. Contradictions remain review-only and never rewrite
 * an already locked selection.
 */
export function styleDirectorCandidateWearIssues(
  candidateShirt: string,
  shirt: Pick<StyleSpecV2["shirt"], "wear">,
): DirectorConstructionIssue[] {
  const requested = candidateShirtWear(candidateShirt);
  if (requested.tucked === requested.untucked) return [];
  const expected = requested.tucked ? "tucked" : "untucked";
  return shirt.wear === expected ? [] : [{
    code: "candidate_shirt_wear_mismatch",
    explanation: "The proposed shirt's explicit tucked/untucked wear conflicts with its versioned construction; confirm the locked tuck choice before tailoring.",
  }];
}

export function styleDirectorWearForCandidate(
  occasion: OccasionTier,
  candidateShirt: string,
  proposedWear: DesignerStyle["shirtWear"],
): DesignerStyle["shirtWear"] {
  // Camp-collar type remains untucked even if the candidate explicitly
  // requests tucked wear; the pure mismatch gate marks that contradiction.
  if (styleDirectorCandidateCollar(candidateShirt, [])?.versioned === "cuban_camp_collar") return "Untucked";
  const wear = candidateShirtWear(candidateShirt);
  if (wear.tucked !== wear.untucked) return wear.tucked ? "Tucked" : "Untucked";
  // Ambiguous phrases retain the previous occasion default but require review.
  if (occasion === "Formal" || occasion === "Semi-Formal") return "Tucked";
  return proposedWear;
}
