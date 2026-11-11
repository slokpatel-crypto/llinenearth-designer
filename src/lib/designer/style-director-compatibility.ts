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
  // Persisted provenance must be plain data, not inherited or computed
  // accessors that can fabricate an approval (or throw during scoring).
  const trust = styleDirectorLockedOptionValue(value, "trust");
  const review = styleDirectorLockedOptionValue(value, "reviewStatus");
  if (!["unreviewed", "approved", "corrected", "rejected"].includes(review as string) ||
      !["reviewed", "high-confidence", "provisional"].includes(trust as string) ||
      review === "rejected") return 0;
  if (trust === "reviewed") {
    return review === "approved" || review === "corrected" ? 1 : 0.28;
  }
  return trust === "high-confidence" ? 0.72 : 0.28;
}

const candidateCollarFamilies = (name: string) => ({
  camp: /\b(?:camp|cuban)(?:[- ]collar)?\b/i.test(name),
  band: /\b(?:band|mandarin)(?:[- ]collar)?\b/i.test(name),
  cutaway: /\bcutaway(?:[- ]collar)?\b/i.test(name),
  // These ordinary collars have legacy photographic IDs. They still conflict
  // with a simultaneously named camp, band or cutaway construction.
  spread: /\bspread[- ]collar\b/i.test(name) ||
    /\benglish[- ]+spread\s*[/&-]\s*british[- ]collar\b/i.test(name),
  buttonDown: /\bbutton[- ]?down(?:[- ]collar)?\b/i.test(name),
  point: /\bpoint(?:[ -]?(?:standard|\(standard\)))?[- ]collar\b/i.test(name),
  club: /\bclub[- ]collar\b/i.test(name),
  wing: /\bwing[- ]collar\b/i.test(name),
  tab: /\btab[- ]collar\b/i.test(name),
  pin: /\bpin[- ]collar\b/i.test(name),
});

type CandidateCollarFamily = keyof ReturnType<typeof candidateCollarFamilies>;

const collarFamilyIds: Record<CandidateCollarFamily, readonly string[]> = {
  camp: ["cuban_camp_collar"],
  band: ["mandarin_band_collar"],
  cutaway: ["cutaway_collar"],
  spread: ["spread_collar", "english_spread_collar"],
  buttonDown: ["button_down_collar", "soft_button_down"],
  point: ["point_standard_collar"],
  club: ["club_collar"],
  wing: ["wing_collar"],
  tab: ["tab_collar"],
  pin: ["pin_collar"],
};

/** Keep forbidden/optional collar phrases out of positive candidate selection. */
function candidateCollarIntent(name: string): {
  requested: ReturnType<typeof candidateCollarFamilies>;
  prohibited: string[];
  affirmative: string;
  ambiguous: boolean;
} {
  const token = String.raw`(?:english[- ]+spread\s*[/&-]\s*british[- ]collar|cuban(?:\s*[/&-]\s*|\s+)camp|camp(?:\s*[/&-]\s*|\s+)cuban|mandarin(?:\s*[/&-]\s*|\s+)band|band(?:\s*[/&-]\s*|\s+)mandarin|camp|cuban|band|mandarin|cutaway|(?:english[- ]+)?spread|(?:soft[- ]+)?button[- ]?down|point(?:[ -]?(?:standard|\(standard\)))?|club|wing|tab|pin)(?:[- ]collar)?`;
  const prefixBan = new RegExp("\\b(?:no|without|avoid|never|not|do\\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\\s+(?:(?:use|include|choose|select|wear|add|have|want)\\s+)?(?:(?:a|any|the)\\s+)?(" + token + ")\\b", "gi");
  const suffixBan = new RegExp("\\b(" + token + ")\\s+(?:(?:is|are)\\s+)?(?:forbidden|prohibited|banned|unwanted|not\\s+(?:allowed|permitted|wanted)|(?:isn['’]?t|aren['’]?t)\\s+wanted|(?:(?:must|should)\\s+not|(?:mustn|shouldn)['’]?t)\\s+be\\s+(?:used|worn|chosen|selected))\\b", "gi");
  const prefixOptional = new RegExp("\\b(?:optional|maybe)\\s+(" + token + ")\\b", "gi");
  const suffixOptional = new RegExp("\\b(" + token + ")\\s+(?:(?:is|are)\\s+)?(?:optional|not\\s+(?:required|needed|mandatory)|(?:isn['’]?t|aren['’]?t)\\s+(?:required|needed|mandatory))\\b", "gi");
  // The prohibition is scoped to the actual versioned ID(s). "No English
  // Spread" must not also forbid ordinary Spread, while "no Spread Collar"
  // forbids the entire spread family. The same rule applies to Soft Button-Down.
  const prohibited = new Set<string>();
  const recordBan = (_match: string, named: string): string => {
    const found = candidateCollarFamilies(named);
    const variant = /\benglish[- ]+spread(?:[- ]collar|\s*[/&-]\s*british[- ]collar)?\b/i.test(named)
      ? "english_spread_collar"
      : /\bsoft[- ]+button[- ]?down(?:[- ]collar)?\b/i.test(named)
        ? "soft_button_down" : null;
    (Object.keys(found) as CandidateCollarFamily[]).forEach(family => {
      if (!found[family]) return;
      if (variant) prohibited.add(variant);
      else collarFamilyIds[family].forEach(id => prohibited.add(id));
    });
    return " ";
  };
  // This is a genuine choice between collar constructions, not the ban that
  // the embedded word "without" would otherwise create. Strip only this
  // alternative before evaluating any independently stated requirements.
  const alternative = new RegExp(
    String.raw`\bwith\s+(?:or\s+)?without\s+(?:(?:a|any|the)\s+)?(?:${token})\b`,
    "gi",
  );
  let undecided = false;
  const explicit = name.replace(alternative, () => { undecided = true; return " "; });
  let positive = explicit.replace(prefixBan, recordBan).replace(suffixBan, recordBan);
  positive = positive.replace(prefixOptional, " ").replace(suffixOptional, " ");
  const requested = candidateCollarFamilies(positive);
  const named = (Object.keys(requested) as CandidateCollarFamily[]).filter(family => requested[family]);
  const exactRequested = /\benglish[- ]+spread(?:[- ]collar|\s*[/&-]\s*british[- ]collar)\b/i.test(positive)
    ? "english_spread_collar"
    : /\bsoft[- ]+button[- ]?down[- ]collar\b/i.test(positive)
      ? "soft_button_down" : null;
  // One family can still name two different canonical IDs. Removing the
  // specific variant leaves any separately requested ordinary construction.
  // A canonical alias ("English Spread / British Collar") is a single ID,
  // whereas "Spread Collar or English Spread Collar" needs human review.
  const mixedSpreadVariants =
    /\benglish[- ]+spread(?:[- ]collar|\s*[/&-]\s*british[- ]collar)\b/i.test(positive) &&
    /\bspread[- ]collar\b/i.test(positive.replace(
      /\benglish[- ]+spread(?:[- ]collar|\s*[/&-]\s*british[- ]collar)\b/gi, " ",
    ));
  const mixedButtonDownVariants =
    /\bsoft[- ]+button[- ]?down[- ]collar\b/i.test(positive) &&
    /\bbutton[- ]?down[- ]collar\b/i.test(positive.replace(
      /\bsoft[- ]+button[- ]?down[- ]collar\b/gi, " ",
    ));
  const possibleIds = named.length === 1
    ? exactRequested ? [exactRequested] : collarFamilyIds[named[0]]
    : [];
  return {
    requested,
    prohibited: [...prohibited],
    affirmative: positive,
    // A generic Spread request remains compatible with a separately banned
    // English Spread variant, since the ordinary Spread ID is still allowed.
    ambiguous: undecided || mixedSpreadVariants || mixedButtonDownVariants ||
      named.length > 1 || (possibleIds.length > 0 &&
      possibleIds.every(id => prohibited.has(id))),
  };
}

/**
 * Only select an ordinary photographed collar when exactly one explicit
 * collar family is named. This rejects "widespread", "button-downish" and
 * contradictory mixed-collar labels instead of taking substring precedence.
 * Oxford weave alone does not prove a button-down collar construction.
 */
export function styleDirectorCandidateOrdinaryCollar(
  candidateShirt: string,
): "spread" | "button_down" | null {
  const intent = candidateCollarIntent(candidateShirt);
  const families = intent.requested;
  if (intent.ambiguous || Object.values(families).filter(Boolean).length !== 1) return null;
  return families.spread ? "spread" : families.buttonDown ? "button_down" : null;
}

/**
 * Preserve explicitly named existing collar variants as canonical IDs.
 * Their unapproved photographic shape must still pass through the separate
 * preview parity gate; do not substitute generic photographed construction.
 */
export function styleDirectorCandidateVariantCollar(
  candidateShirt: string,
): "english_spread_collar" | "soft_button_down" | null {
  const intent = candidateCollarIntent(candidateShirt);
  if (intent.ambiguous || Object.values(intent.requested).filter(Boolean).length !== 1) return null;
  const selected = intent.requested.spread &&
    /\benglish[- ]+spread(?:[- ]collar|\s*[/&-]\s*british[- ]collar)\b/i.test(intent.affirmative)
    ? "english_spread_collar"
    : intent.requested.buttonDown &&
      /\bsoft[- ]+button[- ]?down[- ]collar\b/i.test(intent.affirmative)
      ? "soft_button_down" : null;
  return selected && optionsFor("shirt.collar").some(option => option.id === selected)
    ? selected : null;
}

// A prohibition of a sleeve length is not a positive request for it.
// Keep both positive and negative intent so contradictions and locked-ID
// mismatches can be reviewed without inventing a replacement construction.
const candidateSleeveLengths = (name: string) => {
  // Both "with or without" and cross-length alternatives leave construction
  // undecided. "Half or full sleeves" must not select full length merely
  // because the first "half" omits its sleeve noun. Synonyms within the
  // same length family ("short or half", "long or full") remain affirmative.
  const undecidedAlternative = /\b(?:with\s+(?:or\s+)?without\s+(?:(?:a|any)\s+)?(?:short|half|long|full)[ -]?sleeve(?:s|d)?|(?:short|half)(?:[ -]?sleeve(?:s|d)?)?\s+or\s+(?:long|full)[ -]?sleeve(?:s|d)?|(?:long|full)(?:[ -]?sleeve(?:s|d)?)?\s+or\s+(?:short|half)[ -]?sleeve(?:s|d)?)\b/gi;
  const undecided = undecidedAlternative.test(name);
  const instruction = name.replace(undecidedAlternative, " ");
  let bannedShort = false;
  let bannedLong = false;
  const ban = (word: string) => {
    if (/^(?:short|half)/i.test(word)) bannedShort = true;
    else bannedLong = true;
    return " ";
  };
  const withoutPrefixedBans = instruction.replace(
    /\b(?:no|without|avoid|never|not|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|include|choose|select|wear|add|have)\s+)?(?:(?:a|any)\s+)?((?:short|half|long|full)[ -]?sleeve(?:s|d)?)\b/gi,
    (_match, word: string) => ban(word),
  );
  const withoutSuffixBans = withoutPrefixedBans.replace(
    /\b((?:short|half|long|full)[ -]?sleeve(?:s|d)?)\s+(?:(?:are|is)\s+)?(?:forbidden|prohibited|banned|unwanted|not\s+(?:allowed|permitted|wanted)|(?:isn['’]?t|aren['’]?t)\s+wanted|(?:(?:must|should)\s+not|(?:mustn|shouldn)['’]?t)\s+be\s+(?:used|worn|chosen|selected))\b/gi,
    (_match, word: string) => ban(word),
  );
  // A sleeve described as optional is not an instruction to cut that
  // length. Remove optional phrases only AFTER bans so prohibited lengths
  // cannot be accidentally reinterpreted as choices.
  const affirmative = withoutSuffixBans
    .replace(
      /\b(?:optional|maybe)\s+(?:a\s+)?(?:short|half|long|full)[ -]?sleeve(?:s|d)?\b/gi,
      " ",
    )
    .replace(
      /\b(?:short|half|long|full)[ -]?sleeve(?:s|d)?\s+(?:(?:are|is)\s+)?(?:optional|unnecessary|not\s+(?:required|needed|mandatory)|(?:isn['’]?t|aren['’]?t)\s+(?:required|needed|mandatory))\b/gi,
      " ",
    );
  return {
    short: /\b(?:short|half)[ -]?sleeve(?:s|d)?\b/i.test(affirmative),
    long: /\b(?:long|full)[ -]?sleeve(?:s|d)?\b/i.test(affirmative),
    bannedShort,
    bannedLong,
    undecided,
  };
};

/**
 * Roll-up Styled is an existing long-sleeve presentation construction, not
 * an open short-sleeve hem. Parse positive, negative and optional instructions
 * before selecting its canonical ID or reviewing a locked design.
 */
export function styleDirectorCandidateRollUpSleeveIntent(name: string): {
  requested: boolean; prohibited: boolean; ambiguous: boolean;
} {
  let requested = false;
  let prohibited = false;
  let undecided = false;
  for (const hit of name.matchAll(/\broll[- ]?up(?:[- ]styled|[- ]sleeves?)?\b/gi)) {
    const prefix = name.slice(0, hit.index ?? 0);
    const suffix = name.slice((hit.index ?? 0) + hit[0].length);
    // An explicit "with or without" choice is unresolved: its "without"
    // must not turn into a confirmed roll-up ban or a positive request.
    if (/\bwith\s+(?:or\s+)?without\s+(?:(?:a|any|the)\s+)?$/i.test(prefix)) {
      undecided = true;
      continue;
    }
    // Postposed rejection forbids the rolled sleeve; optional language is
    // neutral and must not silently change the existing sleeve ID.
    const banned = /\b(?:no|without|avoid|never|not|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|add|include|choose|select|wear|have|want)\s+)?(?:(?:a|any|the)\s+)?$/i.test(prefix) ||
      /^\s+(?:(?:is|are)\s+)?(?:forbidden|prohibited|banned|unwanted|not\s+(?:allowed|permitted|wanted)|(?:isn['’]?t|aren['’]?t)\s+wanted|(?:(?:must|should)\s+not|(?:mustn['’]?t|shouldn['’]?t))\s+(?:be\s+)?(?:used|chosen|selected|worn))\b/i.test(suffix);
    const optional = /\b(?:optional|maybe)\s+$/i.test(prefix) ||
      /^\s+(?:(?:is|are)\s+)?(?:optional|unnecessary|not\s+(?:required|needed|mandatory)|(?:isn['’]?t|aren['’]?t)\s+(?:required|needed|mandatory))\b/i.test(suffix);
    if (banned) prohibited = true;
    else if (!optional) requested = true;
  }
  const lengths = candidateSleeveLengths(name);
  // Roll-up styled and an ordinary full sleeve are different saved options.
  // "Full sleeves or roll-up styled" cannot choose the roll-up ID by
  // substring priority, even though both options are physically long sleeves.
  // Without "or", "Full Sleeve Roll-up Styled" still names one construction.
  const rolled = String.raw`roll[- ]?up(?:[- ]styled|[- ]sleeves?)?`;
  const full = String.raw`(?:full|long)(?:[- ]sleeve(?:s|d)?)?`;
  const alternative = new RegExp(
    String.raw`\b(?:${full}\s+or\s+${rolled}|${rolled}\s+or\s+${full})\b`, "i",
  ).test(name);
  return {
    requested, prohibited,
    ambiguous: undecided || alternative || (requested && prohibited) ||
      (requested && (lengths.short || lengths.bannedLong)),
  };
}

// Wear words are instructions, not evidence of physical tuck length. A
// negative instruction must not become a *positive* tuck merely because the
// word "tucked" occurs in it. Remove recognized negations before looking for
// affirmative wear words; conflicting remaining intents still require review.
const candidateShirtWear = (name: string) => {
  // Neutralize the whole optional phrase before parsing "without tucked" as
  // a firm prohibition. Otherwise the inner "without" forces untucked wear.
  let remaining = name.replace(/\bwith\s+or\s+without\s+(?:being\s+)?(?:tucked|untucked)\b/gi, " ");
  let tuckedFromNegation = false;
  let untuckedFromNegation = false;
  remaining = remaining.replace(/\b(?:no|without|not|never|avoid|do\s+not|don['’]?t)\s+(?:(?:be|being)\s+){0,2}untucked\b/gi, () => {
    tuckedFromNegation = true;
    return " ";
  });
  remaining = remaining.replace(/\b(?:no|without|not|never|avoid|do\s+not|don['’]?t)\s+(?:(?:be|being)\s+){0,2}tucked\b/gi, () => {
    untuckedFromNegation = true;
    return " ";
  });
  // "Do not wear tucked" forbids a finished wear state, not the act of
  // tucking. Consume the entire phrase so the banned word cannot be parsed
  // later as an affirmative request.
  remaining = remaining.replace(/\b(?:(?:do|must|should|shall|can|could|would|may|might)\s+not|(?:don|mustn|shouldn|shan|can|couldn|wouldn)['’]?t|cannot|never)\s+wear\s+(?:(?:a|the|this|that|these|those|my|your|his|her|our|their)\s+)?(?:(?!(?:and|but|or|yet|however|whereas|nevertheless|nonetheless|though|although|while|instead)\b)[a-z][a-z-]*\s+){0,8}(?:(?:shirts?|garments?)\s+)?(?:(?:being)\s+)?(untucked|tucked)\b/gi, (_match, forbidden: string) => {
    if (forbidden.toLowerCase() === "tucked") untuckedFromNegation = true;
    else tuckedFromNegation = true;
    return " ";
  });
  // Object-bearing commands describe the same wear restriction as "do not
  // tuck", but the garment noun interrupts the existing verb matcher. Consume
  // the entire instruction before positive wear words are scanned.
  remaining = remaining.replace(/\b(?:(?:do|must|should|shall|can|could|would|may|might)\s+not|(?:don|mustn|shouldn|shan|can|couldn|wouldn)['’]?t|cannot|never)\s+(untuck|tuck)(?:ing)?\s+(?:(?:the|a|any|this|that|these|those|my|your|his|her|our|their)\s+)?(?:(?!(?:and|but|or|yet|however|whereas|nevertheless|nonetheless|though|although|while|instead)\b)[a-z][a-z-]*\s+){0,8}(?:shirts?|garments?)\b/gi, (_match, action: string) => {
    if (action.toLowerCase() === "tuck") untuckedFromNegation = true;
    else tuckedFromNegation = true;
    return " ";
  });
  // An explicit ban on untucking requires tucked wear, not a neutral choice.
  remaining = remaining.replace(/\b(?:(?:must|should|shall|do|can|could|would|may|might)\s+not|(?:mustn|shouldn|couldn|wouldn|shan|can|don)['’]?t|cannot|never|avoid|no|without)\s+(?:(?:the|any)\s+)?untuck(?:ing)?\b/gi, () => {
    tuckedFromNegation = true;
    return " ";
  });
  remaining = remaining.replace(/\b(?:(?:must|should|shall|do|can|could|would|may|might)\s+not|(?:mustn|shouldn|couldn|wouldn|must|should|shall|shan|can|could|would|don)['’]?t|cannot|never|avoid|no|without)\s+(?:(?:the|any)\s+)?tuck(?:ing)?\b/gi, () => {
    untuckedFromNegation = true;
    return " ";
  });
  // Modal prohibitions of a finished wear state must not be read as
  // affirmative tucked/untucked requests. Keep the opposite locked state.
  remaining = remaining.replace(/\b(?:(?:must|should|shall|can|could|would|may|might)\s+not|(?:mustn|shouldn|couldn|wouldn|shan|can)[\u0027’]?t|cannot)\s+(?:(?:be|being)\s+){1,2}(untucked|tucked)\b/gi, (_match, forbidden: string) => {
    if (forbidden.toLowerCase() === "tucked") untuckedFromNegation = true;
    else tuckedFromNegation = true;
    return " ";
  });
  // A refusal after the finished wear state is not an affirmative tucked
  // or untucked request. Consume the whole clause before scanning for either
  // state; the opposite wear state is required by an explicit prohibition.
  remaining = remaining.replace(
    /\b(untucked|tucked)\s+(?:(?:shirts?|garments?)\s+)?(?:(?:is|are)\s+)?(?:unwanted|prohibited|forbidden|banned|not\s+(?:wanted|allowed|permitted)|(?:isn['’]?t|aren['’]?t)\s+(?:wanted|allowed|permitted)|(?:must|should|shall)\s+not\s+be\s+(?:worn|used|chosen|selected))\b/gi,
    (_match, forbidden: string) => {
      if (forbidden.toLowerCase() === "tucked") untuckedFromNegation = true;
      else tuckedFromNegation = true;
      return " ";
    },
  );
  // "Not required" is optional, never a prohibition or a new wear choice.
  // Include a garment noun between the wear state and the optional qualifier.
  remaining = remaining.replace(
    /\b(?:untucked|tucked)\s+(?:(?:shirts?|garments?)\s+)?(?:(?:is|are)\s+)?(?:optional|unnecessary|not\s+(?:required|needed|mandatory|necessary)|(?:isn['’]?t|aren['’]?t)\s+(?:required|needed|mandatory|necessary))\b/gi,
    " ",
  );
  // An optional wear treatment is not a mandatory instruction to tuck or
  // untuck. Neutralize both prefix and suffix forms only after genuine
  // prohibitions have been consumed, keeping unrelated affirmative choices.
  remaining = remaining
    // "With or without" explicitly permits either treatment; it cannot
    // authorize changing a locked cutting/wear instruction.
    .replace(/\b(?:optional|maybe)\s+(?:a\s+)?(?:tucked|untucked)\b/gi, " ")
    .replace(/\b(?:tucked|untucked)\s+(?:(?:is|are)\s+)?(?:optional|unnecessary|not\s+(?:required|needed|mandatory))\b/gi, " ");
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
  const intent = candidateCollarIntent(candidateShirt);
  const collarFamilies = intent.requested;
  const { camp, band, cutaway } = collarFamilies;
  // Resolve only a single advanced collar. Named ordinary collars retain
  // their existing legacy path, and mixed requests cannot silently choose
  // one construction just because it matches a recognised advanced ID.
  if (intent.ambiguous || Number(camp) + Number(band) + Number(cutaway) !== 1 ||
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
  const intent = candidateCollarIntent(candidateShirt);
  const families = intent.requested;
  if (intent.ambiguous || Object.values(families).filter(Boolean).length !== 1) return null;
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
  const intent = candidateCollarIntent(candidateShirt);
  if (intent.ambiguous) return []; // The wording gate reports the contradiction.
  const positiveFamily = (Object.keys(intent.requested) as CandidateCollarFamily[])
    .find(family => intent.requested[family]);
  if (positiveFamily === undefined && intent.prohibited.length === 0) return [];
  const lockedCollar = styleDirectorLockedOptionValue(shirt, "collar");
  // A missing, inherited, stale or unreadable ID cannot prove a ban was obeyed.
  const trusted = typeof lockedCollar === "string" &&
    optionsFor("shirt.collar").some(option => option.id === lockedCollar);
  const exactVariant = styleDirectorCandidateVariantCollar(candidateShirt);
  const incorrectRequest = exactVariant !== null
    ? lockedCollar !== exactVariant
    : positiveFamily !== undefined && !collarFamilyIds[positiveFamily].includes(lockedCollar as string);
  const forbiddenSaved = intent.prohibited.includes(lockedCollar as string);
  return trusted && !incorrectRequest && !forbiddenSaved ? [] : [{
    code: "candidate_collar_mismatch",
    explanation: "The proposed shirt names a collar construction different from its locked versioned collar ID; confirm the collar before tailoring.",
  }];
}

/**
 * Resolve only explicitly named placket construction, not generic words such
 * as "front" or "buttons". Positive, negative and optional instructions are
 * kept separate: a forbidden placket must not become a selected placket.
 */
const candidatePlacketPatterns = [
  { id: "standard_visible_placket", pattern: /\b(?:standard(?:[- ]visible(?:[- ]stitch)?)?[- ]placket|visible(?:[- ]stitch(?:ed)?)?[- ]placket|standard\s*\(\s*visible[- ]stitch\s*\)(?:[- ]placket)?)(?=$|[^\w])/gi },
  { id: "hidden_fly_front", pattern: /\b(?:hidden\s*[/&-]\s*fly[- ]?front(?:[- ]placket)?|hidden(?:[- ]fly[- ]?front)?[- ]placket|fly[- ]?front(?:[- ]placket)?)\b/gi },
  { id: "french_placket", pattern: /\bfrench[- ]placket\b/gi },
  { id: "covered_placket", pattern: /\bcovered[- ]placket\b/gi },
  { id: "contrast_placket", pattern: /\bcontrast[- ]placket\b/gi },
] as const;

type CandidatePlacketId = (typeof candidatePlacketPatterns)[number]["id"];

export function styleDirectorCandidatePlacketIntent(candidateShirt: string): {
  requested: CandidatePlacketId | null;
  prohibited: CandidatePlacketId[];
  ambiguous: boolean;
} {
  const requests = new Set<CandidatePlacketId>();
  const prohibitions = new Set<CandidatePlacketId>();
  let undecided = false;
  for (const { id, pattern } of candidatePlacketPatterns) {
    for (const hit of candidateShirt.matchAll(pattern)) {
      const index = hit.index ?? 0;
      const prefix = candidateShirt.slice(0, index);
      const suffix = candidateShirt.slice(index + hit[0].length);
      // "With or without" is an unresolved construction choice, not the
      // hard prohibition implied by the embedded word "without".
      if (/\bwith\s+(?:or\s+)?without\s+(?:(?:a|any|the)\s+)?$/i.test(prefix)) {
        undecided = true;
        continue;
      }
      const forbidden = /\b(?:no|without|avoid|never|not|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|add|include|choose|select|wear|have)\s+)?(?:(?:a|any|the)\s+)?$/i.test(prefix) ||
        /^\s+(?:(?:is|are)\s+)?(?:forbidden|prohibited|banned|unwanted|not\s+(?:allowed|permitted|wanted)|(?:isn['’]?t|aren['’]?t)\s+wanted|(?:(?:must|should)\s+not|(?:mustn|shouldn)['’]?t)\s+be\s+(?:used|chosen|selected|worn))\b/i.test(suffix);
      const optional = /\b(?:optional|maybe)\s+$/i.test(prefix) ||
        /^\s+(?:(?:is|are)\s+)?(?:optional|unnecessary|not\s+(?:required|needed|mandatory)|(?:isn[\'’]?t|aren[\'’]?t)\s+(?:required|needed|mandatory))\b/i.test(suffix);
      if (forbidden) prohibitions.add(id);
      else if (!optional) requests.add(id);
    }
  }
  return {
    requested: requests.size === 1 ? [...requests][0] : null,
    prohibited: [...prohibitions],
    ambiguous: undecided || requests.size > 1 || [...requests].some(id => prohibitions.has(id)),
  };
}

/** Map a single named placket to existing canonical IDs only. */
export function styleDirectorCandidatePlacket(
  candidateShirt: string, legacyChoices: readonly string[],
): { versioned: CandidatePlacketId; legacy: string | null } | null {
  const intent = styleDirectorCandidatePlacketIntent(candidateShirt);
  if (intent.ambiguous || !intent.requested) return null;
  const option = optionsFor("shirt.placket").find(entry => entry.id === intent.requested);
  if (!option) return null;
  const label = option.legacyLabel || option.label;
  return {
    versioned: intent.requested,
    legacy: option.legacySelectable !== false && option.renderSupport.livePreview !== "none" &&
      legacyChoices.includes(label) ? label : null,
  };
}

/** A named or prohibited placket must agree with the saved versioned recipe. */
export function styleDirectorCandidatePlacketIssues(
  candidateShirt: string, shirt: Pick<StyleSpecV2["shirt"], "placket">,
): DirectorConstructionIssue[] {
  const intent = styleDirectorCandidatePlacketIntent(candidateShirt);
  if (intent.ambiguous || (intent.requested === null && intent.prohibited.length === 0)) return [];
  const lockedPlacket = styleDirectorLockedOptionValue(shirt, "placket");
  // A missing, inherited, accessor or stale option cannot prove compliance.
  const trusted = typeof lockedPlacket === "string" &&
    optionsFor("shirt.placket").some(option => option.id === lockedPlacket);
  const conflicts = !trusted ||
    (intent.requested !== null && lockedPlacket !== intent.requested) ||
    intent.prohibited.includes(lockedPlacket as CandidatePlacketId);
  return conflicts ? [{
    code: "candidate_placket_mismatch",
    explanation: "The requested or prohibited shirt placket conflicts with the locked versioned construction; confirm the front before tailoring.",
  }] : [];
}

/**
 * The existing style schema supports no pocket, patch and flap pockets but
 * the legacy photographic selector has no pocket field. Resolve explicit
 * candidate instructions to canonical IDs without claiming a rendered pocket.
 * An unqualified "pocket" is deliberately not a construction choice.
 */
const candidatePocketPatterns = [
  { id: "single_patch_pocket", pattern: /\b(?:single[- ]patch|patch)[- ]pockets?\b/gi },
  { id: "flap_pocket", pattern: /\bflap[- ]pockets?\b/gi },
] as const;

type CandidatePocketId = "no_pocket" | (typeof candidatePocketPatterns)[number]["id"];

export function styleDirectorCandidatePocketIntent(candidateShirt: string): {
  requested: CandidatePocketId | null;
  prohibited: CandidatePocketId[];
  ambiguous: boolean;
} {
  // An unresolved pocket alternative cannot be mistaken for "no pocket"
  // or a ban on patch/flap construction. Keep separate explicit constraints.
  const alternative = /\bwith\s+(?:or\s+)?without\s+(?:(?:a|any|the)\s+)?(?:(?:single[- ]patch|patch|flap)[- ]?)?pockets?\b/gi;
  const undecided = alternative.test(candidateShirt);
  const instruction = candidateShirt.replace(alternative, " ");
  const requested = new Set<CandidatePocketId>();
  const prohibited = new Set<CandidatePocketId>();
  const optionalBefore = (prefix: string) => /\b(?:optional|maybe)\s+$/i.test(prefix);
  const optionalAfter = (suffix: string) => /^\s+(?:(?:is|are)\s+)?(?:optional|not\s+(?:required|needed|mandatory)|(?:isn['’]?t|aren['’]?t)\s+(?:required|needed|mandatory))\b/i.test(suffix);
  // "No Pocket" states the *absence* of the pocket. It is not a
  // prohibition of the versioned no_pocket ID.
  for (const hit of instruction.matchAll(/\b(?:no|without)\s+(?:(?:a|any|the)\s+)?pockets?\b|\bpocketless\b/gi)) {
    const start = hit.index ?? 0;
    const before = instruction.slice(0, start);
    const after = instruction.slice(start + hit[0].length);
    if (!optionalBefore(before) && !optionalAfter(after)) requested.add("no_pocket");
  }
  for (const { id, pattern } of candidatePocketPatterns) {
    for (const hit of instruction.matchAll(pattern)) {
      const start = hit.index ?? 0;
      const before = instruction.slice(0, start);
      const after = instruction.slice(start + hit[0].length);
      const banned = /\b(?:no|without|avoid|never|not|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|add|include|choose|select|wear|have|want)\s+)?(?:(?:a|any|the)\s+)?$/i.test(before) ||
        /^\s+(?:(?:is|are)\s+)?(?:forbidden|prohibited|banned|unwanted|not\s+(?:allowed|permitted|wanted)|(?:isn['’]?t|aren['’]?t)\s+wanted|(?:(?:should|must)\s+not|(?:shouldn|mustn)['’]?t)\s+be\s+(?:chosen|selected|used|worn))\b/i.test(after);
      if (banned) prohibited.add(id);
      else if (!optionalBefore(before) && !optionalAfter(after)) requested.add(id);
    }
  }
  return {
    requested: requested.size === 1 ? [...requested][0] : null,
    prohibited: [...prohibited],
    ambiguous: undecided || requested.size > 1 || [...requested].some(id => prohibited.has(id)),
  };
}

export function styleDirectorCandidatePocket(candidateShirt: string): CandidatePocketId | null {
  const intent = styleDirectorCandidatePocketIntent(candidateShirt);
  return intent.ambiguous || !intent.requested ||
    !optionsFor("shirt.pocket").some(option => option.id === intent.requested)
    ? null : intent.requested;
}

export function styleDirectorCandidatePocketIssues(
  candidateShirt: string,
  shirt: Pick<StyleSpecV2["shirt"], "pocket">,
): DirectorConstructionIssue[] {
  const intent = styleDirectorCandidatePocketIntent(candidateShirt);
  if (intent.ambiguous || (intent.requested === null && intent.prohibited.length === 0)) return [];
  const lockedPocket = styleDirectorLockedOptionValue(shirt, "pocket");
  // A negative pocket request must not silently approve an unreadable ID.
  const trusted = typeof lockedPocket === "string" &&
    optionsFor("shirt.pocket").some(option => option.id === lockedPocket);
  const wrongRequest = !trusted || (intent.requested !== null && lockedPocket !== intent.requested);
  const bannedChoice = intent.prohibited.includes(lockedPocket as CandidatePocketId);
  return wrongRequest || bannedChoice ? [{
    code: "candidate_pocket_mismatch",
    explanation: "The explicit pocket request or exclusion conflicts with the versioned locked shirt pocket construction; confirm the pocket before cutting.",
  }] : [];
}

/**
 * Collar finish is an existing versioned construction field, separate from
 * collar shape. The white contrast choices also require genuine second-fabric
 * evidence; the label alone is never production approval.
 */
const candidateFinishChoices = [
  "Self-fabric", "White contrast collar", "White contrast collar + cuffs",
] as const;
type CandidateCollarFinish = (typeof candidateFinishChoices)[number];

export function styleDirectorCandidateCollarFinishIntent(candidateShirt: string): {
  requested: CandidateCollarFinish | null;
  prohibited: CandidateCollarFinish[];
  ambiguous: boolean;
} {
  const requested = new Set<CandidateCollarFinish>();
  const prohibited = new Set<CandidateCollarFinish>();
  let undecided = false;
  for (const hit of candidateShirt.matchAll(/\b(?:white[- ]contrast[- ]collar(?:\s*(?:\+|and)\s*cuffs)?|self[- ]fabric)\b/gi)) {
    const token = hit[0];
    const start = hit.index ?? 0;
    const before = candidateShirt.slice(0, start);
    const after = candidateShirt.slice(start + token.length);
    const exact: CandidateCollarFinish = /^self[- ]fabric$/i.test(token)
      ? "Self-fabric"
      : /(?:\+|and)\s*cuffs$/i.test(token)
        ? "White contrast collar + cuffs" : "White contrast collar";
    // "With or without" offers a choice; the embedded "without" is not
    // a firm ban. Independent explicit finish requests remain reviewable.
    if (/\bwith\s+(?:or\s+)?without\s+(?:(?:a|any|the)\s+)?$/i.test(before)) {
      undecided = true;
      continue;
    }
    // Postposed refusal excludes the selected finish; an optional statement
    // never counts as either a request or a ban.
    const banned = /\b(?:no|without|avoid|never|not|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|add|include|choose|select|wear|have|want)\s+)?(?:(?:a|any|the)\s+)?$/i.test(before) ||
      /^\s+(?:(?:is|are)\s+)?(?:forbidden|prohibited|banned|unwanted|not\s+(?:allowed|permitted|wanted)|(?:isn['’]?t|aren['’]?t)\s+wanted|(?:(?:must|should)\s+not|(?:mustn|shouldn)['’]?t)\s+be\s+(?:used|chosen|selected|worn))\b/i.test(after);
    const optional = /\b(?:optional|maybe)\s+$/i.test(before) ||
      /^\s+(?:(?:is|are)\s+)?(?:optional|not\s+(?:required|needed|mandatory)|(?:isn['’]?t|aren['’]?t)\s+(?:required|needed|mandatory))\b/i.test(after);
    // A prohibition of any white contrast collar also forbids a white
    // contrast collar + cuffs, but banning the combination alone leaves the
    // simpler collar-only treatment available.
    if (banned) {
      prohibited.add(exact);
      if (exact === "White contrast collar") prohibited.add("White contrast collar + cuffs");
    } else if (!optional) requested.add(exact);
  }
  return {
    requested: requested.size === 1 ? [...requested][0] : null,
    prohibited: [...prohibited],
    ambiguous: undecided || requested.size > 1 || [...requested].some(option => prohibited.has(option)),
  };
}

export function styleDirectorCandidateCollarFinish(candidateShirt: string): CandidateCollarFinish | null {
  const intent = styleDirectorCandidateCollarFinishIntent(candidateShirt);
  return intent.ambiguous ? null : intent.requested;
}

export function styleDirectorCandidateCollarFinishIssues(
  candidateShirt: string,
  shirt: Pick<StyleSpecV2["shirt"], "collarFinish">,
): DirectorConstructionIssue[] {
  const intent = styleDirectorCandidateCollarFinishIntent(candidateShirt);
  if (intent.ambiguous || (intent.requested === null && intent.prohibited.length === 0)) return [];
  const lockedFinish = styleDirectorLockedOptionValue(shirt, "collarFinish");
  // Unknown, inherited and unreadable values cannot prove an explicit finish.
  const trusted = candidateFinishChoices.some(option => option === lockedFinish);
  return !trusted || (intent.requested !== null && intent.requested !== lockedFinish) ||
    intent.prohibited.includes(lockedFinish as CandidateCollarFinish) ? [{
      code: "candidate_collar_finish_mismatch",
      explanation: "The specified collar/contrast finish conflicts with the locked shirt details; verify the separate fabric and cuff placement before cutting.",
    }] : [];
}

/**
 * A shirt's button material is a separate versioned garment option from the
 * barrel-cuff button count or metal piping. Only a named material establishes
 * intent; neither a generic "buttons" nor an unrelated "contrast" does.
 */
const candidateButtonPatterns = [
  { id: "mother_of_pearl", pattern: /\bmother[- ]of[- ]pearl(?:[- ]buttons?)?\b/gi },
  { id: "corozo", pattern: /\bcorozo(?:\s*\(\s*vegetable\s+ivory\s*\))?(?:[- ]buttons?)?\b/gi },
  { id: "horn", pattern: /\bhorn[- ]buttons?\b/gi },
  { id: "plastic_resin", pattern: /\b(?:plastic\s*[/&-]\s*resin(?:[- ]buttons?)?|(?:plastic|resin)[- ]buttons?)\b/gi },
  { id: "metal_contrast", pattern: /\b(?:metal\s*[/&-]\s*contrast(?:[- ]buttons?)?|metal[- ]buttons?)\b/gi },
] as const;

type CandidateButtonId = (typeof candidateButtonPatterns)[number]["id"];

export function styleDirectorCandidateButtonIntent(candidateShirt: string): {
  requested: CandidateButtonId | null;
  prohibited: CandidateButtonId[];
  ambiguous: boolean;
} {
  const requested = new Set<CandidateButtonId>();
  const prohibited = new Set<CandidateButtonId>();
  let undecided = false;
  // A short alternative can omit "buttons" after its first material:
  // "horn or corozo buttons" must not silently select Corozo. Equivalent
  // plastic/resin names still identify the same existing material ID.
  const material = String.raw`(?:mother[- ]of[- ]pearl|corozo(?:\s*\(\s*vegetable\s+ivory\s*\))?|horn|plastic|resin|metal)`;
  const abbreviatedAlternative = new RegExp(
    String.raw`\b(${material})(?:[- ]buttons?)?\s+or\s+(${material})[- ]buttons?\b`, "gi",
  );
  const materialId = (label: string): CandidateButtonId =>
    /^mother/i.test(label) ? "mother_of_pearl"
      : /^corozo/i.test(label) ? "corozo"
        : /^horn/i.test(label) ? "horn"
          : /^(?:plastic|resin)/i.test(label) ? "plastic_resin" : "metal_contrast";
  const instruction = candidateShirt.replace(abbreviatedAlternative,
    (match: string, first: string, second: string) => {
      if (materialId(first) !== materialId(second)) {
        undecided = true;
        return " ";
      }
      return match;
    },
  );
  for (const { id, pattern } of candidateButtonPatterns) {
    for (const match of instruction.matchAll(pattern)) {
      const start = match.index ?? 0;
      const prefix = instruction.slice(0, start);
      const suffix = instruction.slice(start + match[0].length);
      // "With or without" leaves the button material unresolved; do not
      // mistake its embedded "without" for a confirmed material exclusion.
      if (/\bwith\s+(?:or\s+)?without\s+(?:(?:a|any|the)\s+)?$/i.test(prefix)) {
        undecided = true;
        continue;
      }
      // Postposed material refusals are prohibitions, never requests.
      // Non-mandatory / optional wording must remain neutral.
      const banned = /\b(?:no|without|avoid|never|not|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|add|include|choose|select|wear|have|want)\s+)?(?:(?:a|any|the)\s+)?$/i.test(prefix) ||
        /^\s+(?:(?:is|are)\s+)?(?:forbidden|prohibited|banned|unwanted|not\s+(?:allowed|permitted|wanted)|(?:isn['’]?t|aren['’]?t)\s+wanted|(?:(?:must|should)\s+not|(?:mustn|shouldn)['’]?t)\s+be\s+(?:used|chosen|selected|worn))\b/i.test(suffix);
      const optional = /\b(?:optional|maybe)\s+$/i.test(prefix) ||
        /^\s+(?:(?:is|are)\s+)?(?:optional|unnecessary|not\s+(?:required|needed|mandatory)|(?:isn['’]?t|aren['’]?t)\s+(?:required|needed|mandatory))\b/i.test(suffix);
      if (banned) prohibited.add(id);
      else if (!optional) requested.add(id);
    }
  }
  return {
    requested: requested.size === 1 ? [...requested][0] : null,
    prohibited: [...prohibited],
    ambiguous: undecided || requested.size > 1 || [...requested].some(id => prohibited.has(id)),
  };
}

export function styleDirectorCandidateButton(
  candidateShirt: string,
  legacyChoices: readonly string[],
): { versioned: CandidateButtonId; legacy: string | null } | null {
  const intent = styleDirectorCandidateButtonIntent(candidateShirt);
  if (intent.ambiguous || !intent.requested) return null;
  const option = optionsFor("shirt.button").find(entry => entry.id === intent.requested);
  if (!option) return null;
  const label = option.legacyLabel || option.label;
  return {
    versioned: intent.requested,
    legacy: option.legacySelectable !== false &&
      option.renderSupport.livePreview !== "none" &&
      legacyChoices.includes(label) ? label : null,
  };
}

export function styleDirectorCandidateButtonIssues(
  candidateShirt: string,
  shirt: Pick<StyleSpecV2["shirt"], "button">,
): DirectorConstructionIssue[] {
  const intent = styleDirectorCandidateButtonIntent(candidateShirt);
  if (intent.ambiguous || (intent.requested === null && intent.prohibited.length === 0)) return [];
  const lockedButton = styleDirectorLockedOptionValue(shirt, "button");
  // A negative instruction cannot approve a stale or unreadable material ID.
  const trusted = typeof lockedButton === "string" &&
    optionsFor("shirt.button").some(option => option.id === lockedButton);
  const invalid = !trusted ||
    (intent.requested !== null && lockedButton !== intent.requested) ||
    intent.prohibited.includes(lockedButton as CandidateButtonId);
  return invalid ? [{
    code: "candidate_button_mismatch",
    explanation: "The requested or prohibited button material conflicts with the locked shirt's versioned button choice; confirm the actual button stock before cutting.",
  }] : [];
}

/**
 * A cuff is selected from explicitly named construction, never from a generic
 * "cuff" or "button" mention. The photographed selector is a separate
 * contract; unsupported canonical cuffs remain review-only.
 */
const candidateCuffPatterns = [
  { id: "french_double_cuff", pattern: /\b(?:french(?:\s*\/\s*double)?|double)[ -]cuffs?\b/gi },
  { id: "barrel_cuff_2_button", pattern: /\b(?:barrel[- ]cuffs?[\s(]*2[- ]?buttons?\b\)?|2[- ]?buttons?[- ]barrel[- ]cuffs?\b)/gi },
  { id: "barrel_cuff_1_button", pattern: /\b(?:barrel[- ]cuffs?[\s(]*1[- ]?buttons?\b\)?|1[- ]?buttons?[- ]barrel[- ]cuffs?\b)/gi },
  { id: "convertible_cuff", pattern: /\bconvertible[- ]cuffs?\b/gi },
  { id: "rounded_soft_cuff", pattern: /\b(?:rounded(?:\s*\/\s*soft)?|soft|rounded[- ]soft)[- ]cuffs?\b/gi },
  { id: "cocktail_cuff", pattern: /\bcocktail[- ]cuffs?\b/gi },
  { id: "angled_barrel_cuff", pattern: /\bangled[- ]barrel[- ]cuffs?\b/gi },
  { id: "open_short_hem_cuff", pattern: /\b(?:open[- ]short[- ]sleeve[- ]hem|short[- ]sleeve[- ]open[- ]hem)\b/gi },
] as const;

type CandidateCuffId = (typeof candidateCuffPatterns)[number]["id"];

export function styleDirectorCandidateCuffIntent(candidateShirt: string): {
  requested: CandidateCuffId | null;
  prohibited: CandidateCuffId[];
  ambiguous: boolean;
} {
  const requested = new Set<CandidateCuffId>();
  const prohibited = new Set<CandidateCuffId>();
  let undecided = false;
  // "French or cocktail cuffs" is a two-ID choice, even though the first
  // adjective omits "cuff". Equivalent French/double and rounded/soft
  // names still refer to one canonical construction.
  const named = String.raw`(?:french|double|convertible|rounded|soft|cocktail|angled[- ]barrel)`;
  const abbreviatedAlternative = new RegExp(
    String.raw`\b(${named})(?:[- ]cuffs?)?\s+or\s+(${named})[- ]cuffs?\b`,
    "gi",
  );
  const cuffId = (name: string): CandidateCuffId =>
    /^(?:french|double)$/i.test(name) ? "french_double_cuff"
      : /^(?:rounded|soft)$/i.test(name) ? "rounded_soft_cuff"
        : /^convertible$/i.test(name) ? "convertible_cuff"
          : /^cocktail$/i.test(name) ? "cocktail_cuff" : "angled_barrel_cuff";
  const instruction = candidateShirt.replace(abbreviatedAlternative,
    (phrase: string, first: string, second: string) => {
      if (cuffId(first) !== cuffId(second)) {
        undecided = true;
        return " ";
      }
      return phrase;
    },
  );
  for (const { id, pattern } of candidateCuffPatterns) {
    for (const match of instruction.matchAll(pattern)) {
      const index = match.index ?? 0;
      const prefix = instruction.slice(0, index);
      const suffix = instruction.slice(index + match[0].length);
      // "With or without" leaves a cuff choice unresolved; its "without"
      // does not forbid the named canonical construction.
      if (/\bwith\s+(?:or\s+)?without\s+(?:(?:a|any|the)\s+)?$/i.test(prefix)) {
        undecided = true;
        continue;
      }
      // A postposed refusal is a prohibition, not a positive cuff choice.
      // Optional wording must remain separate from explicit rejection.
      const banned = /\b(?:no|without|avoid|never|not|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|add|include|choose|select|wear|have)\s+)?(?:(?:a|any|the)\s+)?$/i.test(prefix) ||
        /^\s+(?:(?:is|are)\s+)?(?:forbidden|prohibited|banned|unwanted|not\s+(?:allowed|permitted|wanted)|(?:isn['’]?t|aren['’]?t)\s+wanted|(?:(?:must|should)\s+not|(?:mustn|shouldn)['’]?t)\s+be\s+(?:used|chosen|selected|worn))\b/i.test(suffix);
      const optional = /\b(?:optional|maybe)\s+$/i.test(prefix) ||
        /^\s+(?:(?:is|are)\s+)?(?:optional|unnecessary|not\s+(?:required|needed|mandatory)|(?:isn['’]?t|aren['’]?t)\s+(?:required|needed|mandatory))\b/i.test(suffix);
      if (banned) prohibited.add(id);
      else if (!optional) requested.add(id);
    }
  }
  return {
    requested: requested.size === 1 ? [...requested][0] : null,
    prohibited: [...prohibited],
    ambiguous: undecided || requested.size > 1 || [...requested].some(id => prohibited.has(id)),
  };
}

/** Resolve an existing named cuff with a truthful optional photo selection. */
export function styleDirectorCandidateCuff(
  candidateShirt: string, legacyChoices: readonly string[],
): { versioned: CandidateCuffId; legacy: string | null } | null {
  const intent = styleDirectorCandidateCuffIntent(candidateShirt);
  if (intent.ambiguous || !intent.requested) return null;
  const option = optionsFor("shirt.cuff").find(entry => entry.id === intent.requested);
  if (!option) return null;
  const label = option.legacyLabel || option.label;
  return {
    versioned: intent.requested,
    legacy: option.legacySelectable !== false &&
      option.renderSupport.livePreview !== "none" && legacyChoices.includes(label) ? label : null,
  };
}

/** Never certify a requested or prohibited cuff that conflicts with the lock. */
export function styleDirectorCandidateCuffIssues(
  candidateShirt: string, shirt: Pick<StyleSpecV2["shirt"], "cuff">,
): DirectorConstructionIssue[] {
  const intent = styleDirectorCandidateCuffIntent(candidateShirt);
  if (intent.ambiguous || (intent.requested === null && intent.prohibited.length === 0)) return [];
  const lockedCuff = styleDirectorLockedOptionValue(shirt, "cuff");
  // Only a canonical own-data cuff ID can satisfy an explicit instruction.
  const trusted = typeof lockedCuff === "string" &&
    optionsFor("shirt.cuff").some(option => option.id === lockedCuff);
  const wrongRequest = !trusted || (intent.requested !== null && lockedCuff !== intent.requested);
  const prohibitedSaved = intent.prohibited.includes(lockedCuff as CandidateCuffId);
  return wrongRequest || prohibitedSaved ? [{
    code: "candidate_cuff_mismatch",
    explanation: "The requested or prohibited cuff conflicts with the locked versioned cuff construction; confirm the cuff before cutting.",
  }] : [];
}

/**
 * Explicit shirt fit labels map to existing, versioned constructions. Keep fit
 * independent from sleeve, cuff, colour and fabric drape. The name is a
 * request, NOT evidence of measured body ease or a verified photograph.
 */
const candidateShirtFitPatterns = [
  { id: "slim_fit", pattern: /\bslim[- ]fit\b/gi },
  { id: "regular_classic_fit", pattern: /\b(?:regular(?:\s*\/\s*classic)?|classic)[- ]fit\b/gi },
  { id: "relaxed_fit", pattern: /\brelaxed[- ]fit\b/gi },
  { id: "boxy_oversized", pattern: /\b(?:boxy\s*[/&-]\s*oversized|boxy(?:[- ]oversized)?|oversized)[- ]fit\b/gi },
  { id: "athletic_taper", pattern: /\bathletic[- ]taper[- ]fit\b/gi },
] as const;

type CandidateShirtFitId = (typeof candidateShirtFitPatterns)[number]["id"];

// A fit offered "with or without" is undecided. "Without" alone is still
// a real exclusion. Reuse this contract across shirt and trouser fit options.
const candidateFitUndecidedPrefix = /\bwith\s+(?:or\s+)?without\s+(?:(?:a|any|the)\s+)?$/i;


export function styleDirectorCandidateShirtFitIntent(candidateShirt: string): {
  requested: CandidateShirtFitId | null;
  prohibited: CandidateShirtFitId[];
  ambiguous: boolean;
} {
  const requested = new Set<CandidateShirtFitId>();
  const prohibited = new Set<CandidateShirtFitId>();
  let undecided = false;
  // A shortened choice such as "slim or relaxed fit" names two different
  // canonical fits, although only the last adjective carries "fit".
  // Keep synonymous regular/classic and boxy/oversized alternatives valid.
  const fitFamily = (word: string): CandidateShirtFitId => {
    const name = word.toLowerCase().replace(/[- ]+/g, " ");
    if (name === "regular" || name === "classic") return "regular_classic_fit";
    if (name === "boxy" || name === "oversized") return "boxy_oversized";
    if (name === "athletic taper") return "athletic_taper";
    return name === "slim" ? "slim_fit" : "relaxed_fit";
  };
  const contractedAlternatives = /\b(slim|regular|classic|relaxed|boxy|oversized|athletic[ -]taper)(?:[- ]fit)?\s+or\s+(slim|regular|classic|relaxed|boxy|oversized|athletic[ -]taper)(?:[- ]fit)?\b/gi;
  const instruction = candidateShirt.replace(contractedAlternatives, (phrase, first: string, second: string) => {
    if (/\bfit\b/i.test(phrase) && fitFamily(first) !== fitFamily(second)) {
      undecided = true;
      return " ";
    }
    return phrase;
  });
  for (const { id, pattern } of candidateShirtFitPatterns) {
    for (const match of instruction.matchAll(pattern)) {
      const index = match.index ?? 0;
      const before = instruction.slice(0, index);
      const after = instruction.slice(index + match[0].length);
      if (candidateFitUndecidedPrefix.test(before)) {
        undecided = true;
        continue;
      }
      const ban = /\b(?:no|without|avoid|never|not|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|choose|select|wear|include|have|want)\s+)?(?:(?:a|any|the)\s+)?$/i.test(before) ||
        /^\s+(?:(?:is|are)\s+)?(?:forbidden|prohibited|banned|unwanted|not\s+(?:allowed|permitted|wanted)|(?:isn['’]?t|aren['’]?t)\s+wanted|(?:(?:should|must)\s+not|(?:shouldn|mustn)['’]?t)\s+be\s+(?:chosen|selected|used|worn))\b/i.test(after);
      const optional = /\b(?:optional|maybe)\s+$/i.test(before) ||
        /^\s+(?:(?:is|are)\s+)?(?:optional|unnecessary|not\s+(?:required|needed|mandatory)|(?:isn['’]?t|aren['’]?t)\s+(?:required|needed|mandatory))\b/i.test(after);
      if (ban) prohibited.add(id);
      else if (!optional) requested.add(id);
    }
  }
  return {
    requested: requested.size === 1 ? [...requested][0] : null,
    prohibited: [...prohibited],
    ambiguous: undecided || requested.size > 1 || [...requested].some(id => prohibited.has(id)),
  };
}

export function styleDirectorCandidateShirtFit(
  candidateShirt: string,
  legacyChoices: readonly string[],
): { versioned: CandidateShirtFitId; legacy: string | null } | null {
  const intent = styleDirectorCandidateShirtFitIntent(candidateShirt);
  if (intent.ambiguous || !intent.requested) return null;
  const option = optionsFor("shirt.fit").find(entry => entry.id === intent.requested);
  if (!option) return null;
  const label = option.legacyLabel || option.label;
  return {
    versioned: intent.requested,
    legacy: option.legacySelectable !== false &&
      option.renderSupport.livePreview !== "none" && legacyChoices.includes(label) ? label : null,
  };
}

export function styleDirectorCandidateShirtFitIssues(
  candidateShirt: string,
  shirt: Pick<StyleSpecV2["shirt"], "fit">,
): DirectorConstructionIssue[] {
  const intent = styleDirectorCandidateShirtFitIntent(candidateShirt);
  if (intent.ambiguous || (intent.requested === null && intent.prohibited.length === 0)) return [];
  const lockedFit = styleDirectorLockedOptionValue(shirt, "fit");
  // Only canonical own-data IDs can meet positive or negative fit instructions.
  const trusted = typeof lockedFit === "string" &&
    optionsFor("shirt.fit").some(option => option.id === lockedFit);
  if (!trusted || (intent.requested !== null && lockedFit !== intent.requested) ||
    intent.prohibited.includes(lockedFit as CandidateShirtFitId)) {
    return [{
      code: "candidate_shirt_fit_mismatch",
      explanation: "The named shirt fit request or prohibition conflicts with the saved fit option; confirm the construction without inferring body ease.",
    }];
  }
  return [];
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
  const rollUp = styleDirectorCandidateRollUpSleeveIntent(candidateShirt);
  // Contradictory phrasing is already reported by the wording gate.
  if (rollUp.ambiguous || (intent.short && intent.long) ||
      (intent.short && intent.bannedShort) || (intent.long && intent.bannedLong) ||
      (intent.bannedShort && intent.bannedLong)) return [];
  if (!(intent.short || intent.long || intent.bannedShort || intent.bannedLong ||
      rollUp.requested || rollUp.prohibited)) return [];
  // Prohibitions must never approve a missing, inherited, stale or unreadable
  // sleeve ID simply because it differs from the disallowed construction.
  const lockedSleeve = styleDirectorLockedOptionValue(shirt, "sleeve");
  const trusted = typeof lockedSleeve === "string" &&
    optionsFor("shirt.sleeve").some(option => option.id === lockedSleeve);
  const invalid = !trusted ||
    (intent.short && lockedSleeve !== "half_sleeve") ||
    (intent.long && !["full_sleeve", "roll_up_styled"].includes(lockedSleeve as string)) ||
    (intent.bannedShort && lockedSleeve === "half_sleeve") ||
    (intent.bannedLong && lockedSleeve !== "half_sleeve") ||
    (rollUp.requested && lockedSleeve !== "roll_up_styled") ||
    (rollUp.prohibited && lockedSleeve === "roll_up_styled");
  return invalid ? [{
    code: "candidate_sleeve_mismatch",
    explanation: "The proposed shirt's requested or prohibited sleeve length conflicts with its versioned construction; confirm the sleeve before tailoring.",
  }] : [];
}

export function styleDirectorCandidateSleeve(
  candidateShirt: string,
): { sleeve: "half_sleeve"; cuff: "open_short_hem_cuff" } | null {
  const { short: shortSleeve, long: longSleeve, bannedShort, undecided } = candidateSleeveLengths(candidateShirt);
  // An explicitly undecided sleeve choice must never select an open short hem.
  return !undecided && shortSleeve && !longSleeve && !bannedShort
    ? { sleeve: "half_sleeve", cuff: "open_short_hem_cuff" }
    : null;
}

/**
 * Explicit pant fit is a distinct, versioned construction dimension from the
 * silhouette/type, pleat count, and waistband. A named fit does not establish
 * physical body measurements or a faithful photographic trouser shape.
 */
const candidateTrouserFitPatterns = [
  { id: "slim_tapered", pattern: /\bslim[- ]tapered(?:[- ]fit)?\b/gi },
  { id: "straight_classic", pattern: /\bstraight[- ]classic(?:[- ]fit)?\b/gi },
  { id: "regular_tapered", pattern: /\bregular[- ]tapered(?:[- ]fit)?\b/gi },
  { id: "korean_straight_wide", pattern: /\bkorean[- ]straight[- ]wide(?:[- ]fit)?\b/gi },
  { id: "korean_tapered", pattern: /\bkorean[- ]tapered(?:[- ]fit)?\b/gi },
  { id: "baggy_wide", pattern: /\bbaggy[- ]wide(?:[- ]fit)?\b/gi },
  { id: "wide_leg_drape", pattern: /\bwide[- ]leg[- ]drape(?:[- ]fit)?\b/gi },
  { id: "pleated_straight", pattern: /\bpleated[- ]straight(?:[- ]fit)?\b/gi },
  { id: "cargo_utility", pattern: /\bcargo[- ]utility(?:[- ]fit)?\b/gi },
  { id: "jean_cut_suiting_fit", pattern: /\bjean[- ]cut[- ]suiting[- ]fit\b/gi },
] as const;
type CandidateTrouserFitId = (typeof candidateTrouserFitPatterns)[number]["id"];

export function styleDirectorCandidateTrouserFitIntent(candidateTrouser: string): {
  requested: CandidateTrouserFitId | null;
  prohibited: CandidateTrouserFitId[];
  ambiguous: boolean;
} {
  const requested = new Set<CandidateTrouserFitId>();
  const prohibited = new Set<CandidateTrouserFitId>();
  let undecided = false;
  // "Slim or regular tapered fit" and the reverse abbreviated wording name
  // distinct canonical trouser fits; the first adjective may omit "tapered".
  // Same-adjective repetitions such as "slim or slim tapered" stay definite.
  const sharedTaperAlternative =
    /\b(slim|regular)(?:[- ]tapered)?\s+or\s+(slim|regular)[- ]tapered(?:[- ]fit)?\b|\b(slim|regular)[- ]tapered(?:[- ]fit)?\s+or\s+(slim|regular)\b/gi;
  const instruction = candidateTrouser.replace(sharedTaperAlternative,
    (phrase: string, left: string | undefined, right: string | undefined,
      reverseLeft: string | undefined, reverseRight: string | undefined) => {
      const first = left ?? reverseLeft;
      const second = right ?? reverseRight;
      if (first !== undefined && second !== undefined &&
          first.toLowerCase() !== second.toLowerCase()) {
        undecided = true;
        return " ";
      }
      return phrase;
    });
  for (const { id, pattern } of candidateTrouserFitPatterns) {
    for (const match of instruction.matchAll(pattern)) {
      const index = match.index ?? 0;
      const prefix = instruction.slice(0, index);
      const suffix = instruction.slice(index + match[0].length);
      if (candidateFitUndecidedPrefix.test(prefix)) {
        undecided = true;
        continue;
      }
      const banned = /\b(?:no|without|avoid|never|not|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|choose|select|wear|include|have|want)\s+)?(?:(?:a|any|the)\s+)?$/i.test(prefix) ||
        /^\s+(?:(?:is|are)\s+)?(?:forbidden|prohibited|banned|unwanted|not\s+(?:allowed|permitted|wanted)|(?:isn['’]?t|aren['’]?t)\s+wanted|(?:(?:should|must)\s+not|(?:shouldn|mustn)['’]?t)\s+be\s+(?:chosen|selected|used|worn))\b/i.test(suffix);
      const optional = /\b(?:optional|maybe)\s+$/i.test(prefix) ||
        /^\s+(?:(?:is|are)\s+)?(?:optional|unnecessary|not\s+(?:required|needed|mandatory)|(?:isn['’]?t|aren['’]?t)\s+(?:required|needed|mandatory))\b/i.test(suffix);
      if (banned) prohibited.add(id);
      else if (!optional) requested.add(id);
    }
  }
  return {
    requested: requested.size === 1 ? [...requested][0] : null,
    prohibited: [...prohibited],
    ambiguous: undecided || requested.size > 1 || [...requested].some(id => prohibited.has(id)),
  };
}

export function styleDirectorCandidateTrouserFit(candidateTrouser: string): CandidateTrouserFitId | null {
  const intent = styleDirectorCandidateTrouserFitIntent(candidateTrouser);
  return intent.ambiguous ? null : intent.requested;
}

/** Require a human photographic review; pant.fit has no legacy style selector. */
export function styleDirectorCandidateTrouserFitIssues(
  candidateTrouser: string,
  pant: Pick<StyleSpecV2["pant"], "fit">,
): DirectorConstructionIssue[] {
  const intent = styleDirectorCandidateTrouserFitIntent(candidateTrouser);
  if (intent.ambiguous || (intent.requested === null && intent.prohibited.length === 0)) return [];
  const lockedFit = styleDirectorLockedOptionValue(pant, "fit");
  const trusted = typeof lockedFit === "string" &&
    optionsFor("pant.fit").some(option => option.id === lockedFit);
  const mismatch = !trusted || (intent.requested !== null && lockedFit !== intent.requested) ||
    intent.prohibited.includes(lockedFit as CandidateTrouserFitId);
  if (mismatch) return [{
    code: "candidate_trouser_fit_mismatch",
    explanation: "The requested or prohibited trouser fit conflicts with the locked versioned fit ID; confirm the construction before tailoring.",
  }];
  const selected = intent.requested && optionsFor("pant.fit").find(option => option.id === intent.requested);
  return selected?.renderSupport.livePreview === "none" ? [{
    code: "unverified_trouser_fit_photo",
    explanation: "The selected trouser fit is recorded by its canonical ID, but its live photographic geometry is not verified; confirm with a tailor.",
  }] : [];
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
  const width = String.raw`(?:wide[- ]?leg(?:ged)?(?:[- ]?(?:trousers?|pants?))?|wide[- ]?fit[- ]?(?:trousers?|pants?)|wide[- ]?(?:trousers?|pants?))`;
  const beforeBan = new RegExp(String.raw`\b(?:no|without|avoid|never|not|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|choose|select|wear|include|add|have|want)\s+)?(?:(?:a|any)\s+)?${width}\b`, "gi");
  const afterBan = new RegExp(String.raw`\b${width}\s+(?:(?:are|is)\s+)?(?:forbidden|prohibited|banned|unwanted|not\s+(?:allowed|permitted|wanted)|(?:isn['’]?t|aren['’]?t)\s+wanted|(?:(?:should|must|shall)\s+(?:be\s+avoided|not\s+be\s+(?:worn|used|chosen|selected))|(?:shouldn|mustn|shan)['’]?t\s+be\s+(?:worn|used|chosen|selected))|to\s+be\s+avoided|not\s+to\s+be\s+(?:worn|used|chosen))\b`, "gi");
  const optional = new RegExp(String.raw`\b(?:(?:optional|maybe|possibly|perhaps)\s+${width}|${width}\s+(?:(?:is|are)\s+)?(?:optional|unnecessary|not\s+(?:required|needed|mandatory)|(?:isn['’]?t|aren['’]?t)\s+(?:required|needed|mandatory)|maybe|possibly|perhaps))\b`, "gi");
  let prohibited = false;
  let remaining = candidateTrouser.replace(beforeBan, () => { prohibited = true; return " "; });
  remaining = remaining.replace(afterBan, () => { prohibited = true; return " "; });
  remaining = remaining.replace(optional, " ");
  const requested = new RegExp(String.raw`\b${width}\b`, "i").test(remaining);
  // "With or without" explicitly leaves the silhouette undecided. It must
  // not be treated as a prohibition merely because "without" is present.
  const alternative = new RegExp(String.raw`\bwith\s+(?:or\s+)?without\s+(?:(?:a|any)\s+)?${width}\b`, "i").test(candidateTrouser);
  if (alternative || (requested && prohibited)) return "ambiguous";
  return requested ? "requested" : prohibited ? "prohibited" : null;
}

/** A positive wide-leg instruction shared by the photo and saved-spec paths. */
export function styleDirectorCandidateWideLeg(candidateTrouser: string): boolean {
  return styleDirectorCandidateWideLegIntent(candidateTrouser) === "requested";
}

/** Only persisted own data IDs may authorize a locked construction. */
function styleDirectorLockedOptionValue(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object") return undefined;
  // Revoked/hostile proxies may throw while exposing an own property.
  // Treat an unreadable locked selection as unverified, never as approval.
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

/** Compare explicit wide-leg requests / prohibitions with locked trouser IDs. */
export function styleDirectorCandidateWideLegIssues(
  candidateTrouser: string,
  pant: Pick<StyleSpecV2["pant"], "type">,
): DirectorConstructionIssue[] {
  const intent = styleDirectorCandidateWideLegIntent(candidateTrouser);
  if (intent === null || intent === "ambiguous") return [];
  const lockedType = styleDirectorLockedOptionValue(pant, "type");
  // An absent or accessor-backed ID cannot prove compliance with a ban.
  if (typeof lockedType !== "string" || !optionsFor("pant.type").some(option => option.id === lockedType)) return [{
    code: "candidate_wide_leg_mismatch",
    explanation: "The saved trouser type is missing or unrecognised; verify the locked silhouette before tailoring.",
  }];
  const isWideLeg = lockedType === "wide_leg_relaxed_drape";
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
  const preBan = new RegExp(String.raw`\b(?:no|without|avoid|never|not|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|add|include|choose|select|wear|have|want)\s+)?(?:(?:a|any|the)\s+)?${token}\b`, "gi");
  const postBan = new RegExp(String.raw`\b${token}(?:[- ]?(?:free|less)|\s+(?:(?:is|are)\s+)?(?:forbidden|prohibited|banned|unwanted|not\s+(?:allowed|permitted|wanted)|(?:isn['’]?t|aren['’]?t)\s+wanted|(?:(?:should|must|shall)\s+(?:be\s+avoided|not\s+be\s+(?:used|added|included|chosen|selected))|(?:shouldn|mustn|shan)['’]?t\s+be\s+(?:used|added|included|chosen|selected))|to\s+be\s+avoided|not\s+to\s+be\s+(?:used|added|included)))\b`, "gi");
  const optional = new RegExp(String.raw`\b${token}\s+(?:(?:is|are)\s+)?(?:optional|unnecessary|not\s+(?:required|mandatory|needed|necessary)|(?:isn['’]?t|aren['’]?t)\s+(?:required|mandatory|needed|necessary)|maybe|possibly|perhaps)\b`, "gi");
  const optionalPrefix = new RegExp(String.raw`\b(?:optional|maybe|possibly|perhaps|unnecessary)\s+${token}\b`, "gi");
  let banned = false;
  let neutral = candidateTrouser.replace(preBan, () => { banned = true; return " "; });
  neutral = neutral.replace(postBan, () => { banned = true; return " "; });
  neutral = neutral.replace(optional, " ").replace(optionalPrefix, " ");
  if (/\bwith\s+(?:or\s+)?without\s+(?:(?:a|any)\s+)?draw[- ]?string\b/i.test(candidateTrouser)) return "ambiguous";
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
  const lockedWaistband = styleDirectorLockedOptionValue(pant, "waistband");
  // A missing, inherited or unsupported ID cannot satisfy a prohibition.
  if (typeof lockedWaistband !== "string" || !optionsFor("pant.waistband").some(option => option.id === lockedWaistband)) return [{
    code: "candidate_waistband_mismatch",
    explanation: "The saved waistband is missing or unrecognised; verify its construction before tailoring.",
  }];
  const isDrawstring = lockedWaistband === "drawstring_elastic";
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
    /\b(?:non[- ]?pleated|unpleated|pleat[- ]?free|pleatless|not\s+(?:a\s+)?pleated|(?:no|without|zero|never|avoid|do\s+not|don['’]?t|(?:do\s+not|don['’]?t|never|avoid|(?:shouldn|mustn)['’]?t)\s+(?:use|add|include|choose|select))\s+(?:(?:a|an|any|visible|front(?:[- ]facing)?|side(?:[- ]facing)?)\s+){0,3}(?:pleats?|pleating|pleated))\b/gi,
    "",
  );
}


// A postposed prohibition of a particular pleat count does not prohibit all
// pleats. Reuse this exact matcher for candidate-front intent, counted
// requirement parsing and verification of a versioned locked pleat ID.
const postposedCountPleatBan = /\b(single|double|one|two|1|2)[ -]?pleat(?:ed|s|ing)?\s+(?:(?:are|is)\s+)?(?:prohibited|forbidden|banned|disallowed|unwanted|not\s+(?:allowed|permitted|wanted)|(?:aren['’]?t|isn['’]?t)\s+wanted|(?:(?:must|should|shall|may)\s+(?:not|never)|(?:mustn|shouldn|shan)['’]?t|cannot|can['’]?t)\s+be\s+(?:used|added|included|chosen|selected)|not\s+to\s+be\s+(?:used|added|included|chosen|selected)|(?:aren['’]?t|isn['’]?t)\s+(?:allowed|permitted)|(?:must|should|shall|(?:are|is)\s+to|to)\s+be\s+avoided)\b/gi;

// A direction-specific ban leaves other pleat directions available; optional
// direction wording is neutral, not permission to change a locked cut.

const postposedDirectionPleatBan = /\b(forward|reverse)[ -]?pleats?\s+(?:(?:are|is)\s+)?(?:prohibited|forbidden|banned|disallowed|unwanted|not\s+(?:allowed|permitted|wanted)|(?:aren['’]?t|isn['’]?t)\s+(?:allowed|permitted|wanted)|(?:(?:must|should|shall|may)\s+(?:not|never)|(?:mustn|shouldn|shan)['’]?t|cannot|can['’]?t)\s+be\s+(?:used|added|included|chosen|selected)|not\s+to\s+be\s+(?:used|added|included|chosen|selected)|(?:must|should|shall|(?:are|is)\s+to|to)\s+be\s+avoided)\b/gi;
const postposedDirectionPleatOptional = /\b(?:forward|reverse)[ -]?pleats?\s+(?:(?:are|is)\s+)?(?:optional|unnecessary|not\s+(?:required|needed|mandatory|necessary)|(?:aren['’]?t|isn['’]?t)\s+(?:required|needed|mandatory|necessary))\b/gi;


// With-or-without and explicit count/direction alternatives remain undecided.
// Neither is permission to choose a front, count or direction on a locked design.
// A separate positive/negative instruction is still checked independently.
const undecidedPleatAlternative = /\b(?:with\s+(?:or\s+)?without\s+(?:(?:a|any)\s+)?(?:(?:single|double|one|two|1|2|forward|reverse)[ -]?)?(?:pleats?|pleating)|(?:single|double|one|two|1|2|forward|reverse)(?:[ -]?pleats?)?\s+or\s+(?:single|double|one|two|1|2|forward|reverse)[ -]?pleats?)\b/gi;

export function styleDirectorCandidateTrouserFront(
  candidateTrouser: string,
): "flat_front" | "pleated" | "ambiguous" | null {
  if (candidateTrouser.match(undecidedPleatAlternative)) return "ambiguous";
  // A direction-specific prohibition is not a ban on all pleats.
  // Interpret front intent without it, but retain the original candidate
  // for the directional conflict checks against the locked option ID.
  const frontWording = candidateTrouser
    .replace(postposedCountPleatBan, "")
    .replace(
      /\b(?:no|without|avoid|never|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|add|include|choose|select)\s+)?(?:forward|reverse)[ -]?pleats?\b/gi,
      "",
    )
    .replace(postposedDirectionPleatBan, "")
    .replace(postposedDirectionPleatOptional, "");
  const flatFront = /\bflat[- ]?front\b/i.test(frontWording);
  const positiveWording = stripNegatedPleatWording(frontWording).replace(
    /\bpleat(?:s|ing)?\s+(?:(?:are|is)\s+)?(?:(?:not\s+(?:allowed|permitted|wanted)|unwanted|prohibited|forbidden|banned|disallowed)|(?:(?:should|must|shall|may)\s+(?:not|never)|cannot|can['’]?t)\s+be\s+(?:used|added|included|chosen|selected)|not\s+to\s+be\s+(?:used|added|included|chosen|selected)|(?:must|should|shall)\s+be\s+omitted|(?:must|should|(?:are|is)\s+to)\s+be\s+avoided|(?:aren['’]?t|isn['’]?t)\s+(?:allowed|permitted|wanted))\b/gi,
    "",
  );
  // Optional pleat language describes a choice, not an instruction to cut pleats.
  // Keep explicit positive instructions elsewhere in the same candidate intact.
  const optionalNeutralWording = positiveWording.replace(
    /\b(?:(?:single|double|one|two|1|2)[ -]?)?(?:pleats?|pleating)\s+(?:(?:are|is)\s+)?(?:optional|unnecessary|not\s+(?:required|necessary|mandatory|needed)|(?:aren['’]?t|isn['’]?t)\s+(?:required|necessary|mandatory|needed)|(?:need\s+not|(?:do|does)\s+not\s+need\s+to)\s+be\s+(?:used|added|included)|(?:may|can|could)\s+be\s+(?:used|added|included|omitted))\b/gi,
    "",
  );
  const explicitlyNoPleats = positiveWording !== frontWording;
  // Negating a particular pleat count does not prohibit all pleats. In
  // particular, "no double pleats" must not become a positive pleat request.
  const unqualifiedPositiveWording = optionalNeutralWording.replace(
    /\b(?:no|without|not|avoid|never|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|add|include|choose|select)\s+)?(?:(?:a|an|any|visible|front(?:[- ]facing)?|side(?:[- ]facing)?)\s+){0,3}(?:single|double|one|two|1|2)[ -]?pleat(?:ed|s|ing)?\b/gi,
    "",
  );
  const positivePleat = /\bpleat(?:ed|s|ing)?\b/i.test(unqualifiedPositiveWording);
  if ((flatFront || explicitlyNoPleats) && positivePleat) return "ambiguous";
  if (positivePleat) return "pleated";
  return flatFront || explicitlyNoPleats ? "flat_front" : null;
}

export type DirectorConstructionIssue = {
  code: "camp_collar_construction" | "band_collar_construction" | "short_sleeve_double_cuff" |
    "pleated_front_missing_pleat" | "flat_front_has_pleat" | "double_pleat_type_mismatch" | "high_rise_type_mismatch" | "side_adjuster_type_mismatch" | "gurkha_tab_waistband_mismatch" | "linen_drawstring_waistband_mismatch" | "cropped_full_break" | "cropped_half_break" | "cropped_slight_break" | "cropped_stacked_break" | "cropped_break_hem_mismatch" | "cropped_type_hem_mismatch" | "cropped_hem_type_mismatch" |
    "formal_camp_collar" | "legacy_wear_mismatch" | "legacy_collar_mismatch" | "unverified_camp_photo" | "unverified_special_collar_photo" |
    "camp_collar_type_mismatch" | "band_collar_type_mismatch" | "short_sleeve_type_mismatch" | "short_sleeve_cuff_review" | "full_sleeve_open_hem_cuff" | "unverified_short_sleeve_photo" | "unverified_roll_up_sleeve_photo" | "unverified_cutaway_photo" |
    "ambiguous_candidate_collar" | "candidate_collar_mismatch" | "ambiguous_candidate_sleeve" | "candidate_sleeve_mismatch" | "ambiguous_candidate_wear" |
    "candidate_shirt_wear_mismatch" | "legacy_trouser_mismatch" |
    "ambiguous_candidate_trouser_front" | "legacy_cuff_mismatch" | "legacy_placket_mismatch" | "legacy_shirt_fit_mismatch" |
    "candidate_trouser_pleat_mismatch" | "unknown_trouser_pleat_option" | "unknown_versioned_option" |
    "candidate_waistband_mismatch" | "ambiguous_candidate_waistband" | "candidate_wide_leg_mismatch" | "ambiguous_candidate_wide_leg" |
    "candidate_placket_mismatch" | "ambiguous_candidate_placket" | "unverified_placket_photo" |
    "candidate_cuff_mismatch" | "ambiguous_candidate_cuff" | "unverified_cuff_photo" |
    "candidate_pocket_mismatch" | "ambiguous_candidate_pocket" | "unverified_pocket_photo" |
    "candidate_collar_finish_mismatch" | "ambiguous_candidate_collar_finish" | "unverified_contrast_finish_photo" |
    "candidate_button_mismatch" | "ambiguous_candidate_button" | "legacy_button_mismatch" |
    "candidate_shirt_fit_mismatch" | "ambiguous_candidate_shirt_fit" | "unverified_shirt_fit_photo" |
    "candidate_trouser_fit_mismatch" | "ambiguous_candidate_trouser_fit" | "unverified_trouser_fit_photo" |
    "wide_leg_tapered_fit_mismatch" | "pleated_fit_flat_front_mismatch" |
    "legacy_rise_mismatch" | "legacy_waistband_mismatch" | "legacy_break_mismatch" |
    "unknown_collar_finish" | "short_sleeve_contrast_cuff_finish";
  explanation: string;
};

/**
 * Conflicting proposed garment names must reach recommendation review.
 * A null resolver alone could otherwise leave default full-sleeve construction
 * looking acceptable despite explicitly contradictory instructions.
 */
export function styleDirectorCandidateWordingIssues(candidateShirt: string, candidateTrouser = ""): DirectorConstructionIssue[] {
  const issues: DirectorConstructionIssue[] = [];
  const collarIntent = candidateCollarIntent(candidateShirt);
  if (collarIntent.ambiguous) {
    issues.push({
      code: "ambiguous_candidate_collar",
      explanation: "This proposed shirt names conflicting collar families; confirm one construction before approving the recommendation.",
    });
  }
  if (styleDirectorCandidateCollarFinishIntent(candidateShirt).ambiguous) {
    issues.push({
      code: "ambiguous_candidate_collar_finish",
      explanation: "This shirt names incompatible collar/contrast finishes; confirm the exact construction and separate cloth before cutting.",
    });
  }
  const fit = styleDirectorCandidateShirtFitIntent(candidateShirt);
  if (fit.ambiguous) {
    issues.push({
      code: "ambiguous_candidate_shirt_fit",
      explanation: "This proposed shirt requests incompatible fits; select one canonical fit before production.",
    });
  }
  if (styleDirectorCandidateButtonIntent(candidateShirt).ambiguous) {
    issues.push({
      code: "ambiguous_candidate_button",
      explanation: "This shirt requests incompatible button materials; select one confirmed material before approving the design.",
    });
  }
  const cuff = styleDirectorCandidateCuffIntent(candidateShirt);
  if (cuff.ambiguous) {
    issues.push({
      code: "ambiguous_candidate_cuff",
      explanation: "This proposed shirt names conflicting cuff constructions; confirm one cuff before production.",
    });
  }
  const placket = styleDirectorCandidatePlacketIntent(candidateShirt);
  if (placket.ambiguous) {
    issues.push({
      code: "ambiguous_candidate_placket",
      explanation: "This proposed shirt gives conflicting placket constructions; choose a single front before approval.",
    });
  }
  if (styleDirectorCandidatePocketIntent(candidateShirt).ambiguous) {
    issues.push({
      code: "ambiguous_candidate_pocket",
      explanation: "This proposed shirt requests incompatible pocket constructions; confirm no pocket, a patch pocket or a flap pocket before cutting.",
    });
  }
  const sleeves = candidateSleeveLengths(candidateShirt);
  const rollUp = styleDirectorCandidateRollUpSleeveIntent(candidateShirt);
  if (rollUp.ambiguous || sleeves.undecided || (sleeves.short && sleeves.long) ||
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
  if (styleDirectorCandidateTrouserFitIntent(candidateTrouser).ambiguous) {
    issues.push({
      code: "ambiguous_candidate_trouser_fit",
      explanation: "This proposed trouser names conflicting fit constructions; select one fit before cutting.",
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
  // Ignore undecided alternatives when validating independently mandatory or
  // forbidden pleats; otherwise "without double pleats" looks like a ban.
  const explicitWording = candidateTrouser.replace(undecidedPleatAlternative, "");
  // A labelled double pleat is not equivalent to a generic single pleat.
  // Read count from the canonical option's construction parameters instead
  // of inferring it from the potentially stale photographed trouser label.
  const positiveWording = stripNegatedPleatWording(explicitWording)
    .replace(postposedCountPleatBan, "")
    .replace(postposedDirectionPleatBan, "")
    .replace(postposedDirectionPleatOptional, "")
    .replace(
    /\b(?:no|without|not|avoid|never|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|add|include|choose|select)\s+)?(?:(?:a|an|any|visible|front(?:[- ]facing)?|side(?:[- ]facing)?)\s+){0,3}(?:single|double|one|two|1|2)[ -]?pleat(?:ed|s|ing)?\b/gi,
    "",
  );
  // Optional counts do not constrain a separately requested pleat.
  // Reuse the candidate-front neutralisation so "double pleats may be
  // added; single pleat required" checks only the mandatory single pleat.
  const requiredWording = positiveWording.replace(
    /\b(?:(?:single|double|one|two|1|2)[ -]?)?(?:pleats?|pleating)\s+(?:(?:are|is)\s+)?(?:optional|unnecessary|not\s+(?:required|necessary|mandatory|needed)|(?:aren['’]?t|isn['’]?t)\s+(?:required|necessary|mandatory|needed)|(?:need\s+not|(?:do|does)\s+not\s+need\s+to)\s+be\s+(?:used|added|included)|(?:may|can|could)\s+be\s+(?:used|added|included|omitted))\b/gi,
    "",
  );
  const requestsDouble = /\b(?:double|two|2)[ -]?pleats?\b/i.test(requiredWording);
  const requestsSingle = /\b(?:single|one|1)[ -]?pleats?\b/i.test(requiredWording);
  const expectedCount = front === "pleated"
    ? requestsDouble && !requestsSingle ? 2
      : requestsSingle && !requestsDouble ? 1 : null
    : null;
  // An inherited or getter-backed pleat selection cannot certify a front, count, or direction.
  const lockedPleat = styleDirectorLockedOptionValue(pant, "pleat");
  const pleatOption = optionsFor("pant.pleat").find(option => option.id === lockedPleat);
  const declaredCount = pleatOption?.parameters.pleatCount;
  // A ban on a specific count is not a blanket no-pleat instruction.
  // Preserve an allowed single/double/flat-front choice, but never silently
  // approve the forbidden canonical count (or an ID whose count is unknown).
  const prohibitedCountLabels = [
    ...[...explicitWording.matchAll(
      /\b(?:no|without|not|avoid|never|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|add|include|choose|select)\s+)?(?:(?:a|an|any|visible|front(?:[- ]facing)?|side(?:[- ]facing)?)\s+){0,3}(single|double|one|two|1|2)[ -]?pleat(?:ed|s|ing)?\b/gi,
    )].map(match => match[1].toLowerCase()),
    ...[...explicitWording.matchAll(postposedCountPleatBan)].map(match => match[1].toLowerCase()),
  ];
  const prohibitsSingleCount = prohibitedCountLabels.some(value => ["single", "one", "1"].includes(value));
  const prohibitsDoubleCount = prohibitedCountLabels.some(value => ["double", "two", "2"].includes(value));
  const hasCountBan = prohibitsSingleCount || prohibitsDoubleCount;
  // The option catalogue also distinguishes forward/reverse pleat direction.
  // Do not silently substitute one for the other in tailoring instructions.
  // A prohibited direction is not a requested direction. Preserve positive
  // direction instructions elsewhere (e.g. "no reverse pleats; forward pleats").
  const directionWording = positiveWording.replace(
    /\b(?:no|without|avoid|never|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|add|include|choose|select)\s+)?(?:forward|reverse)[ -]?pleats?\b/gi,
    "",
  ).replace(postposedDirectionPleatBan, "");
  const requestsForward = front === "pleated" && /\bforward\b/i.test(directionWording);
  const requestsReverse = front === "pleated" && /\breverse\b/i.test(directionWording);
  const expectedDirection = requestsForward !== requestsReverse
    ? requestsForward ? "forward" : "reverse" : null;
  const declaredDirection = pleatOption?.parameters.pleatDirection;
  // A negative direction instruction constrains the selected pleat even
  // when no alternative direction is explicitly requested. Do not treat
  // "avoid reverse pleats" as a blanket ban on all pleated construction.
  const prohibitsForward = /\b(?:no|without|avoid|never|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|add|include|choose|select)\s+)?forward[ -]?pleats?\b/i.test(explicitWording);
  const prohibitsReverse = /\b(?:no|without|avoid|never|do\s+not|don['’]?t|(?:shouldn|mustn)['’]?t)\s+(?:(?:use|add|include|choose|select)\s+)?reverse[ -]?pleats?\b/i.test(explicitWording);
  // Direction prohibitions can follow the noun as well as precede it.
  const prohibitedDirections = [...explicitWording.matchAll(postposedDirectionPleatBan)]
    .map(match => match[1].toLowerCase());
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
      (front === "pleated" && lockedPleat === "flat_front") ||
      (front === "flat_front" && lockedPleat !== "flat_front") ||
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
 * Only unambiguous cross-field trouser contradictions require review.
 * Tapered leg fits cannot describe the same locked wide-leg drape, and the
 * "Pleated Straight" fit cannot promise pleats alongside a flat-front ID.
 * Other fit/type pairings remain possible, including wide-leg pleated
 * trousers, loose flat-front trousers and tapered cropped silhouettes.
 * Never infer physical circumferences or silently replace locked IDs.
 */
export function styleDirectorSilhouetteFitIssues(
  pant: Pick<StyleSpecV2["pant"], "type" | "fit" | "pleat">,
): DirectorConstructionIssue[] {
  const issues: DirectorConstructionIssue[] = [];
  // Cross-field contradictions require proven own-data option IDs. A getter,
  // inherited field or hostile proxy cannot supply evidence of a leg shape.
  // Missing/stale selections have separate versioned-option review gates.
  const type = styleDirectorLockedOptionValue(pant, "type");
  const fit = styleDirectorLockedOptionValue(pant, "fit");
  const pleat = styleDirectorLockedOptionValue(pant, "pleat");
  if (type === "wide_leg_relaxed_drape" &&
      (fit === "slim_tapered" || fit === "regular_tapered" ||
       fit === "korean_tapered")) {
    issues.push({
      code: "wide_leg_tapered_fit_mismatch",
      explanation: "The locked trouser claims a wide-leg drape but specifies a tapered fit; confirm the intended leg shape before tailoring.",
    });
  }
  if (fit === "pleated_straight" && pleat === "flat_front") {
    issues.push({
      code: "pleated_fit_flat_front_mismatch",
      explanation: "The locked trouser specifies a Pleated Straight fit with a flat-front pleat ID; confirm the actual front construction.",
    });
  }
  return issues;
}

/**
 * Repair only the *newly proposed* legacy-to-versioned crop conversion when
 * two independent, canonical legacy selections already agree on above-ankle
 * construction. Never invoke this on an existing saved/locked design; a
 * disagreeing type/break must remain reviewable rather than being rewritten.
 */
export function styleDirectorProposedCroppedHem(
  pant: Pick<StyleSpecV2["pant"], "type" | "break">,
): "cropped_above_ankle_hem" | null {
  // A saved candidate may contain inherited or accessor-backed fields.
  // Only own data properties can authorize a construction suggestion.
  const type = styleDirectorLockedOptionValue(pant, "type");
  const shoeBreak = styleDirectorLockedOptionValue(pant, "break");
  return type === "cropped_ankle" && shoeBreak === "cropped_above_ankle"
    ? "cropped_above_ankle_hem" : null;
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
      ((["tucked", "untucked"].includes(shirt.wear) && shirt.wear !== "untucked") ||
       (optionsFor("shirt.collar").some(option => option.id === shirt.collar) &&
        shirt.collar !== "cuban_camp_collar"))) {
    issues.push({
      code: "camp_collar_construction",
      explanation: "The proposed camp-collar resort shirt needs an untucked, open camp-collar construction review.",
    });
  }
  if (shirt.collar === "cuban_camp_collar" &&
      optionsFor("shirt.type").some(option => option.id === shirt.type) &&
      shirt.type !== "camp_collar_resort") {
    issues.push({
      code: "camp_collar_type_mismatch",
      explanation: "The selected Cuban/Camp collar is paired with a different shirt type; confirm the intended open-collar construction before cutting.",
    });
  }
  if (shirt.type === "band_collar_shirt" &&
      optionsFor("shirt.collar").some(option => option.id === shirt.collar) &&
      shirt.collar !== "mandarin_band_collar") {
    issues.push({
      code: "band_collar_construction",
      explanation: "The proposed band-collar shirt type has a different collar construction; confirm the canonical collar before cutting.",
    });
  }
  if (shirt.collar === "mandarin_band_collar" &&
      optionsFor("shirt.type").some(option => option.id === shirt.type) &&
      shirt.type !== "band_collar_shirt") {
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
  // The collar/contrast finish is an independent construction field rather
  // than a normal option-group ID. Review unknown historical/forged values
  // without modifying an existing locked design.
  if (shirt.collarFinish !== undefined &&
      !["Self-fabric", "White contrast collar", "White contrast collar + cuffs"].includes(shirt.collarFinish)) {
    issues.push({
      code: "unknown_collar_finish",
      explanation: "The saved collar/contrast finish is not part of the supported construction vocabulary; confirm the requested material placement.",
    });
  }
  // The open short-sleeve hem is not a separate cuff construction. A
  // documented white collar + cuffs finish cannot be certified when the
  // locked sleeve explicitly ends in that open hem. Review, never silently
  // substitute a cuff or an unverified contrast fabric.
  if (shirt.sleeve === "half_sleeve" && shirt.cuff === "open_short_hem_cuff" &&
      shirt.collarFinish === "White contrast collar + cuffs") {
    issues.push({
      code: "short_sleeve_contrast_cuff_finish",
      explanation: "A short-sleeve open hem cannot certify the selected white contrast cuff finish; confirm the actual sleeve-end construction and fabric before cutting.",
    });
  }
  if (shirt.sleeve === "half_sleeve" && shirt.cuff === "french_double_cuff") {
    issues.push({
      code: "short_sleeve_double_cuff",
      explanation: "A short-sleeve shirt cannot use the proposed full-length French double-cuff construction.",
    });
  }
  if (shirt.type === "short_sleeve_shirt" &&
      ["full_sleeve", "roll_up_styled"].includes(shirt.sleeve)) {
    issues.push({
      code: "short_sleeve_type_mismatch",
      explanation: "The selected short-sleeve shirt type still specifies a full-length sleeve; confirm the actual sleeve before production.",
    });
  }
  if (shirt.sleeve === "half_sleeve" &&
      shirt.cuff !== "open_short_hem_cuff" &&
      optionsFor("shirt.cuff").some(option => option.id === shirt.cuff)) {
    issues.push({
      code: "short_sleeve_cuff_review",
      explanation: "The proposed half-sleeve uses a full-length cuff option; confirm a buildable short-sleeve finish.",
    });
  }
  if (["full_sleeve", "roll_up_styled"].includes(shirt.sleeve) &&
      shirt.cuff === "open_short_hem_cuff") {
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
  // The named High-Rise Double-Pleat Trouser is a canonical garment type,
  // not permission to silently replace its saved pleat construction.
  // Trust the catalogue's declared pleat count; a stale/unknown ID is
  // separately flagged above and must not be invented into a real pleat.
  if (pant.type === "double_pleat_high_rise" &&
      optionsFor("pant.pleat").some(option =>
        option.id === pant.pleat && option.parameters.pleatCount !== 2)) {
    issues.push({
      code: "double_pleat_type_mismatch",
      explanation: "The selected high-rise double-pleat trouser type does not have a matching two-pleat construction; confirm the locked front before cutting.",
    });
  }
  // The reference high-rise double-pleat type requires a high or
  // extra-high rise selection. Check only real catalogue IDs: unknown and
  // historical values already have their own review gate above. Never
  // rewrite a customer's saved rise or infer physical waist placement.
  if (pant.type === "double_pleat_high_rise" &&
      optionsFor("pant.rise").some(option => option.id === pant.rise) &&
      pant.rise !== "high_rise" && pant.rise !== "extra_high_rise") {
    issues.push({
      code: "high_rise_type_mismatch",
      explanation: "The selected high-rise double-pleat trouser type uses a lower-rise option; confirm the locked waistband position before cutting.",
    });
  }
  // A bespoke side-adjuster trouser must retain an actual side-adjuster
  // waistband. Both the legacy tabs and newer beltless adjuster tabs are
  // canonical; other known waistband options require review, not replacement.
  // Unknown IDs already have their own versioned-option review above.
  if (pant.type === "bespoke_side_adjuster" &&
      optionsFor("pant.waistband").some(option => option.id === pant.waistband) &&
      pant.waistband !== "side_adjuster_tabs" &&
      pant.waistband !== "adjuster_tabs_no_belt") {
    issues.push({
      code: "side_adjuster_type_mismatch",
      explanation: "The selected bespoke side-adjuster trouser has a waistband without the named side-adjuster construction; confirm the saved waistband before cutting.",
    });
  }
  // The catalogued Gurkha-style trouser preset specifies an extended
  // front-tab waistband. Other recognized waistband constructions cannot
  // prove that named feature; review them without replacing saved option IDs.
  // Unknown values remain handled by the existing versioned-ID check.
  if (pant.type === "gurkha" &&
      optionsFor("pant.waistband").some(option => option.id === pant.waistband) &&
      pant.waistband !== "extended_tab") {
    issues.push({
      code: "gurkha_tab_waistband_mismatch",
      explanation: "The named Gurkha-style trouser has no extended front-tab waistband in its locked options; confirm this construction before cutting.",
    });
  }
  // The named linen drawstring trouser must retain its waist construction.
  // Do not silently rewrite saved garment IDs; unknown IDs have their own gate.
  if (pant.type === "linen_drawstring" &&
      optionsFor("pant.waistband").some(option => option.id === pant.waistband) &&
      pant.waistband !== "drawstring_elastic") {
    issues.push({
      code: "linen_drawstring_waistband_mismatch",
      explanation: "The named linen drawstring trouser lacks a drawstring waistband in its locked selections; confirm the construction before cutting.",
    });
  }
  if (pant.type === "formal_flat_front" &&
      optionsFor("pant.pleat").some(option => option.id === pant.pleat) &&
      pant.pleat !== "flat_front") {
    issues.push({
      code: "flat_front_has_pleat",
      explanation: "The proposed flat-front trouser includes pleats; confirm the actual front construction.",
    });
  }
  issues.push(...styleDirectorSilhouetteFitIssues(pant));
  // Hem length and trouser silhouette are independent: a flat-front or
  // pleated trouser may legitimately be finished above the ankle. The
  // explicit shoe-break compatibility checks below enforce length parity.
  if (pant.type === "cropped_ankle" &&
      optionsFor("pant.hem").some(option => option.id === pant.hem) &&
      pant.hem !== "cropped_above_ankle_hem") {
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
  if (pant.break === "cropped_above_ankle" &&
      optionsFor("pant.hem").some(option => option.id === pant.hem) &&
      pant.hem !== "cropped_above_ankle_hem") {
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
  style: Pick<DesignerStyle, "collar" | "shirtWear"> & Partial<Pick<DesignerStyle, "trouser" | "cuff" | "placket" | "shirtFit" | "button" | "rise" | "waistband" | "break">>,
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
  // A matching label for a provisional cuff does not prove its live
  // photographic construction. A short-sleeve open hem already has a
  // dedicated preview warning and must not produce redundant review.
  const lockedCuff = optionsFor("shirt.cuff").find(option => option.id === spec.shirt.cuff);
  if (spec.shirt.cuff !== "open_short_hem_cuff" &&
      lockedCuff && (lockedCuff.renderSupport.livePreview === "none" ||
        lockedCuff.legacySelectable === false)) {
    issues.push({
      code: "unverified_cuff_photo",
      explanation: "The selected cuff has no supported live photographic shape; its canonical construction needs a visual and tailor review.",
    });
  }
  // A matching text label cannot certify a non-renderable or contrast
  // placket's photographic correctness or unverified accent-fabric truth.
  const lockedPlacket = optionsFor("shirt.placket").find(option => option.id === spec.shirt.placket);
  if (lockedPlacket && (lockedPlacket.renderSupport.livePreview === "none" ||
      lockedPlacket.legacySelectable === false)) {
    issues.push({
      code: "unverified_placket_photo",
      explanation: "This placket construction has no approved live photographic proof; contrast fabrics and production details still require operator review.",
    });
  }
  // The reference has an approximate fit selector; newer body-fit IDs
  // without a live preview must remain review-only, even when a photo's
  // default fit label looks similar. No physical ease is inferred here.
  const lockedFit = optionsFor("shirt.fit").find(option => option.id === spec.shirt.fit);
  if (lockedFit && (lockedFit.renderSupport.livePreview === "none" ||
      lockedFit.legacySelectable === false)) {
    issues.push({
      code: "unverified_shirt_fit_photo",
      explanation: "This canonical shirt fit lacks a supported live photographic shape; confirm fit and measured ease with a tailor.",
    });
  }
  // A white contrast label does not certify a physical second cloth or an
  // accurately rendered collar/cuff replacement. It remains review-only.
  if (spec.shirt.collarFinish === "White contrast collar" ||
      spec.shirt.collarFinish === "White contrast collar + cuffs") {
    issues.push({
      code: "unverified_contrast_finish_photo",
      explanation: "The white contrast collar/cuff treatment needs actual cloth verification and photographic confirmation before approval.",
    });
  }
  // DesignerStyle has no pocket selector; named patch/flap construction
  // remains a real locked spec but is never asserted to appear in the photo.
  const pocketOption = optionsFor("shirt.pocket").find(option => option.id === spec.shirt.pocket);
  if (spec.shirt.pocket !== "no_pocket" && pocketOption) {
    issues.push({
      code: "unverified_pocket_photo",
      explanation: "The versioned shirt includes a patch or flap pocket, but the live photographic style cannot verify pocket placement or construction.",
    });
  }
  // Photo labels must not silently certify a different cuff, placket or fit.
  // Use only the canonical selectable option library, not display heuristics.
  const photoShirtDetails = [
    { key: "cuff", group: "shirt.cuff", id: spec.shirt.cuff, code: "legacy_cuff_mismatch" },
    { key: "placket", group: "shirt.placket", id: spec.shirt.placket, code: "legacy_placket_mismatch" },
    { key: "shirtFit", group: "shirt.fit", id: spec.shirt.fit, code: "legacy_shirt_fit_mismatch" },
    { key: "button", group: "shirt.button", id: spec.shirt.button, code: "legacy_button_mismatch" },
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
  if (spec.shirt.sleeve === "roll_up_styled") {
    // A rolled full sleeve has its own canonical ID, but no corresponding
    // legacy photographic selector. Styling intent is not visual evidence.
    issues.push({
      code: "unverified_roll_up_sleeve_photo",
      explanation: "Roll-up Styled is saved as a distinct sleeve construction, but the current photographic preview cannot verify the rolled shape.",
    });
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
  // Contradictory explicit wear instructions cannot certify either locked
  // construction. Neutral/optional wording alone remains unconstrained.
  if (requested.tucked && requested.untucked) return [{
    code: "candidate_shirt_wear_mismatch",
    explanation: "The proposed shirt contains conflicting tucked and untucked instructions; clarify the construction before tailoring.",
  }];
  if (!requested.tucked && !requested.untucked) return [];
  const expected = requested.tucked ? "tucked" : "untucked";
  const lockedWear = styleDirectorLockedOptionValue(shirt, "wear");
  // A stale, inherited or unreadable saved wear field cannot certify
  // the explicit tucked/untucked cutting instruction.
  return lockedWear === expected ? [] : [{
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
