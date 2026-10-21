import {
  MODEL_LAYER_SLOTS, MODEL_LAYER_PLAN_VERSION, resolveModelLayerPlan,
  type ModelLayerSlot, type OutfitComposition,
} from "../designer/model-layer-contract.ts";
import type { EditableModelLayerPlan } from "../designer/model-layer-edits.ts";

/**
 * Pure, local review of requested garment-slot changes. Existing model identity
 * and v1 composition rules remain authoritative. Nothing in this review is a
 * render, textile property, physical fit result or production permission.
 */
export type TitanLayerPlanReview = Readonly<{
  valid: boolean;
  changed: boolean;
  additions: readonly ModelLayerSlot[];
  removals: readonly ModelLayerSlot[];
  compositionFrom: OutfitComposition | null;
  compositionTo: OutfitComposition | null;
  /** ALL selected layers needing a separate, independently approved 3D asset. */
  unverifiedAssetSlots: readonly ModelLayerSlot[];
  /** Newly selected layers needing an unverified asset. */
  newAssetSlots: readonly ModelLayerSlot[];
  reasons: readonly string[];
  productionApproved: false;
}>;

export function reviewTitanLayerChanges(current: unknown, requested: unknown): TitanLayerPlanReview {
  const before = resolveModelLayerPlan(current);
  const after = resolveModelLayerPlan(requested);
  // Untrusted plans are never compared as if they were previously approved.
  const valid = before.valid && after.valid && before.composition !== null && after.composition !== null;
  const reasons = !before.valid ? ["The applied plan is invalid.", ...before.reasons] : [...after.reasons];
  if (!valid) {
    return {
      valid: false, changed: false, additions: [], removals: [],
      compositionFrom: before.valid ? before.composition : null,
      compositionTo: after.valid ? after.composition : null,
      unverifiedAssetSlots: [], newAssetSlots: [], reasons, productionApproved: false,
    };
  }
  const beforeSlots = before.layers.map(item => item.slot);
  const afterSlots = after.layers.map(item => item.slot);
  const additions = afterSlots.filter(slot => !beforeSlots.includes(slot));
  const removals = beforeSlots.filter(slot => !afterSlots.includes(slot));
  return {
    valid: true,
    changed: additions.length > 0 || removals.length > 0 || before.composition !== after.composition,
    additions, removals,
    compositionFrom: before.composition,
    compositionTo: after.composition,
    unverifiedAssetSlots: [...after.missingAssetSlots],
    newAssetSlots: additions.filter(slot =>
      MODEL_LAYER_SLOTS.find(layer => layer.slot === slot)?.implementation === "new-asset-required"),
    reasons: [], productionApproved: false,
  };
}

/** Exact schema helper for UI callers: no user-provided assets or measurements. */
export function titanLayerReviewDraft(
  composition: OutfitComposition, layers: readonly ModelLayerSlot[],
): EditableModelLayerPlan {
  return { version: MODEL_LAYER_PLAN_VERSION, composition, layers: [...layers] };
}
