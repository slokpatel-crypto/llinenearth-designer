import { TITAN_FABRIC_CATALOG, titanOutfitPairHref } from "./fabric-handoff.ts";

/**
 * A shareable shortlist of two existing catalogue REFERENCES, not a saved
 * design, customer profile, supplier measurement or physical outfit render.
 * Reuse the Designer's strict per-garment catalogue contract.
 */
export type TitanSharedOutfit = Readonly<{ shirtId: string; trouserId: string }>;

export function titanOutfitShareHref(shirtId: string, trouserId: string): string {
  // Fail before constructing any URL if either fabric is missing or assigned
  // to the wrong garment. This is intentionally NOT a designer handoff.
  titanOutfitPairHref(shirtId, trouserId);
  return `/titan?source=outfit&shirt=${encodeURIComponent(shirtId)}&trouser=${encodeURIComponent(trouserId)}#titan-outfit-builder`;
}

/** No partial matches, unknown keys, duplicate keys or cross-role fabrics. */
export function readTitanSharedOutfit(search: string): TitanSharedOutfit | null {
  const params = new URLSearchParams(search);
  const required = ["source", "shirt", "trouser"];
  if ([...params.keys()].length !== required.length
    || [...params.keys()].some(key => !required.includes(key))
    || required.some(key => params.getAll(key).length !== 1)
    || params.get("source") !== "outfit") return null;

  const shirtId = params.get("shirt");
  const trouserId = params.get("trouser");
  if (!shirtId || !trouserId
    || !TITAN_FABRIC_CATALOG.some(fabric => fabric.kind === "shirt" && fabric.id === shirtId)
    || !TITAN_FABRIC_CATALOG.some(fabric => fabric.kind === "trouser" && fabric.id === trouserId)) return null;
  return { shirtId, trouserId };
}
