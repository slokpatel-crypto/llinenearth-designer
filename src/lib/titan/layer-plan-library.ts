import {
  MODEL_LAYER_PLAN_VERSION, resolveModelLayerPlan,
} from "../designer/model-layer-contract.ts";
import type { EditableModelLayerPlan } from "../designer/model-layer-edits.ts";

/**
 * Optional, device-only bookmarks of LOGICAL outfit plans. This deliberately
 * stores no body, material, garment asset, personal measurement or customer
 * identifier. Importing a plan never approves or loads a GLB.
 */
export const TITAN_LAYER_PLANS_KEY = "linen-earth:titan-layer-plans:v1";
export const TITAN_LAYER_PLANS_LIMIT = 6;
const MAX_STORED_CHARS = 2048;
const VERSION = 1;

export type TitanLayerPlanLibraryRead = Readonly<{
  ok: boolean;
  plans: readonly EditableModelLayerPlan[];
}>;

function validPlan(raw: unknown): EditableModelLayerPlan | null {
  const validated = resolveModelLayerPlan(raw);
  if (!validated.valid || !validated.composition || !raw || typeof raw !== "object"
    || Array.isArray(raw)) return null;
  const layers = validated.layers.map(item => item.slot);
  const requested = (raw as { layers?: unknown }).layers;
  // Enforce canonical ordering as well as schema, preventing alternate encodings
  // of the same plan, duplicate bookmarks and ambiguous restore behaviour.
  if (!Array.isArray(requested) || requested.length !== layers.length
    || !layers.every((slot, index) => requested[index] === slot)) return null;
  return {
    version: MODEL_LAYER_PLAN_VERSION,
    composition: validated.composition,
    layers,
  };
}

function keyOf(plan: EditableModelLayerPlan): string {
  return JSON.stringify([plan.composition, plan.layers]);
}

/**
 * Null is a genuinely empty store. Any nonempty corrupt or newer store is
 * rejected *in full* so a user cannot accidentally overwrite unknown data.
 */
export function readTitanLayerPlanLibrary(raw: string | null): TitanLayerPlanLibraryRead {
  if (raw === null) return { ok: true, plans: [] };
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_STORED_CHARS) {
    return { ok: false, plans: [] };
  }
  try {
    const decoded: unknown = JSON.parse(raw);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      return { ok: false, plans: [] };
    }
    const record = decoded as Record<string, unknown>;
    if (Object.keys(record).sort().join(",") !== "plans,version"
      || record.version !== VERSION || !Array.isArray(record.plans)
      || record.plans.length > TITAN_LAYER_PLANS_LIMIT) {
      return { ok: false, plans: [] };
    }
    const plans: EditableModelLayerPlan[] = [];
    const seen = new Set<string>();
    for (const item of record.plans) {
      const plan = validPlan(item);
      if (!plan || seen.has(keyOf(plan))) return { ok: false, plans: [] };
      seen.add(keyOf(plan));
      plans.push(plan);
    }
    return { ok: true, plans };
  } catch {
    return { ok: false, plans: [] };
  }
}

export function serializeTitanLayerPlanLibrary(plans: readonly EditableModelLayerPlan[]): string {
  if (!Array.isArray(plans) || plans.length > TITAN_LAYER_PLANS_LIMIT) {
    throw new Error("Invalid saved layer-plan collection.");
  }
  const normalized = plans.map(validPlan);
  if (normalized.some(item => item === null)) {
    throw new Error("Cannot save an invalid garment plan.");
  }
  const clean = normalized as EditableModelLayerPlan[];
  if (new Set(clean.map(keyOf)).size !== clean.length) {
    throw new Error("Duplicate garment plans cannot be saved.");
  }
  const encoded = JSON.stringify({ version: VERSION, plans: clean });
  if (encoded.length > MAX_STORED_CHARS) throw new Error("Saved plans exceed storage limit.");
  return encoded;
}

/** Add only an explicitly chosen, fully valid plan; never silently evict one. */
export function addTitanLayerPlan(
  current: readonly EditableModelLayerPlan[], proposal: unknown,
): { changed: boolean; plans: readonly EditableModelLayerPlan[]; reason: string } {
  const plan = validPlan(proposal);
  if (!plan) return { changed: false, plans: current, reason: "Invalid layer plan cannot be saved." };
  // Fail closed if the caller supplied corrupt state, not merely a plausible
  // subset of it. Neither mutating nor repairing stored data is implicit.
  try { serializeTitanLayerPlanLibrary(current); } catch {
    return { changed: false, plans: current, reason: "Existing saved plans are invalid." };
  }
  if (current.some(item => keyOf(item) === keyOf(plan))) {
    return { changed: false, plans: current, reason: "This layer plan is already saved." };
  }
  if (current.length >= TITAN_LAYER_PLANS_LIMIT) {
    return { changed: false, plans: current, reason: "Six saved plans maximum. Remove one to add another." };
  }
  return { changed: true, plans: [...current, plan], reason: "" };
}

export function removeTitanLayerPlan(
  current: readonly EditableModelLayerPlan[], target: unknown,
): { changed: boolean; plans: readonly EditableModelLayerPlan[] } {
  const plan = validPlan(target);
  try { serializeTitanLayerPlanLibrary(current); } catch {
    return { changed: false, plans: current };
  }
  if (!plan) return { changed: false, plans: current };
  const result = current.filter(item => keyOf(item) !== keyOf(plan));
  return { changed: result.length !== current.length, plans: result };
}
