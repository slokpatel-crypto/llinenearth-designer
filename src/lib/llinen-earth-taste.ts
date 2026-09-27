import type { DesignerBrief } from "@/lib/designer-types";

export type PairingMode = "Safe" | "Elevated" | "Statement";
export type TastePatternScale = "solid" | "fine" | "medium" | "bold";

export type PairingTasteInput = {
  relationship: string;
  shirtColorName: string;
  shirtHex: string;
  shirtPattern: TastePatternScale;
  trouserColorName: string;
  trouserHex: string;
  trouserPattern: TastePatternScale;
  confidenceScore: number;
  brief: DesignerBrief;
};

type Hsl = { h:number;s:number;l:number };

function clamp(value:number) {
  return Math.max(0,Math.min(100,Math.round(value)));
}

function hsl(hex:string):Hsl {
  const raw = hex.replace("#","");
  const value = Number.parseInt(raw,16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r,g,b);
  const min = Math.min(r,g,b);
  const d = max-min;
  const l = (max+min)/2;
  let h = 0;
  if (d) {
    if (max === r) h = ((g-b)/d)%6;
    else if (max === g) h = (b-r)/d+2;
    else h = (r-g)/d+4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = d === 0 ? 0 : d/(1-Math.abs(2*l-1));
  return {h,s,l};
}

function hueDistance(a:number,b:number) {
  const d = Math.abs(a-b);
  return Math.min(d,360-d);
}

function isNeutral(color:Hsl) {
  return color.s < 0.2 || color.l < 0.15 || color.l > 0.88;
}

function includesAny(value:string,terms:string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term)=>normalized.includes(term));
}

/**
 * Soft LLinen Earth affinity only.
 * Source: owned Color, Pattern & Material Pairing System v1.
 * This layer may rank rule-valid outfits; it must never override a hard CR warning.
 */
export function brandSeedAffinity(input:Pick<PairingTasteInput,"shirtColorName"|"shirtHex"|"shirtPattern"|"trouserColorName"|"trouserHex">) {
  const shirtColor = hsl(input.shirtHex);
  const trouserColor = hsl(input.trouserHex);
  const shirtName = input.shirtColorName.toLowerCase();
  const trouserName = input.trouserColorName.toLowerCase();

  const lightBlueShirt = (
    (shirtColor.h >= 185 && shirtColor.h <= 235 && shirtColor.l >= 0.42)
    || /sky blue|chambray|pale blue|light blue/.test(shirtName)
  );
  const whiteEcruShirt = /white|offwhite|off white|cream|ecru/.test(shirtName)
    || (shirtColor.s < 0.12 && shirtColor.l > 0.72);
  const warmLightTrouser = /cream|beige|taupe|stone|oak|tobacco|brown|sand/.test(trouserName)
    || (trouserColor.s < 0.25 && trouserColor.l > 0.52);
  const darkNeutralTrouser = /charcoal|dark grey|dark gray|slate|navy/.test(trouserName)
    || (trouserColor.s < 0.16 && trouserColor.l < 0.5);
  const oliveTrouser = /olive|khaki|khakhi/.test(trouserName)
    || (trouserColor.h >= 65 && trouserColor.h <= 115 && trouserColor.s >= 0.12 && trouserColor.s <= 0.5);

  if (lightBlueShirt && warmLightTrouser) return 10;
  if (lightBlueShirt && darkNeutralTrouser) return 8;
  if (oliveTrouser && whiteEcruShirt) return 10;
  if (oliveTrouser && lightBlueShirt) return 9;
  if (oliveTrouser && input.shirtPattern === "fine") return 7;
  if (isNeutral(shirtColor) || isNeutral(trouserColor)) return 5;
  if (hueDistance(shirtColor.h,trouserColor.h) <= 34) return 4;
  return 3;
}

function contextBias(mode:PairingMode,brief:DesignerBrief) {
  const context = [
    brief.context.occasion,
    brief.context.venue,
    brief.context.time,
    brief.context.environment,
    brief.context.formality,
    brief.context.aesthetic,
  ].join(" ").toLowerCase();

  let score = 0;
  const reasons:string[] = [];

  if (includesAny(context,["boardroom","business","office","formal","ceremonial"])) {
    if (mode === "Safe") { score += 9; reasons.push("formal context rewards restraint"); }
    if (mode === "Elevated") { score += 6; reasons.push("formal context supports controlled polish"); }
    if (mode === "Statement") { score -= 10; reasons.push("formal context reduces novelty tolerance"); }
  }

  if (includesAny(context,["summer","beach","resort","holiday","hot","outdoor"])) {
    if (mode === "Elevated") { score += 7; reasons.push("warm/resort context supports nuanced natural-texture pairing"); }
    if (mode === "Statement") { score += 3; reasons.push("relaxed context permits a little more expression"); }
  }

  if (includesAny(context,["evening","dinner","night"])) {
    if (mode === "Elevated") { score += 5; reasons.push("evening context supports richer contrast"); }
    if (mode === "Statement") { score += 5; reasons.push("evening context allows sharper contrast"); }
  }

  if (includesAny(context,["travel","versatile","everyday"])) {
    if (mode === "Safe") { score += 8; reasons.push("repeatability matters in versatile/travel use"); }
  }

  if (includesAny(context,["creative","festive","celebration"])) {
    if (mode === "Statement") { score += 8; reasons.push("creative/festive context permits more visual character"); }
    if (mode === "Elevated") { score += 4; reasons.push("creative/festive context supports premium contrast"); }
  }

  return {score,reasons};
}

export function scoreLlinenEarthPairing(mode:PairingMode,input:PairingTasteInput) {
  const affinity = brandSeedAffinity(input);
  const shirt = hsl(input.shirtHex);
  const trouser = hsl(input.trouserHex);
  const neutralCount = Number(isNeutral(shirt)) + Number(isNeutral(trouser));
  const vividCount = Number(shirt.s > 0.55) + Number(trouser.s > 0.55);
  const context = contextBias(mode,input.brief);
  const reasons:string[] = [...context.reasons];
  let score = input.confidenceScore * 0.55 + affinity * 2 + context.score;

  if (mode === "Safe") {
    if (input.relationship === "neutral anchor") { score += 12; reasons.push("neutral anchor lowers styling risk"); }
    if (input.relationship === "tonal") { score += 9; reasons.push("tonal continuity is dependable"); }
    if (input.shirtPattern === "solid" || input.shirtPattern === "fine") score += 7;
    if (input.trouserPattern === "solid" || input.trouserPattern === "fine") score += 6;
    if (vividCount > 0) score -= 4;
  }

  if (mode === "Elevated") {
    if (input.relationship === "controlled contrast") { score += 12; reasons.push("controlled contrast fits the premium default"); }
    if (input.relationship === "neutral anchor") { score += 10; reasons.push("neutral architecture lets material quality lead"); }
    if (input.relationship === "tonal") { score += 7; reasons.push("tonal pairing can read quietly luxurious"); }
    if (affinity >= 8) { score += 6; reasons.push("matches a strong LLinen Earth seed direction"); }
    if (neutralCount === 1) score += 4;
  }

  if (mode === "Statement") {
    if (input.relationship === "intentional contrast") { score += 14; reasons.push("deliberate contrast gives the look identity"); }
    if (input.relationship === "controlled contrast") { score += 9; reasons.push("controlled contrast creates distinction without chaos"); }
    if (input.shirtPattern === "medium") score += 7;
    if (input.shirtPattern === "bold") score += 10;
    if (neutralCount === 1) score += 5;
    if (vividCount > 1) score -= 12;
  }

  return {
    score: clamp(score),
    affinity,
    reason: reasons[0] || (
      mode === "Safe"
        ? "Prioritises compatibility, restraint and repeatability."
        : mode === "Elevated"
          ? "Prioritises nuanced LLinen Earth colour/material balance."
          : "Allows more contrast or pattern while keeping the outfit coherent."
    ),
  };
}
