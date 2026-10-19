import { TITAN_FABRIC_CATALOG } from "./fabric-handoff.ts";

/**
 * Device-only, opt-in bookmark collection of PUBLIC catalogue references.
 * This is not a customer design, logged-in save, reservation, inventory,
 * physical colour/fit approval or server-synced order record.
 */
export const TITAN_LOOKBOOK_KEY = "linen-earth:titan-reference-lookbook:v1";
export const TITAN_LOOKBOOK_LIMIT = 6;
const VERSION = 1;
const MAX_STORED_BYTES = 4096;
const SHIRTS = new Set(TITAN_FABRIC_CATALOG.filter(item => item.kind === "shirt").map(item => item.id));
const TROUSERS = new Set(TITAN_FABRIC_CATALOG.filter(item => item.kind === "trouser").map(item => item.id));

export type TitanLookbookPair = Readonly<{ shirtId: string; trouserId: string }>;

function validPair(value: unknown): TitanLookbookPair | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).sort().join(",") !== "shirtId,trouserId") return null;
  if (typeof item.shirtId !== "string" || typeof item.trouserId !== "string") return null;
  if (!SHIRTS.has(item.shirtId) || !TROUSERS.has(item.trouserId)) return null;
  return { shirtId: item.shirtId, trouserId: item.trouserId };
}

/** Drop duplicates, extra fields, swapped roles and references now missing. */
export function cleanTitanLookbook(input: unknown): TitanLookbookPair[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: TitanLookbookPair[] = [];
  for (const raw of input.slice(0, 64)) {
    const pair = validPair(raw);
    if (!pair) continue;
    const key = `${pair.shirtId}\0${pair.trouserId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(pair);
    if (result.length >= TITAN_LOOKBOOK_LIMIT) break;
  }
  return result;
}

/** Fail closed for unknown schema/version or oversized/corrupt browser data. */
export function readTitanLookbook(raw: string | null): TitanLookbookPair[] {
  if (!raw || raw.length > MAX_STORED_BYTES) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    const envelope = parsed as Record<string, unknown>;
    if (Object.keys(envelope).sort().join(",") !== "pairs,version" || envelope.version !== VERSION) return [];
    return cleanTitanLookbook(envelope.pairs);
  } catch {
    return [];
  }
}

export function serializeTitanLookbook(input: readonly TitanLookbookPair[]): string {
  return JSON.stringify({ version: VERSION, pairs: cleanTitanLookbook(input) });
}

/** Add a genuine pair only on an explicit customer click; never evict old choices. */
export function addTitanLookbookPair(
  existing: readonly TitanLookbookPair[], input: unknown,
): TitanLookbookPair[] {
  const clean = cleanTitanLookbook(existing);
  const pair = validPair(input);
  if (!pair || clean.length >= TITAN_LOOKBOOK_LIMIT
    || clean.some(item => item.shirtId === pair.shirtId && item.trouserId === pair.trouserId)) {
    return clean;
  }
  return [...clean, pair];
}

export function removeTitanLookbookPair(
  existing: readonly TitanLookbookPair[], input: unknown,
): TitanLookbookPair[] {
  const clean = cleanTitanLookbook(existing);
  const pair = validPair(input);
  if (!pair) return clean;
  return clean.filter(item => item.shirtId !== pair.shirtId || item.trouserId !== pair.trouserId);
}
