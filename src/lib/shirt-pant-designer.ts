import { FABRIC_STOCK, type FabricColorway } from "@/lib/fabric-stock";
import type { DesignerBrief } from "@/lib/designer-types";

export const SHIRT_PANT_RULESET_VERSION = "shirt-pant-basic-v1";
export const LOW_CONFIDENCE_THRESHOLD = 68;

export type OccasionBand = "Casual" | "Smart-Casual" | "Semi-Formal" | "Formal" | "Formal-Event";
export type RuleStatus = "pass" | "warn" | "unknown";
export type RulePenalty = "none" | "low" | "medium" | "high";
export type PatternScale = "solid" | "fine" | "medium" | "bold";

export type ComboRuleResult = {
  id: "CR-1" | "CR-2" | "CR-3" | "CR-4" | "CR-5" | "CR-6" | "CR-7";
  label: string;
  status: RuleStatus;
  penalty: RulePenalty;
  deduction: number;
  reason: string;
};

export type StockPiece = Pick<FabricColorway, "id" | "line" | "colorName" | "hex" | "swatchImageUrl" | "pattern">;

export type StockPairingPublic = {
  id: string;
  rulesVersion: string;
  shirt: StockPiece;
  trouser: StockPiece;
  occasionBand: OccasionBand;
  confidenceScore: number;
  customerReason: string;
  relationship: string;
  forced: boolean;
  needsHumanFallback: boolean;
  humanApprovedFallback?: boolean;
  dataWarnings: string[];
};

export type StockPairingEvaluation = StockPairingPublic & {
  rules: ComboRuleResult[];
  reasoningText: string;
  provisionalTasteModel: true;
};

type Hsl = { h: number; s: number; l: number };

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hsl(hex: string): Hsl {
  const raw = hex.replace("#", "");
  const value = Number.parseInt(raw, 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

function isNeutral(color: Hsl) {
  return color.s < 0.2 || color.l < 0.15 || color.l > 0.88;
}

function occasionBand(brief: DesignerBrief): OccasionBand {
  switch (brief.context.formality) {
    case "Relaxed": return "Casual";
    case "Smart relaxed": return "Smart-Casual";
    case "Refined": return "Semi-Formal";
    case "Formal": return "Formal";
    case "Ceremonial / evening formal": return "Formal-Event";
    default: return "Smart-Casual";
  }
}

function patternScale(pattern: string): PatternScale {
  const p = pattern.toLowerCase();
  if (p.includes("plain") || p.includes("solid")) return "solid";
  if (p.includes("micro") || p.includes("pinstripe") || p.includes("fine")) return "fine";
  if (p.includes("floral") || p.includes("botanical") || p.includes("geometric") || p.includes("mosaic") || p.includes("block-inspired") || p.includes("abstract") || p.includes("chevron")) return "bold";
  if (p.includes("check") || p.includes("stripe") || p.includes("windowpane")) return "medium";
  return "medium";
}

function provisionalFormality(fabric: FabricColorway) {
  const line = fabric.line.toLowerCase();
  const scale = patternScale(fabric.pattern);
  if (fabric.suitableFor.includes("trouser")) return 3.6;
  if (line.includes("formal shirting")) return scale === "bold" ? 2.9 : 3.5;
  if (line.includes("print")) return 2.1;
  if (line.includes("plain")) return 2.9;
  return 2.7;
}

function penaltyValue(penalty: RulePenalty) {
  if (penalty === "high") return 24;
  if (penalty === "medium") return 12;
  if (penalty === "low") return 6;
  return 0;
}

function result(
  id: ComboRuleResult["id"],
  label: string,
  status: RuleStatus,
  penalty: RulePenalty,
  reason: string,
): ComboRuleResult {
  return { id, label, status, penalty, deduction: status === "warn" ? penaltyValue(penalty) : 0, reason };
}

function colorRule(shirt: FabricColorway, trouser: FabricColorway) {
  const a = hsl(shirt.hex);
  const b = hsl(trouser.hex);
  const distance = hueDistance(a.h, b.h);
  if (a.s > 0.58 && b.s > 0.58 && !isNeutral(a) && !isNeutral(b)) {
    return {
      relationship: "high-saturation conflict",
      rule: result("CR-2", "Color harmony", "warn", "medium", "Both pieces read strongly saturated; one should become quieter before this is treated as a safe LLinen Earth pairing."),
    };
  }
  if (isNeutral(a) || isNeutral(b)) {
    return {
      relationship: "neutral anchor",
      rule: result("CR-2", "Color harmony", "pass", "none", "One piece acts as a neutral anchor, so the other fabric can lead without competing for attention."),
    };
  }
  if (distance <= 34) {
    return {
      relationship: "tonal",
      rule: result("CR-2", "Color harmony", "pass", "none", "The two colors stay close enough in hue to read as a controlled tonal relationship."),
    };
  }
  if (distance >= 135) {
    return {
      relationship: "intentional contrast",
      rule: result("CR-2", "Color harmony", "pass", "none", "The hue separation is strong enough to read as deliberate contrast rather than an accidental near-match."),
    };
  }
  return {
    relationship: "controlled contrast",
    rule: result("CR-2", "Color harmony", "pass", "none", "The colors are separated without creating a two-jewel-tone conflict."),
  };
}

function customerReason(relationship: string, shirt: FabricColorway, trouser: FabricColorway) {
  const shirtScale = patternScale(shirt.pattern);
  if (shirtScale === "bold") {
    return `The ${trouser.colorName} trouser keeps the ${shirt.colorName} shirt as the visual lead, with restrained pattern load and a ${relationship} colour relationship.`;
  }
  return `The ${shirt.colorName} shirt and ${trouser.colorName} trouser stay balanced in formality, use a ${relationship} colour relationship, and keep the outfit visually controlled.`;
}

function evaluatePair(shirt: FabricColorway, trouser: FabricColorway, brief: DesignerBrief): StockPairingEvaluation {
  const band = occasionBand(brief);
  const shirtFormality = provisionalFormality(shirt);
  const trouserFormality = provisionalFormality(trouser);
  const delta = Math.abs(shirtFormality - trouserFormality);
  const formalBand = band === "Semi-Formal" || band === "Formal" || band === "Formal-Event";
  const maxDelta = formalBand ? 1 : 2;

  const rules: ComboRuleResult[] = [];
  rules.push(
    delta <= maxDelta
      ? result("CR-1", "Formality alignment", "pass", "none", `Provisional formality delta is ${delta.toFixed(1)}, within the ${maxDelta.toFixed(1)} limit for ${band}.`)
      : result("CR-1", "Formality alignment", "warn", "high", `Provisional formality delta is ${delta.toFixed(1)}, above the ${maxDelta.toFixed(1)} limit for ${band}.`),
  );

  const color = colorRule(shirt, trouser);
  rules.push(color.rule);

  rules.push(result(
    "CR-3",
    "Weight matching",
    "unknown",
    "medium",
    "Exact GSM / weight class is not supplied for these catalogue swatches, so the engine will not invent a weight verdict.",
  ));

  const shirtPattern = patternScale(shirt.pattern);
  const trouserPattern = patternScale(trouser.pattern);
  const loaded = ["medium", "bold"].includes(shirtPattern) && ["medium", "bold"].includes(trouserPattern);
  rules.push(
    loaded
      ? result("CR-4", "Pattern load", "warn", "high", "Both pieces carry a medium-or-strong pattern, exceeding the Phase-1 single-pattern rule.")
      : result("CR-4", "Pattern load", "pass", "none", "At most one piece carries a medium-or-strong pattern, so visual hierarchy stays clear."),
  );

  const sameFamily = shirt.family.toLowerCase() === trouser.family.toLowerCase();
  rules.push(
    sameFamily
      ? result("CR-5", "Season consistency", "pass", "none", "Both catalogue pieces share the same linen family; exact seasonal weight still needs physical-stock confirmation.")
      : result("CR-5", "Season consistency", "unknown", "low", "Season overlap cannot be verified from the current catalogue metadata."),
  );

  rules.push(result(
    "CR-6",
    "Accent fabric validity",
    "pass",
    "none",
    "No secondary accent fabric is attached to either stock record in this Phase-1 combination.",
  ));

  rules.push(result(
    "CR-7",
    "Button / trim consistency",
    "unknown",
    "low",
    "Button material and trim formality are not yet recorded in the stock metadata.",
  ));

  const ruleDeduction = rules.reduce((sum, rule) => sum + rule.deduction, 0);
  const unknownCount = rules.filter((rule) => rule.status === "unknown").length;
  const dataDeduction = unknownCount * 5 + 4; // 4 keeps provisional taste rules from presenting as verified truth.
  const confidenceScore = clamp(100 - ruleDeduction - dataDeduction);
  const forced = confidenceScore >= LOW_CONFIDENCE_THRESHOLD;
  const id = `PAIR-${shirt.id}--${trouser.id}--${SHIRT_PANT_RULESET_VERSION}`;
  const reasoningText = rules.map((rule) => `${rule.id} ${rule.status.toUpperCase()}: ${rule.reason}`).join(" ");

  return {
    id,
    rulesVersion: SHIRT_PANT_RULESET_VERSION,
    shirt: {
      id: shirt.id,
      line: shirt.line,
      colorName: shirt.colorName,
      hex: shirt.hex,
      swatchImageUrl: shirt.swatchImageUrl,
      pattern: shirt.pattern,
    },
    trouser: {
      id: trouser.id,
      line: trouser.line,
      colorName: trouser.colorName,
      hex: trouser.hex,
      swatchImageUrl: trouser.swatchImageUrl,
      pattern: trouser.pattern,
    },
    occasionBand: band,
    confidenceScore,
    customerReason: customerReason(color.relationship, shirt, trouser),
    relationship: color.relationship,
    forced,
    needsHumanFallback: !forced,
    dataWarnings: [
      "Formality values are provisional LLinen Earth defaults until the taste sheet is approved.",
      "Exact GSM / weight and button metadata are not yet present in the catalogue records.",
    ],
    rules,
    reasoningText,
    provisionalTasteModel: true,
  };
}

export function evaluateStockPairByIds(brief: DesignerBrief, shirtId: string, trouserId: string): StockPairingEvaluation | null {
  const shirt = FABRIC_STOCK.find((fabric) => fabric.id === shirtId && fabric.inStock && fabric.suitableFor.includes("shirt"));
  const trouser = FABRIC_STOCK.find((fabric) => fabric.id === trouserId && fabric.inStock && fabric.suitableFor.includes("trouser"));
  if (!shirt || !trouser) return null;
  return evaluatePair(shirt, trouser, brief);
}

export function approveHumanFallback(evaluation: StockPairingEvaluation): StockPairingEvaluation {
  return {
    ...evaluation,
    forced: true,
    needsHumanFallback: false,
    humanApprovedFallback: true,
    customerReason: `${evaluation.customerReason} This pairing is also on LLinen Earth's approved safe-fallback list for this formality band.`,
  };
}

export function publicStockPairing(evaluation: StockPairingEvaluation | null): StockPairingPublic | null {
  if (!evaluation) return null;
  const { rules: _rules, reasoningText: _reasoningText, provisionalTasteModel: _provisionalTasteModel, ...publicData } = evaluation;
  return publicData;
}

export function recommendStockPairing(brief: DesignerBrief): StockPairingEvaluation | null {
  const stockId = brief.fabric.stockId;
  if (!stockId) return null;
  const anchor = FABRIC_STOCK.find((fabric) => fabric.id === stockId && fabric.inStock);
  if (!anchor) return null;

  const anchorIsShirt = anchor.suitableFor.includes("shirt");
  const anchorIsTrouser = anchor.suitableFor.includes("trouser");
  if (!anchorIsShirt && !anchorIsTrouser) return null;

  const opposite = FABRIC_STOCK.filter((fabric) => {
    if (!fabric.inStock || fabric.id === anchor.id) return false;
    return anchorIsShirt ? fabric.suitableFor.includes("trouser") : fabric.suitableFor.includes("shirt");
  });

  const evaluations = opposite.map((candidate) =>
    anchorIsShirt ? evaluatePair(anchor, candidate, brief) : evaluatePair(candidate, anchor, brief),
  );

  evaluations.sort((a, b) => {
    if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore;
    const aPattern = patternScale(a.shirt.pattern) === "solid" ? 1 : 0;
    const bPattern = patternScale(b.shirt.pattern) === "solid" ? 1 : 0;
    if (bPattern !== aPattern) return bPattern - aPattern;
    return a.id.localeCompare(b.id);
  });

  return evaluations[0] || null;
}
