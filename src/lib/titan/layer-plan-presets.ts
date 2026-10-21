import {
  MODEL_LAYER_PLAN_VERSION, MODEL_LAYER_SLOTS, resolveModelLayerPlan,
  type ModelLayerSlot, type OutfitComposition,
} from "../designer/model-layer-contract.ts";
import {
  applyModelLayerEdits, type EditableModelLayerPlan,
} from "../designer/model-layer-edits.ts";

/**
 * Deterministic, editorial starting points for the unreleased TITAN layer
 * planner. These are ONLY garment-slot compositions on the locked model, not
 * rendered outfits, styling/fit predictions, stock claims or asset approval.
 * Additions must be canonical, valid and reviewed before they are ever applied.
 */
const PRESETS = [
  {
    id: "essential-pair", title: "Shirt & trousers",
    description: "The two existing garment reference layers.",
    composition: "separates", layers: ["shirt", "trouser"],
  },
  {
    id: "belted-separates", title: "Belted separates",
    description: "Shirt, trousers and a separately verified belt layer.",
    composition: "separates", layers: ["shirt", "trouser", "belt"],
  },
  {
    id: "two-piece", title: "Two-piece suit",
    description: "Blazer over shirt and trousers; new blazer asset required.",
    composition: "two-piece-suit", layers: ["shirt", "trouser", "blazer"],
  },
  {
    id: "three-piece", title: "Three-piece suit",
    description: "Adds the waistcoat beneath the blazer.",
    composition: "three-piece-suit", layers: ["shirt", "trouser", "waistcoat", "blazer"],
  },
  {
    id: "full-layer-plan", title: "Full accessory layer plan",
    description: "Seven separate garment slots, including tie and pocket square.",
    composition: "three-piece-suit",
    layers: ["shirt", "trouser", "belt", "tie", "waistcoat", "blazer", "pocket-square"],
  },
] as const satisfies ReadonlyArray<{
  id: string; title: string; description: string;
  composition: OutfitComposition; layers: readonly ModelLayerSlot[];
}>;

export type TitanLayerPresetId = (typeof PRESETS)[number]["id"];
export const TITAN_LAYER_PRESET_CHOICES: ReadonlyArray<Readonly<{
  id: TitanLayerPresetId; title: string; description: string;
}>> = Object.freeze(PRESETS.map(({ id, title, description }) =>
  Object.freeze({ id, title, description })));

export type TitanLayerPresetPreview = Readonly<{
  id: TitanLayerPresetId;
  title: string;
  plan: EditableModelLayerPlan;
  added: readonly ModelLayerSlot[];
  removed: readonly ModelLayerSlot[];
  compositionChanged: boolean;
  changed: boolean;
  /** All unrenderable new-asset slots, not just slots added this time. */
  requiresUnverifiedAssets: readonly ModelLayerSlot[];
  productionApproved: false;
}>;

/**
 * Strictly reject unknown preset IDs or invalid existing plans. The preview
 * runs the SAME atomic editor as the Apply flow, including suit prerequisites;
 * no implicit prerequisite, auto-apply, localStorage or network writes.
 */
export function previewTitanLayerPreset(current: unknown, id: unknown): TitanLayerPresetPreview | null {
  const preset = typeof id === "string" ? PRESETS.find(item => item.id === id) : undefined;
  if (!preset) return null;
  const currentState = resolveModelLayerPlan(current);
  if (!currentState.valid || !currentState.composition) return null;
  const desired = resolveModelLayerPlan({
    version: MODEL_LAYER_PLAN_VERSION, composition: preset.composition, layers: [...preset.layers],
  });
  if (!desired.valid || !desired.composition
    || desired.layers.some((layer, i) => layer.slot !== preset.layers[i])) return null;

  const original = currentState.layers.map(item => item.slot);
  const desiredSlots = desired.layers.map(item => item.slot);
  const actions: Array<
    | { type: "set-slot"; slot: ModelLayerSlot; selected: boolean }
    | { type: "set-composition"; composition: OutfitComposition }
  > = MODEL_LAYER_SLOTS.flatMap(({ slot }) => {
    const selected = desiredSlots.includes(slot);
    return original.includes(slot) === selected
      ? [] : [{ type: "set-slot" as const, slot, selected }];
  });
  if (currentState.composition !== desired.composition) {
    actions.push({ type: "set-composition", composition: desired.composition });
  }
  const transaction = actions.length
    ? applyModelLayerEdits(current, { version: 1, actions })
    : null;
  if (transaction && (!transaction.applied || !transaction.plan)) return null;

  const plan: EditableModelLayerPlan = transaction?.plan ?? {
    version: MODEL_LAYER_PLAN_VERSION, composition: desired.composition, layers: desiredSlots,
  };
  return {
    id: preset.id, title: preset.title,
    plan: { version: plan.version, composition: plan.composition, layers: [...plan.layers] },
    added: desiredSlots.filter(slot => !original.includes(slot)),
    removed: original.filter(slot => !desiredSlots.includes(slot)),
    compositionChanged: currentState.composition !== desired.composition,
    changed: actions.length > 0,
    requiresUnverifiedAssets: [...desired.missingAssetSlots],
    productionApproved: false,
  };
}
