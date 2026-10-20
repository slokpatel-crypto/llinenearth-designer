import { LINEN_EARTH_MODEL_IDENTITY_ID } from "./model-identity.ts";

/**
 * Logical garment layering on the ONE locked Linen Earth mannequin.
 * No layer here contains geometry, replaces the body, certifies drape, or
 * enables a new garment in the 3D viewer. Asset release has independent gates.
 */
export const MODEL_LAYER_PLAN_VERSION = 1 as const;

export type OutfitComposition = "separates" | "two-piece-suit" | "three-piece-suit";
export type ModelLayerSlot =
  | "shirt" | "trouser" | "belt" | "tie" | "waistcoat" | "blazer" | "pocket-square";

export type ModelLayerDescriptor = Readonly<{
  slot: ModelLayerSlot;
  anchor: "torso" | "pelvis" | "neck" | "blazer-chest";
  order: number;
  prerequisites: readonly ModelLayerSlot[];
  implementation: "existing-preview" | "new-asset-required";
}>;

/**
 * Order reflects garment overlap, NOT body geometry changes.
 * A suit is a composition of blazer + trouser (+ waistcoat), never an
 * additional whole-body mesh over a trouser or a separate human model.
 */
export const MODEL_LAYER_SLOTS: readonly ModelLayerDescriptor[] = Object.freeze(([
  { slot: "shirt", anchor: "torso", order: 10, prerequisites: [], implementation: "existing-preview" },
  { slot: "trouser", anchor: "pelvis", order: 15, prerequisites: [], implementation: "existing-preview" },
  { slot: "belt", anchor: "pelvis", order: 20, prerequisites: ["trouser"], implementation: "new-asset-required" },
  { slot: "tie", anchor: "neck", order: 25, prerequisites: ["shirt"], implementation: "new-asset-required" },
  { slot: "waistcoat", anchor: "torso", order: 30, prerequisites: ["shirt"], implementation: "new-asset-required" },
  { slot: "blazer", anchor: "torso", order: 40, prerequisites: ["shirt"], implementation: "new-asset-required" },
  { slot: "pocket-square", anchor: "blazer-chest", order: 50, prerequisites: ["blazer"], implementation: "new-asset-required" },
] satisfies ModelLayerDescriptor[]).map(descriptor => Object.freeze({
  ...descriptor, prerequisites: Object.freeze([...descriptor.prerequisites]),
})));

const SLOT_BY_ID = new Map<ModelLayerSlot, ModelLayerDescriptor>(
  MODEL_LAYER_SLOTS.map(descriptor => [descriptor.slot, descriptor]),
);
const COMPOSITIONS: readonly OutfitComposition[] = ["separates", "two-piece-suit", "three-piece-suit"];

export type ModelLayerPlan = Readonly<{
  valid: boolean;
  version: typeof MODEL_LAYER_PLAN_VERSION;
  modelIdentityId: typeof LINEN_EARTH_MODEL_IDENTITY_ID;
  composition: OutfitComposition | null;
  layers: readonly ModelLayerDescriptor[];
  missingAssetSlots: readonly ModelLayerSlot[];
  /** A valid logical outfit is NOT production-model/fit/UV approval. */
  productionApproved: false;
  reasons: readonly string[];
}>;

function invalid(reason: string): ModelLayerPlan {
  return {
    valid: false, version: MODEL_LAYER_PLAN_VERSION,
    modelIdentityId: LINEN_EARTH_MODEL_IDENTITY_ID,
    composition: null, layers: [], missingAssetSlots: [],
    productionApproved: false, reasons: [reason],
  };
}

/**
 * Fail-closed import format. Only a versioned, exact list of known slot IDs is
 * accepted. No remote asset URL, generated geometry, measurements, model ID,
 * customer identifiers or material/stock assertion is allowed in this plan.
 */
export function resolveModelLayerPlan(input: unknown): ModelLayerPlan {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return invalid("Layer plan must be an object.");
  }
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).sort().join(",") !== "composition,layers,version"
    || raw.version !== MODEL_LAYER_PLAN_VERSION) {
    return invalid("Layer plan has unsupported fields or version.");
  }
  if (!COMPOSITIONS.includes(raw.composition as OutfitComposition)) {
    return invalid("Unsupported outfit composition.");
  }
  const composition = raw.composition as OutfitComposition;
  if (!Array.isArray(raw.layers) || raw.layers.length > MODEL_LAYER_SLOTS.length
    || !Array.from(raw.layers).every(item => typeof item === "string" && SLOT_BY_ID.has(item as ModelLayerSlot))
    || new Set(raw.layers).size !== raw.layers.length) {
    return invalid("Layers must be distinct known garment slots.");
  }

  const selected = new Set<ModelLayerSlot>(raw.layers as ModelLayerSlot[]);
  const ordered = MODEL_LAYER_SLOTS.filter(descriptor => selected.has(descriptor.slot));
  const reasons: string[] = [];
  for (const descriptor of ordered) {
    for (const prerequisite of descriptor.prerequisites) {
      if (!selected.has(prerequisite)) {
        reasons.push(descriptor.slot + " requires " + prerequisite + ".");
      }
    }
  }
  if (composition !== "separates") {
    for (const required of ["shirt", "trouser", "blazer"] as const) {
      if (!selected.has(required)) reasons.push(composition + " requires " + required + ".");
    }
    if (composition === "three-piece-suit" && !selected.has("waistcoat")) {
      reasons.push("Three-piece suit requires waistcoat.");
    }
    if (composition === "two-piece-suit" && selected.has("waistcoat")) {
      reasons.push("Choose three-piece-suit for a suit with waistcoat.");
    }
  }
  if (!selected.size) reasons.push("Choose at least one garment.");
  return {
    valid: reasons.length === 0, version: MODEL_LAYER_PLAN_VERSION,
    modelIdentityId: LINEN_EARTH_MODEL_IDENTITY_ID,
    composition, layers: ordered,
    missingAssetSlots: ordered.filter(item => item.implementation === "new-asset-required").map(item => item.slot),
    productionApproved: false, reasons,
  };
}
