import type { LockedDesignRevision } from "./design-lock.ts";

// Owner-only account cards need enough identity to recognize a saved outfit,
// not the private garment-spec, measurements, creative notes or recovery key.
// Labels are saved client-entered selections, never stock/colour/fit proof.
export type OwnedDesignSummary = {
  shirtName: string;
  trouserName: string;
  occasion: string;
};

function safeSavedLabel(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const clean = value
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060\u2066-\u2069\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(clean).slice(0, 80).join("") || fallback;
}

const OCCASIONS = new Set(["Casual", "Smart-Casual", "Semi-Formal", "Formal"]);

export function summaryForOwnedLockedDesign(revision: LockedDesignRevision): OwnedDesignSummary {
  const spec = revision.garmentSpec;
  const occasion = spec?.context?.occasion;
  return {
    shirtName: safeSavedLabel(spec?.fabrics?.shirt?.name, "Saved shirt fabric"),
    trouserName: safeSavedLabel(spec?.fabrics?.trouser?.name, "Saved trouser fabric"),
    occasion: typeof occasion === "string" && OCCASIONS.has(occasion)
      ? occasion
      : "Not specified",
  };
}
