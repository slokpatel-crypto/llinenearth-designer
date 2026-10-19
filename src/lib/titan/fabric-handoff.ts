import { FABRIC_STOCK } from "../fabric-stock.ts";

/**
 * TITAN only displays references from the real, existing catalogue. The stock
 * flag in the static catalogue is NOT proof that a physical roll is available.
 * The Designer's calibrated/verified catalogue remains authoritative on entry.
 */
export type TitanFabricKind = "shirt" | "trouser";

export const TITAN_FABRIC_CATALOG = FABRIC_STOCK.filter(fabric =>
  fabric.inStock && (fabric.suitableFor.includes("shirt") || fabric.suitableFor.includes("trouser"))
).map(fabric => ({
  id: fabric.id,
  kind: (fabric.suitableFor.includes("shirt") ? "shirt" : "trouser") as TitanFabricKind,
  name: fabric.colorName,
  line: fabric.line,
  pattern: fabric.pattern,
  image: fabric.swatchImageUrl,
  hex: fabric.hex,
  availabilityVerified: fabric.availabilityVerified === true,
}));

export type TitanFabricReference = (typeof TITAN_FABRIC_CATALOG)[number];

export function titanFabricCollections(kind: TitanFabricKind): string[] {
  return [...new Set(TITAN_FABRIC_CATALOG.filter(fabric => fabric.kind === kind).map(fabric => fabric.line))];
}

/** Search is local, stable, and limited to catalogue-authored fields. */
export function findTitanFabrics(kind: TitanFabricKind, collection: string, search: string): TitanFabricReference[] {
  const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").trim();
  const words = normalize(search).split(/\s+/).filter(Boolean).slice(0, 12);
  return TITAN_FABRIC_CATALOG.filter(fabric =>
    fabric.kind === kind
    && (collection === "All" || fabric.line === collection)
    && words.every(word => normalize([fabric.id, fabric.name, fabric.line, fabric.pattern].join(" ")).includes(word))
  );
}

export function titanFabricHref(kind: TitanFabricKind, fabricId: string): string {
  if (!TITAN_FABRIC_CATALOG.some(fabric => fabric.kind === kind && fabric.id === fabricId)) {
    throw new Error("This cloth is not in the TITAN catalogue for the selected garment.");
  }
  return `/designer-studio?source=titan&kind=${kind}&fabric=${encodeURIComponent(fabricId)}`;
}

/** A deliberate outfit pair may transfer exactly one real fabric per garment. */
export function titanOutfitPairHref(shirtId: string, trouserId: string): string {
  if (!TITAN_FABRIC_CATALOG.some(fabric => fabric.kind === "shirt" && fabric.id === shirtId)
    || !TITAN_FABRIC_CATALOG.some(fabric => fabric.kind === "trouser" && fabric.id === trouserId)) {
    throw new Error("Both outfit fabrics must be genuine TITAN references for their respective garments.");
  }
  return `/designer-studio?source=titan&shirt=${encodeURIComponent(shirtId)}&trouser=${encodeURIComponent(trouserId)}`;
}

export type TitanFabricHandoff =
  | { kind: TitanFabricKind; fabricId: string }
  | { kind: "pair"; shirtId: string; trouserId: string };

/**
 * Fail-closed: one fabric replaces its requested garment only; a pair updates
 * both explicitly chosen fabrics, never measurements, styling or body profile.
 * Style Director links remain separate and authoritative.
 * never a saved trouser/shirt counterpart, measurement, cut or account record.
 * A Style Director / other deep link cannot masquerade as this fabric handoff.
 */
export function readTitanFabricHandoff(search: string): TitanFabricHandoff | null {
  const params = new URLSearchParams(search);
  if (params.get("source") !== "titan" || params.getAll("source").length !== 1) return null;
  const isSingle = params.has("kind") || params.has("fabric");
  const required = isSingle ? ["source", "kind", "fabric"] : ["source", "shirt", "trouser"];
  if ([...params.keys()].some(key => !required.includes(key))) return null;
  if (required.some(key => params.getAll(key).length !== 1)) return null;
  if (!isSingle) {
    const shirtId = params.get("shirt");
    const trouserId = params.get("trouser");
    if (!shirtId || !trouserId) return null;
    if (!TITAN_FABRIC_CATALOG.some(fabric => fabric.kind === "shirt" && fabric.id === shirtId)
      || !TITAN_FABRIC_CATALOG.some(fabric => fabric.kind === "trouser" && fabric.id === trouserId)) return null;
    return { kind: "pair", shirtId, trouserId };
  }
  const kind = params.get("kind");
  const fabricId = params.get("fabric");
  if (kind !== "shirt" && kind !== "trouser") return null;
  if (!fabricId || !TITAN_FABRIC_CATALOG.some(fabric => fabric.kind === kind && fabric.id === fabricId)) return null;
  return { kind, fabricId };
}

/**
 * Two-way visual shortlist, not a physical colour / scale comparison. Keep
 * selection inside one garment category and fail closed on stale or foreign
 * IDs; there is no design mutation until the customer chooses a Designer link.
 */
export function toggleTitanComparedFabrics(
  kind: TitanFabricKind,
  selectedIds: readonly string[],
  fabricId: string,
): string[] {
  const allowed = new Set(TITAN_FABRIC_CATALOG.filter(fabric => fabric.kind === kind).map(fabric => fabric.id));
  if (!allowed.has(fabricId)) return selectedIds.filter(id => allowed.has(id)).slice(0, 2);
  const clean = [...new Set(selectedIds.filter(id => allowed.has(id)))].slice(0, 2);
  if (clean.includes(fabricId)) return clean.filter(id => id !== fabricId);
  if (clean.length === 2) return clean;
  return [...clean, fabricId];
}
