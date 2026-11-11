import type { DesignerFabricIntelligence } from "../fabric-intelligence-types.ts";
import { colorFamilies } from "../vocab/colors.ts";
import { climateTags, garmentUses } from "../vocab/styling.ts";
import { styleDirectorIntelligenceTrustWeight } from "./style-director-compatibility.ts";

type ScorableStyleDirectorIntelligence = Pick<
  DesignerFabricIntelligence,
  "trust" | "reviewStatus" | "formality" | "statementLevel" |
  "bestGarments" | "climateVisualFit" | "colorFamily" | "depth"
> & {
  pairing: Pick<DesignerFabricIntelligence["pairing"], "goodColorFamilies" | "avoidColorFamilies">;
};

/** A stored approval is only usable when it is an own data value. */
function styleDirectorOwnScoringValue(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object") return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Copy the finite string lists used by ranking without invoking saved getters.
 * Reject sparse, accessor-backed, oversized or unreadable arrays entirely.
 */
function styleDirectorScoringStrings(value: unknown): string[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const size = Object.getOwnPropertyDescriptor(value, "length")?.value;
    if (typeof size !== "number" || !Number.isInteger(size) || size < 0 || size > 128) return null;
    const strings: string[] = [];
    for (let index = 0; index < size; index++) {
      const entry = Object.getOwnPropertyDescriptor(value, String(index));
      if (!entry || !("value" in entry) || typeof entry.value !== "string") return null;
      strings.push(entry.value);
    }
    return strings;
  } catch {
    return null;
  }
}

export function usableStyleDirectorIntelligence(value: DesignerFabricIntelligence | null | undefined):
  ScorableStyleDirectorIntelligence | null {
  // Authenticate the same captured provenance that the ranking will use.
  // Dynamic descriptor proxies must not supply "approved" for validation
  // and a different review/trust value for the returned ranking snapshot.
  const read = (key: string) => styleDirectorOwnScoringValue(value, key);
  const trust = read("trust");
  const reviewStatus = read("reviewStatus");
  const provenance = { trust, reviewStatus } as Pick<DesignerFabricIntelligence, "trust" | "reviewStatus">;
  if (styleDirectorIntelligenceTrustWeight(provenance) === 0) return null;
  const formality = read("formality");
  const statementLevel = read("statementLevel");
  if (typeof formality !== "number" || !Number.isInteger(formality) || formality < 1 || formality > 5 ||
      typeof statementLevel !== "number" || !Number.isInteger(statementLevel) || statementLevel < 1 ||
      statementLevel > 5) return null;
  const bestGarments = styleDirectorScoringStrings(read("bestGarments"));
  const climateVisualFit = styleDirectorScoringStrings(read("climateVisualFit"));
  const pairing = read("pairing");
  const goodColorFamilies = styleDirectorScoringStrings(styleDirectorOwnScoringValue(pairing, "goodColorFamilies"));
  const avoidColorFamilies = styleDirectorScoringStrings(styleDirectorOwnScoringValue(pairing, "avoidColorFamilies"));
  if (!bestGarments || !climateVisualFit || !goodColorFamilies || !avoidColorFamilies) return null;
  // Stored arrays are bounded strings, but their values must also belong to
  // the shared closed vocabularies. Unknown IDs could otherwise forge pair
  // matches or garment suitability without a real analyzer-backed category.
  const isKnown = (entries: readonly string[], allowed: ReadonlySet<string>) =>
    entries.every(id => allowed.has(id));
  const garmentIds: ReadonlySet<string> = new Set(garmentUses.map(entry => entry.id));
  const climateIds: ReadonlySet<string> = new Set(climateTags.map(entry => entry.id));
  const colorIds: ReadonlySet<string> = new Set(colorFamilies.map(entry => entry.id));
  if (!isKnown(bestGarments, garmentIds) ||
      !isKnown(climateVisualFit, climateIds) ||
      !isKnown(goodColorFamilies, colorIds) ||
      !isKnown(avoidColorFamilies, colorIds)) return null;
  const depth = read("depth");
  const colorFamily = read("colorFamily");
  // Only copied plain data affects ranking. Other stored fields, including
  // physical evidence, are neither invoked nor silently treated as verified.
  return {
    trust: trust as ScorableStyleDirectorIntelligence["trust"],
    reviewStatus: reviewStatus as ScorableStyleDirectorIntelligence["reviewStatus"],
    formality: formality as ScorableStyleDirectorIntelligence["formality"],
    statementLevel: statementLevel as ScorableStyleDirectorIntelligence["statementLevel"],
    bestGarments: bestGarments as ScorableStyleDirectorIntelligence["bestGarments"],
    climateVisualFit: climateVisualFit as ScorableStyleDirectorIntelligence["climateVisualFit"],
    pairing: {
      goodColorFamilies: goodColorFamilies as ScorableStyleDirectorIntelligence["pairing"]["goodColorFamilies"],
      avoidColorFamilies: avoidColorFamilies as ScorableStyleDirectorIntelligence["pairing"]["avoidColorFamilies"],
    },
    depth: (typeof depth === "string" && ["very-light", "light", "mid", "deep", "very-deep"].includes(depth)
      ? depth : "mid") as ScorableStyleDirectorIntelligence["depth"],
    colorFamily: (typeof colorFamily === "string" && colorIds.has(colorFamily)
      ? colorFamily : null) as ScorableStyleDirectorIntelligence["colorFamily"],
  };
}

/** Never invoke a scoring-map getter or trust an inherited fabric profile. */
export function styleDirectorScoringProfile(
  map: Record<string, DesignerFabricIntelligence> | null | undefined,
  id: string,
): DesignerFabricIntelligence | null {
  const candidate = styleDirectorOwnScoringValue(map, id);
  return candidate && typeof candidate === "object"
    ? candidate as DesignerFabricIntelligence : null;
}
