import {
  MODEL_LAYER_SLOTS, MODEL_LAYER_PLAN_VERSION, resolveModelLayerPlan,
  type OutfitComposition, type ModelLayerSlot,
} from "../designer/model-layer-contract.ts";
import type { EditableModelLayerPlan } from "../designer/model-layer-edits.ts";

/**
 * Public, deterministic and measurement-free references to garment LAYER IDs.
 * A link is an editorial planning hint, not a render, saved design, booking,
 * verified fit, or approval to load any 3D asset.
 *
 * v1-C-HH: composition index 0..2, canonical seven-layer bitmask in lower
 * case hexadecimal (00..7f). Changing the slot order requires a new version.
 */
export const TITAN_LAYER_SHARE_PARAMETER = "layer-plan";
const COMPOSITIONS: readonly OutfitComposition[] = [
  "separates", "two-piece-suit", "three-piece-suit",
];
const LAYER_ORDER: readonly ModelLayerSlot[] = MODEL_LAYER_SLOTS.map(item => item.slot);
const TOKEN = /^v1-([012])-([0-7][0-9a-f])$/;
const MAX_QUERY_LENGTH = 1024;

function canonicalPlan(raw: unknown): EditableModelLayerPlan | null {
  const check = resolveModelLayerPlan(raw);
  if (!check.valid || !check.composition || !raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const canonical = check.layers.map(item => item.slot);
  const supplied = (raw as { layers?: unknown }).layers;
  if (!Array.isArray(supplied) || supplied.length !== canonical.length
    || !canonical.every((slot, index) => slot === supplied[index])) return null;
  return {
    version: MODEL_LAYER_PLAN_VERSION,
    composition: check.composition,
    layers: canonical,
  };
}

export function encodeTitanLayerPlan(raw: unknown): string | null {
  const plan = canonicalPlan(raw);
  if (!plan) return null;
  const composition = COMPOSITIONS.indexOf(plan.composition);
  if (composition < 0) return null;
  const mask = LAYER_ORDER.reduce((bits, slot, index) =>
    plan.layers.includes(slot) ? bits | (1 << index) : bits, 0);
  return `v1-${composition}-${mask.toString(16).padStart(2, "0")}`;
}

export function titanLayerShareHref(input: unknown): string | null {
  const token = encodeTitanLayerPlan(input);
  return token ? `/titan?${TITAN_LAYER_SHARE_PARAMETER}=${token}` : null;
}

/**
 * Reject malformed/duplicate share tokens and any noncanonical encoding.
 * Other query fields belong to the separate existing fabric-reference share
 * journey and are deliberately ignored here, never copied into layer state.
 */
export function readTitanLayerShare(search: unknown): EditableModelLayerPlan | null {
  if (typeof search !== "string" || search.length > MAX_QUERY_LENGTH) return null;
  const params = new URLSearchParams(search);
  const values = params.getAll(TITAN_LAYER_SHARE_PARAMETER);
  if (values.length !== 1) return null;
  const match = TOKEN.exec(values[0]);
  if (!match) return null;
  const bits = parseInt(match[2], 16);
  if (bits === 0) return null;
  const plan: EditableModelLayerPlan = {
    version: MODEL_LAYER_PLAN_VERSION,
    composition: COMPOSITIONS[Number(match[1])],
    layers: LAYER_ORDER.filter((_, index) => (bits & (1 << index)) !== 0),
  };
  // One-to-one exact canonical representation. Invalid dependencies, fake
  // components or unapproved materials must never be auto-repaired.
  return encodeTitanLayerPlan(plan) === values[0] ? plan : null;
}
