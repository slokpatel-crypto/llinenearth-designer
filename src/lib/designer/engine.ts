import { FABRIC_STOCK, type FabricColorway } from "../fabric-stock.ts";
import reference from "./reference-data.json";
import { optionsFor } from "./options/library.ts";
import { fromLegacyStyle } from "./style-spec-v2.ts";
import { evaluateCrossGarmentRules } from "./rules/evaluator.ts";

export type OccasionTier = "Casual" | "Smart-Casual" | "Semi-Formal" | "Formal";
export type RuleStatus = "pass" | "flag" | "unknown" | "not_applicable";
export type RuleSeverity = "High" | "Medium" | "Low";
export type DesignerClimate = "Not specified" | "Hot / humid" | "Cool" | "Air-conditioned";
export type DesignerIntention = "Understated" | "Balanced" | "Expressive";
export type DesignerContext = { climate: DesignerClimate; intention: DesignerIntention };
export const DEFAULT_DESIGNER_CONTEXT: DesignerContext = { climate: "Not specified", intention: "Balanced" };

export interface DesignerFabric {
  id: string;
  name: string;
  line: string;
  image: string;
  hex: string;
  colorFamily: string | null;
  tone: "Light" | "Medium" | "Dark" | null;
  formalityScore: number | null;
  patternType: string;
  patternScale: "None" | "Fine" | "Medium" | "Medium-Bold" | "Bold" | null;
  renderScale?: {
    physicalScaleStatus:"declared_repeat"|"declared_swatch_width"|"unknown";
    repeatMm:number|null;
    stripeWidthMm:number|null;
  } | null;
  weightGsm: number | null;
  weightClass: "Light" | "Medium" | "Heavy" | null;
  bestSeason: string[] | null;
  roleTags: Array<"base_safe" | "accent_safe"> | null;
  weave: string | null;
  texture: string | null;
  fiberContent: string | null;
  confirmedAvailableMetres: number | null;
  availabilityVerified?: boolean;
  // Only set these after checking the physical roll or a documented supplier measurement.
  colorVerified?: boolean;
  patternScaleVerified?: boolean;
  fiberContentVerified?: boolean;
  drape?: "Fluid" | "Balanced" | "Structured" | null;
  opacity?: "Sheer" | "Semi-sheer" | "Opaque" | null;
  comfortTags?: Exclude<DesignerClimate, "Not specified">[] | null;
  source: string;
  allowedGarments: Array<"shirt" | "pant">;
}

export interface DesignerRuleResult {
  id: string;
  severity: RuleSeverity;
  status: RuleStatus;
  explanation: string;
}

export interface DesignerRecommendation {
  shirt: DesignerFabric;
  pant: DesignerFabric;
  occasion: OccasionTier;
  style: {
    collar: string;
    collarFinish: string;
    cuff: string;
    placket: string;
    shirtFit: string;
    shirtWear: string;
    trouser: string;
    rise: string;
    waistband: string;
    break: string;
    button: string;
  };
  accent?: { garment: "shirt" | "pant"; fabricId: string; placement: DesignerAccent["placement"] };
  confidenceScore: number;
  designFitScore: number;
  materialEvidence: { verified: number; total: number; missing: string[] };
  context: DesignerContext;
  formality: { shirt: number | null; pant: number | null; delta: number | null; band: [number, number]; match: boolean | null };
  status: "preliminary" | "needs_review";
  shortReason: string;
  internalReason: string;
  rules: DesignerRuleResult[];
  confirmationsNeeded: string[];
  ruleSetVersion: string;
}

export type DesignerStyle = DesignerRecommendation["style"];
export type DesignerStyleOverrides = Partial<DesignerStyle>;
export type DesignerAccent = {
  garment: "shirt" | "pant";
  fabric: DesignerFabric;
  placement: "collar" | "cuff" | "placket" | "pocket" | "waistband";
};

/**
 * The user confirmed there is no separate five-sheet styling reference named
 * in the original brief. The supplied 13-sheet datasheet is the working source;
 * its weights, presets and wording remain provisional until Linen Earth
 * approves them against real cloth.
 */
export const DESIGNER_RULE_SET_VERSION = "shirt-pant-reference-provisional-6";

// Owner approved the visual pairing for Semi-Formal use on 2026-09-27.
// This approves neither physical availability nor the proposed garment details.
export const DESIGNER_REVIEWED_PAIRING = {
  occasion: "Semi-Formal" as const,
  shirtId: "linen-plain-60-sky-blue",
  pantId: "linen-suiting-beige",
  approval: "pairing_taste_only" as const,
};

// A taste-approved colour direction can help an uncertain customer decide
// what to discuss in store. It cannot be called a stocked or safe fallback
// until the owner checks the actual rolls and approves the finished cut.
export function designerTasteAlternative(recommendation: DesignerRecommendation) {
  if (recommendation.status !== "needs_review" || recommendation.occasion !== DESIGNER_REVIEWED_PAIRING.occasion
    || (recommendation.shirt.id === DESIGNER_REVIEWED_PAIRING.shirtId
      && recommendation.pant.id === DESIGNER_REVIEWED_PAIRING.pantId)) return null;
  return DESIGNER_REVIEWED_PAIRING;
}

type NamedScore = { Formality_Score?: number; [key: string]: unknown };
const sheets = reference.sheets;
const collars = sheets.Shirt_Collar as NamedScore[];
const cuffs = sheets.Shirt_Cuff as NamedScore[];
const trousers = sheets.Pant_Trouser_Types as NamedScore[];
const colors = sheets.Color_Palette as NamedScore[];
const patterns = sheets.Pattern_Types as NamedScore[];
const buttons = sheets.Button_Types as NamedScore[];
const details = sheets.Shirt_Placket_Pocket_Fit as NamedScore[];
const pantDetails = sheets.Pant_Rise_Waistband_Break as NamedScore[];
const bands = sheets.Occasion_Formality_Bands as Array<{ Occasion_Tier: string; Score_Band: string }>;

const PRESETS: Record<OccasionTier, DesignerRecommendation["style"]> = {
  Casual: {
    collar: "Button-Down Collar", collarFinish: "Self-fabric", cuff: "Barrel Cuff (1-button)", placket: "Standard (visible stitch)",
    shirtWear: "Untucked",
    shirtFit: "Regular / Classic Fit", trouser: "Wide-leg / Relaxed Drape Trouser",
    rise: "Mid Rise", waistband: "Belt Loops", break: "No Break", button: "Plastic / Resin",
  },
  "Smart-Casual": {
    collar: "Point (Standard) Collar", collarFinish: "Self-fabric", cuff: "Barrel Cuff (1-button)", placket: "Standard (visible stitch)",
    shirtWear: "Untucked",
    shirtFit: "Regular / Classic Fit", trouser: "Cropped / Ankle-length Trouser",
    rise: "Mid Rise", waistband: "Belt Loops", break: "Cropped / Above-ankle", button: "Plastic / Resin",
  },
  "Semi-Formal": {
    collar: "Point (Standard) Collar", collarFinish: "Self-fabric", cuff: "Barrel Cuff (2-button)", placket: "Standard (visible stitch)",
    shirtWear: "Tucked",
    shirtFit: "Regular / Classic Fit", trouser: "Pleated Trouser",
    rise: "Mid Rise", waistband: "Side-Adjuster Tabs", break: "Slight Break", button: "Corozo (vegetable ivory)",
  },
  Formal: {
    collar: "Spread Collar", collarFinish: "Self-fabric", cuff: "French / Double Cuff", placket: "Hidden / Fly-front",
    shirtWear: "Tucked",
    shirtFit: "Regular / Classic Fit", trouser: "Formal Trouser (Flat-front)",
    rise: "High Rise", waistband: "Side-Adjuster Tabs", break: "Slight Break", button: "Mother-of-Pearl",
  },
};

const names = (rows: NamedScore[], key: string) => rows.map((row) => String(row[key]));

function optionLabels(group:Parameters<typeof optionsFor>[0],legacyOnly=false) {
  return optionsFor(group)
    .filter((option)=>option.legacySelectable!==false && (!legacyOnly || Boolean(option.legacyLabel)))
    .map((option)=>option.legacyLabel || option.label);
}

// Existing labels stay byte-for-byte stable, while the selectable library can
// add new provisional construction options without editing this engine again.
// Contrast plackets remain withheld because they require a verified accent cloth.
export const DESIGNER_STYLE_CHOICES: Record<keyof DesignerStyle, string[]> = {
  collar: optionLabels("shirt.collar"),
  collarFinish: ["Self-fabric", "White contrast collar", "White contrast collar + cuffs"],
  cuff: optionLabels("shirt.cuff"),
  placket: optionLabels("shirt.placket").filter((option)=>option!=="Contrast Placket"),
  shirtFit: optionLabels("shirt.fit"),
  shirtWear: ["Untucked", "Tucked"],
  trouser: optionLabels("pant.type",true),
  rise: optionLabels("pant.rise"),
  waistband: optionLabels("pant.waistband"),
  break: optionLabels("pant.break"),
  button: optionLabels("shirt.button",true),
};

export function designerStyleForOccasion(occasion: OccasionTier): DesignerStyle {
  const preset = PRESETS[occasion];
  if (!preset) throw new Error("Choose a supported occasion.");
  return { ...preset };
}

function resolveStyle(occasion: OccasionTier, overrides?: DesignerStyleOverrides): DesignerStyle {
  const style = designerStyleForOccasion(occasion);
  for (const [key, value] of Object.entries(overrides || {})) {
    if (!Object.hasOwn(DESIGNER_STYLE_CHOICES, key) || typeof value !== "string"
      || !DESIGNER_STYLE_CHOICES[key as keyof DesignerStyle].includes(value)) {
      throw new Error("Choose a tailoring detail from the Linen Earth reference.");
    }
    style[key as keyof DesignerStyle] = value;
  }
  return style;
}

function score(rows: NamedScore[], key: string, value: string): number | null {
  return rows.find((row) => row[key] === value)?.Formality_Score ?? null;
}

function optionFormality(group:Parameters<typeof optionsFor>[0],label:string) {
  const option=optionsFor(group).find((item)=>(item.legacyLabel||item.label)===label);
  return option?.formality ?? null;
}

function average(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
}

function occasionBand(occasion: OccasionTier): [number, number] {
  const raw = bands.find((row) => row.Occasion_Tier === occasion)?.Score_Band || "";
  const parts = raw.match(/[\d.]+/g)?.map(Number) || [];
  if (parts.length !== 2 || parts.some((value) => !Number.isFinite(value))) throw new Error("The occasion band needs review.");
  return [parts[0], parts[1]];
}

function namedColor(name: string): NamedScore | undefined {
  const normal = (value: string) => value.toLowerCase().replace(/[-\s]+/g, "").trim();
  const text = normal(name === "Khakhi" ? "Khaki" : name);
  return colors.find((color) => String(color.Color_Name).split(" / ").some((part) => text === normal(part) || (text.startsWith(normal(part)) && normal(part).length >= 5)));
}

function visualTone(hex: string): DesignerFabric["tone"] {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  if (channels.some((channel) => Number.isNaN(channel))) return null;
  const lightness = (Math.max(...channels) + Math.min(...channels)) / 2;
  return lightness < 94 ? "Dark" : lightness > 169 ? "Light" : "Medium";
}

function catalogueStyleFormality(fabric:FabricColorway) {
  const line=fabric.line.toLowerCase();
  const pattern=fabric.pattern.toLowerCase();
  // This is a styling taxonomy from the catalogue role, not a physical cloth
  // measurement. Verified operator formality metadata still takes priority.
  if(line.includes("formal shirting")) {
    if(/pinstripe|fine stripe|stripe/.test(pattern)) return 4.15;
    if(/windowpane|check/.test(pattern)) return 3.75;
    return 4;
  }
  if(line.includes("linen suiting")) {
    const name=fabric.colorName.toLowerCase();
    if(/dark grey|charcoal|slate|platinum/.test(name)) return 4.05;
    if(/beige|taupe|cream|chambray|denim blue/.test(name)) return 3.55;
    return 3.15;
  }
  if(line.includes("linen plain")) {
    if(/jute feel/.test(pattern) || /saffron|dijon|light green/.test(fabric.colorName.toLowerCase())) return 1.9;
    return 2.55;
  }
  if(line.includes("printed linen blend")) return /micro|tonal/.test(pattern) ? 2.15 : 1.75;
  if(line.includes("linen print")) return /micro|fine/.test(pattern) ? 2.05 : 1.65;
  return null;
}

function patternProfile(pattern: string): { name: string; scale: DesignerFabric["patternScale"] } {
  const label = pattern.toLowerCase();
  if (/^plain$|^solid$|plain\s*\/\s*jute/.test(label)) return { name: "Solid", scale: "None" };
  if (/floral|botanical|leaf/.test(label)) return { name: "Floral Print", scale: /micro|fine/.test(label) ? "Fine" : null };
  if (/geometric|mosaic|block|chevron|abstract/.test(label)) return { name: "Geometric / Fusion Print", scale: null };
  if (/micro|fine|pinstripe/.test(label)) return { name: /check/.test(label) ? "Gingham Check" : "Pin Stripe", scale: "Fine" };
  if (/windowpane/.test(label)) return { name: "Windowpane Check", scale: "Medium" };
  if (/stripe/.test(label)) return { name: "Candy Stripe", scale: "Medium" };
  return { name: pattern, scale: null };
}

export function designerFabricFromStock(fabric: FabricColorway): DesignerFabric {
  const palette = namedColor(fabric.colorName);
  const pattern = patternProfile(fabric.pattern);
  const drape: DesignerFabric["drape"] = fabric.drape === "structured" ? "Structured"
    : fabric.drape === "medium" ? "Balanced"
      : fabric.drape === "fluid" || fabric.drape === "soft" ? "Fluid" : null;
  return {
    id: fabric.id, name: fabric.colorName, line: fabric.line, image: fabric.swatchImageUrl, hex: fabric.hex,
    colorFamily: palette ? String(palette.Color_Family) : null,
    tone: palette && ["Light", "Medium", "Dark"].includes(String(palette.Tone))
      ? palette.Tone as DesignerFabric["tone"] : visualTone(fabric.hex),
    formalityScore: typeof fabric.formalityScore === "number" ? fabric.formalityScore
      : catalogueStyleFormality(fabric) ?? (typeof palette?.Formality_Score === "number" ? palette.Formality_Score : null),
    patternType: pattern.name, patternScale: pattern.scale,
    // A Lea label describes yarn count. Verified GSM/weight/season fields only arrive from the operator calibration ledger.
    weightGsm: typeof fabric.weightGsm === "number" ? fabric.weightGsm : null,
    weightClass: fabric.weightClass ?? null,
    bestSeason: fabric.seasonTags?.length ? [...fabric.seasonTags] : null,
    roleTags: fabric.roleTags?.length ? [...fabric.roleTags] : null,
    weave: fabric.weave || (fabric.line === "Linen Plain 60 Lea" ? "Plain Weave" : null),
    texture: fabric.texture || null,
    fiberContent: fabric.line.includes("Blend") ? null : fabric.family,
    confirmedAvailableMetres: null, availabilityVerified:fabric.availabilityVerified===true, colorVerified: false, patternScaleVerified: false,
    fiberContentVerified: false, drape, opacity: null, comfortTags: null,
    source: `${fabric.sourceDocument}, page ${fabric.sourcePage}`,
    allowedGarments: [
      ...(fabric.suitableFor.includes("shirt") ? ["shirt" as const] : []),
      ...(fabric.suitableFor.includes("trouser") ? ["pant" as const] : []),
    ],
  };
}

// Only catalogued fabrics enter customer recommendations. The 91 imported
// website gallery images are flagged inStock=false and lack verified details.
export const DESIGNER_FABRICS = FABRIC_STOCK.filter((fabric) => fabric.inStock).map(designerFabricFromStock);
export const DESIGNER_SHIRTS = DESIGNER_FABRICS.filter((fabric) => fabric.allowedGarments.includes("shirt"));
export const DESIGNER_PANTS = DESIGNER_FABRICS.filter((fabric) => fabric.allowedGarments.includes("pant"));

function swatchSaturation(hex: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const max = Math.max(...channels); const min = Math.min(...channels);
  return max ? (max - min) / max : 0;
}

function relation(shirt: DesignerFabric, pant: DesignerFabric) {
  if (shirt.name === pant.name || shirt.hex.toLowerCase() === pant.hex.toLowerCase()) return "tonal";
  // The supplied taxonomy defines tonal as shades of the same family, not
  // just two identical swatches. Leave unnamed/printed colours unverified.
  if (!shirt.colorFamily || !pant.colorFamily) return "unverified contrast";
  if (shirt.colorFamily === pant.colorFamily && shirt.colorFamily !== "Neutral") return "tonal";
  if (shirt.colorFamily === "Neutral" || pant.colorFamily === "Neutral") return "neutral anchor";
  if (shirt.tone && pant.tone && shirt.tone !== pant.tone) {
    return (shirt.tone === "Light" && pant.tone === "Dark") || (shirt.tone === "Dark" && pant.tone === "Light")
      ? "light-dark contrast" : "soft contrast";
  }
  return "unverified contrast";
}

function rule(id: string, severity: RuleSeverity, status: RuleStatus, explanation: string): DesignerRuleResult {
  return { id, severity, status, explanation };
}

// Coverage is a count of independently confirmed facts, NOT a probability of
// satisfaction. An approximate photographed colour or a yarn-count label does
// not count as verification of colour, GSM, thermal comfort or stock.
export function designerMaterialEvidence(shirt: DesignerFabric, pant: DesignerFabric) {
  const checks = [shirt, pant].flatMap((fabric) => [
    [`${fabric.name}: physical colour`, fabric.colorVerified === true],
    [`${fabric.name}: motif scale`, fabric.patternScaleVerified === true],
    [`${fabric.name}: exact composition`, fabric.fiberContentVerified === true && !!fabric.fiberContent],
    [`${fabric.name}: measured GSM`, fabric.weightGsm !== null && Number.isFinite(fabric.weightGsm) && fabric.weightGsm > 0],
    [`${fabric.name}: drape`, !!fabric.drape],
    [`${fabric.name}: opacity`, !!fabric.opacity],
    [`${fabric.name}: comfort for intended climate`, !!fabric.comfortTags?.length],
    [`${fabric.name}: verified physical stock status`, fabric.availabilityVerified===true || (fabric.confirmedAvailableMetres !== null && Number.isFinite(fabric.confirmedAvailableMetres) && fabric.confirmedAvailableMetres >= 0)],
  ] as Array<[string, boolean]>);
  return { verified: checks.filter(([, known]) => known).length, total: checks.length,
    missing: checks.filter(([, known]) => !known).map(([label]) => label) };
}

const weightBands = ["Light", "Medium", "Heavy"] as const;

export function evaluateDesignerAccent(base: DesignerFabric, accent: DesignerFabric, placement: DesignerAccent["placement"], occasion: OccasionTier): DesignerRuleResult[] {
  const roleStatus: RuleStatus = accent.roleTags === null ? "unknown" : accent.roleTags.includes("accent_safe") ? "pass" : "flag";
  const weightStatus: RuleStatus = !base.weightClass || !accent.weightClass ? "unknown"
    : weightBands.indexOf(accent.weightClass) <= weightBands.indexOf(base.weightClass) ? "pass" : "flag";
  const colourStatus: RuleStatus = base.tone && accent.tone && base.tone !== accent.tone ? "pass"
    : base.colorFamily && accent.colorFamily ? base.colorFamily !== accent.colorFamily ? "pass" : "flag" : "unknown";
  const patternStatus: RuleStatus = base.patternScale === null || accent.patternScale === null ? "unknown"
    : base.patternScale === "None" || accent.patternScale === "None" ? "pass" : "flag";
  const placementStatus: RuleStatus = placement === "waistband" ? "unknown"
    : (placement === "placket" || placement === "pocket") && (occasion === "Semi-Formal" || occasion === "Formal") ? "flag" : "pass";
  return [
    rule("MF-1", "High", roleStatus, roleStatus === "unknown" ? "The accent-safe role has not been verified for this cloth." : roleStatus === "flag" ? "This cloth is not approved for small accent pieces." : "The cloth is approved for accents."),
    rule("MF-2", "High", weightStatus, weightStatus === "unknown" ? "Both cloth weights need measuring before using an accent." : weightStatus === "flag" ? "The accent cloth is heavier than the base cloth." : "The accent is no heavier than the base cloth."),
    rule("MF-3", "Medium", colourStatus, colourStatus === "unknown" ? "The accent's colour difference needs a physical-swatch check." : colourStatus === "flag" ? "The accent has no clear tone or colour-family difference." : "The accent has a clear tone or colour-family difference."),
    rule("MF-4", "High", patternStatus, patternStatus === "unknown" ? "The motif scale needs checking on both cloths." : patternStatus === "flag" ? "A patterned base calls for a solid accent." : "The base and accent keep one restrained pattern focus."),
    rule("MF-5", "Medium", placementStatus, placementStatus === "unknown" ? "The owner has not approved this accent placement." : placementStatus === "flag" ? "Placket and pocket accents read too casual for this occasion." : "This accent placement fits the requested occasion."),
  ];
}

function reviewLine(rules: DesignerRuleResult[], occasion: OccasionTier, whiteContrast = false): string {
  const flagged = (id: string) => rules.some((item) => item.id === id && item.status === "flag");
  if (flagged("CUT-CUFF")) return "A French cuff needs a spread or cutaway collar; let us review this cut.";
  if (flagged("CUT-HEM")) return "A cropped trouser needs a matching hem length; let us review this cut.";
  if (flagged("CUT-TUCK")) return "A tucked shirt will give this formal look a cleaner waistline.";
  if (flagged("CR-4")) return "Two prominent patterns compete here; one piece should be quieter.";
  if (flagged("FORMAL-PRINT")) return "The visible pattern reads too relaxed for this formal direction.";
  if (flagged("CR-1")) return "The shirt and trousers sit at different formality levels; let us refine the balance.";
  if (flagged("CUT-WAIST")) return "A soft waistband changes the formality of this look; let us review the finish.";
  if (flagged("CONTEXT-CLIMATE")) return "One cloth is marked unsuitable for the requested climate; let us find a better physical fabric.";
  if (flagged("CR-2")) return "We should compare these colours against the physical cloth before recommending them.";
  if (whiteContrast) return "A white contrast collar could sharpen this direction once we verify the separate white fabric.";
  return `This ${occasion.toLowerCase()} direction needs a closer look at the cloth and cut.`;
}

function directionLine(shirt: DesignerFabric, pant: DesignerFabric, style: DesignerStyle, colour: string, occasion: OccasionTier): string {
  const palette = colour === "tonal" ? "keeps the palette tonal"
    : colour === "neutral anchor" ? "uses a quiet neutral anchor"
      : colour === "soft contrast" ? "builds a soft colour contrast"
        : "balances light and dark cloth";
  const shape = style.trouser === "Pleated Trouser" ? "a pleat adds room through the upper leg"
    : style.trouser === "Formal Trouser (Flat-front)" ? "a flat front keeps the line crisp"
      : style.trouser === "Wide-leg / Relaxed Drape Trouser" ? "a fuller leg gives the silhouette more volume"
        : "the trouser line gives the outfit its shape";
  const shirtFinish = style.shirtWear === "Tucked" ? " A tucked shirt gives the waist a cleaner line." : "";
  const contrastCollar = style.collarFinish !== "Self-fabric" ? " The white contrast detail is provisional until its cloth is selected." : "";
  return `${shirt.name} with ${pant.name} ${palette}; ${shape} for ${occasion.toLowerCase()} wear.${shirtFinish}${contrastCollar}`;
}

export function evaluateDesignerCombo(shirt: DesignerFabric, pant: DesignerFabric, occasion: OccasionTier, overrides?: DesignerStyleOverrides, accent?: DesignerAccent, context: DesignerContext = DEFAULT_DESIGNER_CONTEXT): DesignerRecommendation {
  if (!shirt.allowedGarments.includes("shirt") || !pant.allowedGarments.includes("pant")) {
    throw new Error("Select a shirting fabric and a trouser fabric from the catalogue.");
  }
  const style = resolveStyle(occasion, overrides);
  const shirtStructure = average([
    score(collars, "Collar_Type", style.collar) ?? optionFormality("shirt.collar",style.collar),
    score(cuffs, "Cuff_Type", style.cuff) ?? optionFormality("shirt.cuff",style.cuff),
    score(details.filter((row) => row.Element_Group === "Placket"), "Type", style.placket) ?? optionFormality("shirt.placket",style.placket),
    score(details.filter((row) => row.Element_Group === "Fit"), "Type", style.shirtFit) ?? optionFormality("shirt.fit",style.shirtFit),
  ]);
  const pantStructure = score(trousers, "Trouser_Type", style.trouser) ?? optionFormality("pant.type",style.trouser);
  const shirtPatternScore = score(patterns, "Pattern_Type", shirt.patternType);
  const pantPatternScore = score(patterns, "Pattern_Type", pant.patternType);
  const shirtColorScore = shirt.formalityScore;
  const pantColorScore = pant.formalityScore;
  // Structure dominates because the photographed colour and motif may be approximate.
  const shirtScore = shirtStructure === null ? null : .7 * shirtStructure + .3 * (average([shirtColorScore, shirtPatternScore]) ?? shirtStructure);
  const pantScore = pantStructure === null ? null : .7 * pantStructure + .3 * (average([pantColorScore, pantPatternScore]) ?? pantStructure);
  const delta = shirtScore !== null && pantScore !== null ? Math.abs(shirtScore - pantScore) : null;
  const band = occasionBand(occasion);
  const comboScore = average([shirtScore, pantScore]);
  const bandMatch = comboScore === null ? null : comboScore >= band[0] && comboScore <= band[1];
  const maxDelta = occasion === "Casual" || occasion === "Smart-Casual" ? 2 : 1;
  const colorRelation = relation(shirt, pant);
  const jewelClash = shirt.colorFamily === "Jewel-tone" && pant.colorFamily === "Jewel-tone"
    && swatchSaturation(shirt.hex) > .4 && swatchSaturation(pant.hex) > .4;
  const colorFlag = jewelClash || colorRelation === "unverified contrast";
  const prominent = (value: DesignerFabric["patternScale"]) => value === "Bold" || value === "Medium-Bold";
  const oneProminent = prominent(shirt.patternScale) || prominent(pant.patternScale);
  const otherRestrained = prominent(shirt.patternScale)
    ? pant.patternScale === "None" || pant.patternScale === "Fine"
    : shirt.patternScale === "None" || shirt.patternScale === "Fine";
  const patternUncertain = oneProminent && (prominent(shirt.patternScale) ? pant.patternScale === null : shirt.patternScale === null);
  const patternConflict = oneProminent && !otherRestrained && !patternUncertain;
  const buttonScore = score(buttons, "Button_Material", style.button);
  const shirtWeight = shirt.weightClass ? weightBands.indexOf(shirt.weightClass) : null;
  const pantWeight = pant.weightClass ? weightBands.indexOf(pant.weightClass) : null;
  const weightStatus: RuleStatus = shirtWeight === null || pantWeight === null ? "unknown" : Math.abs(shirtWeight - pantWeight) > 1 ? "flag" : "pass";
  const seasons = (values: string[]) => values.map((value) => value.toLowerCase().trim());
  const shirtSeasons = shirt.bestSeason?.length ? seasons(shirt.bestSeason) : null;
  const pantSeasons = pant.bestSeason?.length ? seasons(pant.bestSeason) : null;
  const seasonStatus: RuleStatus = !shirtSeasons || !pantSeasons ? "unknown"
    : shirtSeasons.includes("all-season") || pantSeasons.includes("all-season")
      || shirtSeasons.some((season) => pantSeasons.includes(season)) ? "pass" : "flag";
  const accentBase = accent?.garment === "pant" ? pant : shirt;
  const accentRules = accent ? evaluateDesignerAccent(accentBase, accent.fabric, accent.placement, occasion) : [];
  const accentStatus: RuleStatus = !accent ? "not_applicable" : accentRules.some((item) => item.status === "flag")
    ? "flag" : accentRules.some((item) => item.status === "unknown") ? "unknown" : "pass";
  const climateStatus: RuleStatus = context.climate === "Not specified" ? "not_applicable"
    : [shirt, pant].some((fabric) => fabric.comfortTags?.length && !fabric.comfortTags.includes(context.climate as Exclude<DesignerClimate, "Not specified">)) ? "flag"
      : [shirt, pant].every((fabric) => fabric.comfortTags?.includes(context.climate as Exclude<DesignerClimate, "Not specified">)) ? "pass" : "unknown";
  const rules: DesignerRuleResult[] = [
    rule("CR-1", "High", delta === null ? "unknown" : delta > maxDelta ? "flag" : "pass",
      delta === null ? "Construction scores need review." : `Shirt and trouser construction differ by ${delta.toFixed(1)} points; this occasion allows ${maxDelta}.`),
    rule("CR-2", "Medium", colorFlag ? "flag" : "pass",
      jewelClash ? "Two saturated jewel tones need a stylist's review." : `The pair reads as ${colorRelation}; colour is approximate in catalogue photographs.`),
    rule("CR-3", "Medium", weightStatus, weightStatus === "unknown" ? "The catalogue has no measured GSM, opacity, or drape for this pair." : weightStatus === "flag" ? "The confirmed shirt and trouser weight classes differ by two bands." : "The confirmed shirt and trouser weight classes are within one band."),
    rule("CR-4", "High", patternConflict ? "flag" : shirt.patternScale === null || pant.patternScale === null ? "unknown" : "pass",
      patternConflict ? "A bold motif needs a solid or fine companion." : shirt.patternScale === null || pant.patternScale === null
        ? "At least one print has no confirmed motif scale." : "The pair has a restrained pattern load."),
    rule("CR-5", "Low", seasonStatus, seasonStatus === "unknown" ? "The specific fabrics have no verified season or thermal-comfort data." : seasonStatus === "flag" ? "The confirmed season tags do not overlap." : "The confirmed season tags overlap or include all-season."),
    rule("CR-6", "High", accentStatus, !accent ? "This direction uses one cloth per garment and no accent fabric." : accentStatus === "unknown" ? "The accent needs additional verification before it can be recommended." : accentStatus === "flag" ? "The proposed accent breaks one or more multi-fabric rules." : "The accent meets the verified multi-fabric rules."),
    rule("CR-7", "Low", buttonScore === null || shirtScore === null ? "unknown" : Math.abs(buttonScore - shirtScore) > 1 ? "flag" : "pass",
      buttonScore === null ? "Button compatibility needs review." : `${style.button} is the provisional button recommendation.`),
  ];
  rules.push(...accentRules);
  rules.push(rule("CONTEXT-CLIMATE", "Medium", climateStatus,
    climateStatus === "not_applicable" ? "No climate was specified."
      : climateStatus === "unknown" ? "The actual cloth has no verified comfort tags for this climate; do not infer warmth from its photo or yarn count."
        : climateStatus === "flag" ? "At least one cloth is confirmed unsuitable for the selected climate."
          : "Both physical cloths have been checked for the selected climate."));
  // These are explicit compatibility notes in the owner's datasheet. Fit,
  // rise and break have no formality numbers there, so we check known clashes
  // instead of making up numerical weights for them.
  const formalCollar = style.collar === "Spread Collar" || style.collar === "Cutaway Collar";
  rules.push(rule("CUT-CUFF", "High", style.cuff === "French / Double Cuff" && !formalCollar ? "flag" : "pass",
    style.cuff === "French / Double Cuff" && !formalCollar
      ? "The reference pairs a French cuff only with a spread or cutaway collar."
      : "The collar and cuff construction are compatible in the reference."));
  const croppedShape = style.trouser === "Cropped / Ankle-length Trouser";
  const croppedBreak = style.break === "Cropped / Above-ankle";
  rules.push(rule("CUT-HEM", "High", croppedShape && !croppedBreak ? "flag" : "pass",
    croppedShape && !croppedBreak
      ? "A cropped trouser shape and a full-length trouser break describe different hemlines."
      : "The selected trouser shape and hem length agree."));
  rules.push(rule("CUT-WAIST", "Medium", occasion === "Formal" && style.waistband === "Drawstring / Elastic" ? "flag" : "pass",
    occasion === "Formal" && style.waistband === "Drawstring / Elastic"
      ? "The reference places drawstring or elastic waistbands in casual looks."
      : "The waistband does not conflict with this occasion in the reference."));
  const untuckedFormal = occasion === "Formal" && style.shirtWear === "Untucked";
  rules.push(rule("CUT-TUCK", untuckedFormal ? "High" : "Low", untuckedFormal ? "flag" : "pass",
    untuckedFormal ? "An untucked shirt breaks the clean waistline of this formal direction; try a tucked shirt with enough length to stay in place."
      : "The selected shirt finish can be assessed with this occasion."));
  const whiteContrast = style.collarFinish !== "Self-fabric";
  rules.push(rule("DETAIL-WHITE-COLLAR", "Medium", whiteContrast ? "unknown" : "not_applicable",
    whiteContrast ? "The white contrast collar needs a separate real fabric; shade, weight, shrinkage and availability are not documented."
      : "No separate collar fabric is requested."));
  rules.push(rule("OCCASION", "Medium", bandMatch === null ? "unknown" : bandMatch ? "pass" : "flag",
    comboScore === null ? "The occasion formality band needs review." : `The provisional look scores ${comboScore.toFixed(1)} against the ${occasion} band of ${band[0]}–${band[1]}.`));
  if (occasion === "Formal" && ((shirtPatternScore !== null && shirtPatternScore < 4) || (pantPatternScore !== null && pantPatternScore < 4))) {
    rules.push(rule("FORMAL-PRINT", "High", "flag", "A visible print reads too relaxed for the requested formal look."));
  }

  const crossRules=evaluateCrossGarmentRules({
    spec:fromLegacyStyle(style),
    occasion,
    climate:context.climate,
    shirtPatternScale:shirt.patternScale,
    pantPatternScale:pant.patternScale,
    shirtWeightClass:shirt.weightClass,
    pantWeightClass:pant.weightClass,
    shirtDrapeVerified:Boolean(shirt.drape && shirt.weightGsm!==null),
    pantDrapeVerified:Boolean(pant.drape && pant.weightGsm!==null),
  });
  for(const cross of crossRules) {
    // CR-4 remains the compatibility identifier used by saved reports; the
    // shared rule engine owns the equivalent pattern logic for StyleSpec v2,
    // but we avoid double-counting it in the legacy recommendation score.
    if(cross.ruleId==="CG-PATTERN-LOAD") continue;
    rules.push(rule(
      cross.ruleId,
      cross.severity,
      cross.effect==="bonus" ? "pass" : "flag",
      cross.explanation,
    ));
  }

  const penalties = { High: 35, Medium: 16, Low: 7 } as const;
  const fit = Math.max(0, 100 - rules.reduce((sum, item) => sum + (item.status === "flag" ? penalties[item.severity] : 0), 0));
  const unknownCount = rules.filter((item) => item.status === "unknown").length;
  const confidenceScore = Math.min(fit, Math.max(0, 100 - unknownCount * 9));
  const needsReview = confidenceScore < 65 || bandMatch === false || climateStatus === "flag" || colorRelation === "unverified contrast" || whiteContrast
    || (Boolean(accent) && accentStatus !== "pass")
    || rules.some((item) => item.status === "flag" && item.severity === "High");
  const materialEvidence = designerMaterialEvidence(shirt, pant);
  if (whiteContrast) {
    materialEvidence.total += 1;
    materialEvidence.missing.push("White contrast collar cloth: shade, weight, shrinkage and available metres");
  }
  const confirmationsNeeded = [
    "Confirm current availability and required metres for both fabrics.",
    "Confirm GSM, opacity and drape before cutting; these are absent from the catalogue.",
    ...(context.climate !== "Not specified" && climateStatus !== "pass" ? ["Check air flow, thermal comfort and the chosen climate against both physical cloths."] : []),
    "Confirm the chosen fit and proportions against the wearer's measurements.",
    ...(style.shirtWear === "Tucked" ? ["Confirm shirt body length, waist ease and the actual tuck against the wearer."] : []),
    ...(whiteContrast ? ["Choose and verify a separate white collar cloth; confirm its shade, weight, shrinkage and metres before cutting."] : []),
    ...(shirt.patternScale === null || pant.patternScale === null ? ["Check motif scale against a physical swatch."] : []),
    ...(accent && accentStatus !== "pass" ? ["Confirm accent role, weight, colour and placement with the physical cloth."] : []),
    ...(needsReview ? ["Review the flagged pairing with a Linen Earth stylist."] : []),
  ];
  const shortReason = needsReview
    ? reviewLine(rules, occasion, whiteContrast)
    : directionLine(shirt, pant, style, colorRelation, occasion);
  return {
    shirt, pant, occasion, style,
    ...(accent ? { accent: { garment: accent.garment, fabricId: accent.fabric.id, placement: accent.placement } } : {}),
    confidenceScore, designFitScore: fit, materialEvidence, context,
    formality: { shirt: shirtScore, pant: pantScore, delta, band, match: bandMatch }, status: needsReview ? "needs_review" : "preliminary",
    shortReason, rules, confirmationsNeeded, ruleSetVersion: DESIGNER_RULE_SET_VERSION,
    internalReason: rules.map((item) => `${item.id}: ${item.status} — ${item.explanation}`).join("\n"),
  };
}
