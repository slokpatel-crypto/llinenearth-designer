import {
  MODEL_LAYER_PLAN_VERSION, MODEL_LAYER_SLOTS, resolveModelLayerPlan,
  type ModelLayerSlot, type OutfitComposition,
} from "./model-layer-contract.ts";

/** Engineering-only logical editing; never loads/approves a garment or changes a saved Designer. */
export type EditableModelLayerPlan = Readonly<{
  version: typeof MODEL_LAYER_PLAN_VERSION;
  composition: OutfitComposition;
  layers: readonly ModelLayerSlot[];
}>;
export type ModelLayerEditResult = Readonly<{
  applied: boolean;
  changed: boolean;
  plan: EditableModelLayerPlan | null;
  addedSlots: readonly ModelLayerSlot[];
  removedSlots: readonly ModelLayerSlot[];
  productionApproved: false;
  reasons: readonly string[];
}>;
export const MODEL_LAYER_EDIT_VERSION = 1 as const;
const MAX_ACTIONS = MODEL_LAYER_SLOTS.length + 1;
const SLOT_IDS = new Set<string>(MODEL_LAYER_SLOTS.map(layer => layer.slot));

/**
 * Apply explicit changes as ONE transaction. No implicit prerequisite addition,
 * dependent removal, suit downgrade, body swap or partial update. A caller can
 * select related garments and composition in the same batch. Incompatible
 * edits return the previous normalized plan; corrupt previous state returns null.
 * Valid output is exactly the existing v1 plan format, so no migration is needed.
 */
export function applyModelLayerEdits(current: unknown, request: unknown): ModelLayerEditResult {
  const previous = resolveModelLayerPlan(current);
  const normalized: EditableModelLayerPlan | null = previous.valid && previous.composition ? {
    version: MODEL_LAYER_PLAN_VERSION, composition: previous.composition,
    layers: previous.layers.map(layer => layer.slot),
  } : null;
  const reject = (reasons: readonly string[]): ModelLayerEditResult => ({
    applied: false, changed: false, plan: normalized, addedSlots: [], removedSlots: [],
    productionApproved: false, reasons,
  });
  if (!normalized) return reject(previous.reasons);
  if (!request || typeof request !== "object" || Array.isArray(request)) return reject(["Edit transaction must be an object."]);
  const raw = request as Record<string, unknown>;
  if (Object.keys(raw).sort().join(",") !== "actions,version" || raw.version !== MODEL_LAYER_EDIT_VERSION
    || !Array.isArray(raw.actions) || raw.actions.length === 0 || raw.actions.length > MAX_ACTIONS) {
    return reject(["Unsupported edit transaction fields, version or action count."]);
  }
  const selected = new Set(normalized.layers);
  const touched = new Set<string>();
  let composition: unknown = normalized.composition;
  for (const action of raw.actions) {
    if (!action || typeof action !== "object" || Array.isArray(action)) return reject(["Each edit must be an object."]);
    const edit = action as Record<string, unknown>;
    if (edit.type === "set-slot" && Object.keys(edit).sort().join(",") === "selected,slot,type"
      && typeof edit.slot === "string" && SLOT_IDS.has(edit.slot) && typeof edit.selected === "boolean") {
      if (touched.has(edit.slot)) return reject(["A garment slot may be changed only once per transaction."]);
      touched.add(edit.slot);
      if (edit.selected) selected.add(edit.slot as ModelLayerSlot);
      else selected.delete(edit.slot as ModelLayerSlot);
    } else if (edit.type === "set-composition" && Object.keys(edit).sort().join(",") === "composition,type") {
      if (touched.has("composition")) return reject(["Composition may be changed only once per transaction."]);
      touched.add("composition"); composition = edit.composition;
    } else return reject(["Unknown edit, slot, selection value or injected field."]);
  }
  const next = resolveModelLayerPlan({ version: MODEL_LAYER_PLAN_VERSION, composition, layers: [...selected] });
  if (!next.valid || !next.composition) return reject(next.reasons);
  const layers = next.layers.map(layer => layer.slot);
  const addedSlots = layers.filter(slot => !normalized.layers.includes(slot));
  const removedSlots = normalized.layers.filter(slot => !layers.includes(slot));
  return {
    applied: true, changed: addedSlots.length > 0 || removedSlots.length > 0 || next.composition !== normalized.composition,
    plan: { version: MODEL_LAYER_PLAN_VERSION, composition: next.composition, layers },
    addedSlots, removedSlots, productionApproved: false, reasons: [],
  };
}
