import {
  MODEL_LAYER_PLAN_VERSION, MODEL_LAYER_SLOTS, resolveModelLayerPlan,
  type ModelLayerSlot, type OutfitComposition,
} from "../designer/model-layer-contract.ts";
import type { EditableModelLayerPlan } from "../designer/model-layer-edits.ts";

/**
 * Editorial compatibility guidance for the UNRELEASED logical outfit planner.
 * Candidate plans use only the existing seven slot IDs and are validated by
 * the authoritative model-layer contract. Nothing here loads geometry, edits
 * measured fit, writes a saved design, or approves a physical garment.
 */
export type TitanLayerRepair = Readonly<{
  plan: EditableModelLayerPlan;
  add: readonly ModelLayerSlot[];
  remove: readonly ModelLayerSlot[];
  compositionChanged: boolean;
  description: string;
}>;
export type TitanLayerGuidance = Readonly<{
  valid: boolean;
  reasons: readonly string[];
  suggestions: readonly TitanLayerRepair[];
}>;

const COMPOSITIONS: readonly OutfitComposition[] = [
  "separates", "two-piece-suit", "three-piece-suit",
];
const SLOT_IDS: ReadonlySet<string> = new Set(MODEL_LAYER_SLOTS.map(item => item.slot));

/**
 * Malformed, injected, future-version or ambiguous input is never used to
 * propose a repair: advice cannot become a backdoor schema importer.
 * Semantic errors (missing prerequisites, wrong suit type) are permitted only
 * after strict syntactic validation, so the customer may review safe options.
 */
function isEditableDraft(value: unknown): value is EditableModelLayerPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const raw = value as Record<string, unknown>;
  return Object.keys(raw).sort().join(",") === "composition,layers,version"
    && raw.version === MODEL_LAYER_PLAN_VERSION
    && COMPOSITIONS.includes(raw.composition as OutfitComposition)
    && Array.isArray(raw.layers)
    && raw.layers.length <= MODEL_LAYER_SLOTS.length
    && raw.layers.every(slot => typeof slot === "string" && SLOT_IDS.has(slot))
    && new Set(raw.layers).size === raw.layers.length;
}

function descriptionOf(
  add: readonly ModelLayerSlot[], remove: readonly ModelLayerSlot[],
  composition: OutfitComposition, changed: boolean,
): string {
  const pieces: string[] = [];
  if (add.length) pieces.push("Add " + add.join(", "));
  if (remove.length) pieces.push("Remove " + remove.join(", "));
  if (changed) pieces.push("Switch to " + composition.replaceAll("-", " "));
  return pieces.join(" · ");
}

/**
 * Bounded exhaustive search: just 3 x 2^7 candidate combinations.
 * Prioritize the fewest explicit changes, then preserving existing selected
 * garments rather than silently dropping an accessory. All fixes remain
 * unapplied until the user explicitly stages one AND presses Apply.
 */
export function guideTitanLayerDraft(input: unknown): TitanLayerGuidance {
  if (!isEditableDraft(input)) {
    return { valid: false, reasons: ["Unsupported layer draft; no automatic repair is available."], suggestions: [] };
  }
  const current = resolveModelLayerPlan(input);
  if (current.valid) return { valid: true, reasons: [], suggestions: [] };
  const currentSlots = new Set(input.layers);
  const candidates: Array<TitanLayerRepair & { distance: number; ordinal: number }> = [];
  let ordinal = 0;
  for (const composition of COMPOSITIONS) {
    for (let mask = 1; mask < 1 << MODEL_LAYER_SLOTS.length; mask++) {
      const layers = MODEL_LAYER_SLOTS.filter((_, i) => (mask & (1 << i)) !== 0).map(item => item.slot);
      const candidate = resolveModelLayerPlan({ version: MODEL_LAYER_PLAN_VERSION, composition, layers });
      if (!candidate.valid) continue;
      const add = layers.filter(slot => !currentSlots.has(slot));
      const remove = input.layers.filter(slot => !layers.includes(slot));
      const compositionChanged = composition !== input.composition;
      const distance = add.length + remove.length + Number(compositionChanged);
      if (!distance) continue;
      candidates.push({
        plan: { version: MODEL_LAYER_PLAN_VERSION, composition, layers },
        add, remove, compositionChanged, distance, ordinal: ordinal++,
        description: descriptionOf(add, remove, composition, compositionChanged),
      });
    }
  }
  candidates.sort((a, b) =>
    a.distance - b.distance
    || a.remove.length - b.remove.length
    || Number(a.compositionChanged) - Number(b.compositionChanged)
    || a.ordinal - b.ordinal);
  // Showing large unrelated transformations would mislead. One additional
  // explicit change beyond the minimum is the maximum permissible advice.
  const minimum = candidates[0]?.distance ?? 0;
  const suggestions = candidates.filter(item => item.distance <= minimum + 1).slice(0, 3)
    .map(({ plan, add, remove, compositionChanged, description }) => ({
      plan, add, remove, compositionChanged, description,
    }));
  return { valid: false, reasons: [...current.reasons], suggestions };
}
