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

/**
 * Fail-closed: accepting a link replaces ONE requested garment's fabric only,
 * never a saved trouser/shirt counterpart, measurement, cut or account record.
 * A Style Director / other deep link cannot masquerade as this fabric handoff.
 */
export function readTitanFabricHandoff(search: string): { kind: TitanFabricKind; fabricId: string } | null {
  const params = new URLSearchParams(search);
  if ([...params.keys()].some(key => !["source", "kind", "fabric"].includes(key))) return null;
  if (["source", "kind", "fabric"].some(key => params.getAll(key).length !== 1)) return null;
  if (params.get("source") !== "titan") return null;
  const kind = params.get("kind");
  const fabricId = params.get("fabric");
  if (kind !== "shirt" && kind !== "trouser") return null;
  if (!fabricId || !TITAN_FABRIC_CATALOG.some(fabric => fabric.kind === kind && fabric.id === fabricId)) return null;
  return { kind, fabricId };
}
