import {
  MODEL_LAYER_PLAN_VERSION, resolveModelLayerPlan,
  type ModelLayerSlot,
} from "../designer/model-layer-contract.ts";
import type { EditableModelLayerPlan } from "../designer/model-layer-edits.ts";

/**
 * In-memory-only applied garment-plan history. This is deliberately separate
 * from saved Designer data, device bookmarks, model assets and browser storage.
 * Only canonical, validated logical layer IDs may enter a history frame.
 */
export const TITAN_PLAN_HISTORY_DEPTH = 12;
export type TitanPlanHistory = Readonly<{
  current: EditableModelLayerPlan;
  undo: readonly EditableModelLayerPlan[];
  redo: readonly EditableModelLayerPlan[];
}>;

function exactCanonicalPlan(input: unknown): EditableModelLayerPlan | null {
  const checked = resolveModelLayerPlan(input);
  if (!checked.valid || !checked.composition) return null;
  const raw = input as { layers: readonly ModelLayerSlot[] };
  const canonical = checked.layers.map(item => item.slot);
  if (raw.layers.length !== canonical.length || canonical.some((slot, index) => raw.layers[index] !== slot)) {
    return null;
  }
  return { version: MODEL_LAYER_PLAN_VERSION, composition: checked.composition, layers: canonical };
}

function readHistory(value: unknown): TitanPlanHistory | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).sort().join(",") !== "current,redo,undo"
    || !Array.isArray(raw.undo) || !Array.isArray(raw.redo)
    || raw.undo.length > TITAN_PLAN_HISTORY_DEPTH || raw.redo.length > TITAN_PLAN_HISTORY_DEPTH) return null;
  const current = exactCanonicalPlan(raw.current);
  if (!current) return null;
  const undo: EditableModelLayerPlan[] = [];
  const redo: EditableModelLayerPlan[] = [];
  // for-of deliberately visits sparse array holes as undefined: reject all,
  // rather than silently dropping a missing or malformed history entry.
  for (const item of raw.undo) {
    const plan = exactCanonicalPlan(item);
    if (!plan) return null;
    undo.push(plan);
  }
  for (const item of raw.redo) {
    const plan = exactCanonicalPlan(item);
    if (!plan) return null;
    redo.push(plan);
  }
  return { current, undo, redo };
}

function samePlan(a: EditableModelLayerPlan, b: EditableModelLayerPlan) {
  return a.composition === b.composition && a.layers.length === b.layers.length
    && a.layers.every((layer, index) => layer === b.layers[index]);
}

/** Invalid or injected initial states never become a history. */
export function createTitanPlanHistory(initial: unknown): TitanPlanHistory | null {
  const current = exactCanonicalPlan(initial);
  return current ? { current, undo: [], redo: [] } : null;
}

/** Successful commits/reset become reversible; no-ops preserve the redo path. */
export function recordTitanPlanHistory(history: unknown, requested: unknown): TitanPlanHistory | null {
  const previous = readHistory(history);
  const next = exactCanonicalPlan(requested);
  if (!previous || !next) return null;
  if (samePlan(previous.current, next)) return previous;
  return {
    current: next,
    undo: [...previous.undo, previous.current].slice(-TITAN_PLAN_HISTORY_DEPTH),
    redo: [],
  };
}

/** Undo never mutates the incoming history or bypasses the canonical plan validator. */
export function undoTitanPlanHistory(history: unknown): TitanPlanHistory | null {
  const previous = readHistory(history);
  if (!previous?.undo.length) return null;
  return {
    current: previous.undo[previous.undo.length - 1],
    undo: previous.undo.slice(0, -1),
    redo: [...previous.redo, previous.current].slice(-TITAN_PLAN_HISTORY_DEPTH),
  };
}

/** Redo is available only until a genuinely different plan is committed. */
export function redoTitanPlanHistory(history: unknown): TitanPlanHistory | null {
  const previous = readHistory(history);
  if (!previous?.redo.length) return null;
  return {
    current: previous.redo[previous.redo.length - 1],
    undo: [...previous.undo, previous.current].slice(-TITAN_PLAN_HISTORY_DEPTH),
    redo: previous.redo.slice(0, -1),
  };
}
