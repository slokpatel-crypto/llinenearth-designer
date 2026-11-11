import type { FabricColorway } from "../fabric-stock.ts";

type GarmentRole = FabricColorway["suitableFor"][number];

function ownStringArray(
  value: unknown,
  maxItems: number,
  allowed: ReadonlySet<string>,
): string[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
    if (typeof length !== "number" || !Number.isSafeInteger(length) ||
        length < 0 || length > maxItems) return null;
    const items: string[] = [];
    for (let i = 0; i < length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string" ||
          !allowed.has(descriptor.value)) return null;
      items.push(descriptor.value);
    }
    return items;
  } catch {
    return null;
  }
}

const garmentRoles = new Set<string>(["shirt", "trouser", "suit", "blazer"]);
const seasonNames = new Set<string>(["Spring", "Summer", "Autumn", "Winter", "All-season"]);
const stockRoleTags = new Set<string>(["base_safe", "accent_safe"]);

/**
 * Copy one catalogued, available fabric from own data descriptors.
 * Do not execute a getter or reuse mutable, externally supplied arrays while
 * deciding whether a swatch is eligible for a customer's outfit.
 *
 * This snapshot asserts only the catalogue's inStock marker and structural
 * consistency: it does NOT certify metres, supplier availability, physical
 * GSM, drape, measured repeat or production cutting approval.
 */
function snapshotAvailableFabric(input: unknown): FabricColorway | null {
  if (input === null || typeof input !== "object") return null;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const read = (key: string): unknown => {
      const descriptor = descriptors[key];
      if (descriptor && !("value" in descriptor)) {
        throw new Error("Accessor-backed stock field");
      }
      return descriptor?.value;
    };
    if (read("inStock") !== true) return null;
    const id = read("id");
    const family = read("family");
    const line = read("line");
    const colorName = read("colorName");
    const hex = read("hex");
    const swatchImageUrl = read("swatchImageUrl");
    const pattern = read("pattern");
    const sourceDocument = read("sourceDocument");
    const sourcePage = read("sourcePage");
    const roles = ownStringArray(read("suitableFor"), 4, garmentRoles);
    if (![id, family, line, colorName, swatchImageUrl, pattern, sourceDocument]
        .every(value => typeof value === "string" && value.trim().length > 0) ||
        typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex) ||
        typeof sourcePage !== "number" || !Number.isSafeInteger(sourcePage) ||
        sourcePage < 1 || !roles || roles.length === 0) return null;
    const copy: FabricColorway = {
      id: id as string, family: family as string, line: line as string,
      colorName: colorName as string, hex, swatchImageUrl: swatchImageUrl as string,
      suitableFor: roles as GarmentRole[],
      pattern: pattern as string, sourceDocument: sourceDocument as string,
      sourcePage, inStock: true,
    };
    const optionalText = ["compositionNote", "weave", "texture"] as const;
    for (const key of optionalText) {
      const value = read(key);
      if (value !== undefined) {
        if (typeof value !== "string") return null;
        (copy as unknown as Record<string, unknown>)[key] = value;
      }
    }
    for (const key of ["weightGsm", "formalityScore"] as const) {
      const value = read(key);
      if (value !== undefined) {
        // Match the loader's existing physical metadata boundaries. A value
        // like 0.01 GSM or a negative formality score must not be promoted into
        // Designer evidence by this later structural snapshot.
        if (typeof value !== "number" || !Number.isFinite(value) ||
            (key === "weightGsm" && (value < 40 || value > 1000)) ||
            (key === "formalityScore" && (value < 1 || value > 5))) return null;
        (copy as unknown as Record<string, unknown>)[key] = value;
      }
    }
    const weightClass = read("weightClass");
    if (weightClass !== undefined) {
      if (weightClass !== "Light" && weightClass !== "Medium" && weightClass !== "Heavy") return null;
      copy.weightClass = weightClass;
    }
    const drape = read("drape");
    if (drape !== undefined) {
      if (drape !== "fluid" && drape !== "soft" && drape !== "medium" && drape !== "structured") return null;
      copy.drape = drape;
    }
    const availabilityVerified = read("availabilityVerified");
    if (availabilityVerified !== undefined) {
      if (typeof availabilityVerified !== "boolean") return null;
      copy.availabilityVerified = availabilityVerified;
    }
    const seasons = read("seasonTags");
    if (seasons !== undefined) {
      const values = ownStringArray(seasons, 8, seasonNames);
      if (!values) return null;
      copy.seasonTags = values as NonNullable<FabricColorway["seasonTags"]>;
    }
    const tags = read("roleTags");
    if (tags !== undefined) {
      const values = ownStringArray(tags, 2, stockRoleTags);
      if (!values) return null;
      copy.roleTags = values as NonNullable<FabricColorway["roleTags"]>;
    }
    const yarn = read("yarnCountLea");
    if (yarn !== undefined) {
      try {
        if (!Array.isArray(yarn)) return null;
        const length = Object.getOwnPropertyDescriptor(yarn, "length")?.value;
        if (typeof length !== "number" || !Number.isSafeInteger(length) ||
            length < 1 || length > 4) return null;
        const counts: number[] = [];
        for (let i = 0; i < length; i++) {
          const descriptor = Object.getOwnPropertyDescriptor(yarn, String(i));
          if (!descriptor || !("value" in descriptor) ||
              typeof descriptor.value !== "number" || !Number.isFinite(descriptor.value) ||
              descriptor.value <= 0) return null;
          counts.push(descriptor.value);
        }
        copy.yarnCountLea = counts;
      } catch {
        return null;
      }
    }
    return copy;
  } catch {
    return null;
  }
}

/**
 * Read an injected catalogue once before both hero ranking and outfit
 * pairing. Skip malformed/unavailable entries independently rather than
 * allowing one corrupt swatch to reject the entire customer request.
 */
export function styleDirectorStockSnapshot(stock: readonly unknown[]): FabricColorway[] {
  const result: FabricColorway[] = [];
  try {
    if (!Array.isArray(stock)) return result;
    const length = Object.getOwnPropertyDescriptor(stock, "length")?.value;
    if (typeof length !== "number" || !Number.isSafeInteger(length) ||
        length < 0 || length > 10000) return result;
    for (let i = 0; i < length; i++) {
      try {
        const entry = Object.getOwnPropertyDescriptor(stock, String(i));
        if (!entry || !("value" in entry)) continue;
        const fabric = snapshotAvailableFabric(entry.value);
        if (fabric) result.push(fabric);
      } catch {
        // An inaccessible row must not prevent valid later stock from ranking.
      }
    }
  } catch {
    return [];
  }
  return result;
}
