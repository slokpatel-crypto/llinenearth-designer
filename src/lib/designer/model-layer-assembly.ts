import { resolveModelLayerPlan, type ModelLayerPlan } from "./model-layer-contract.ts";
import { inspectModelLayerAssetRegistration, type LayerAssetCandidate } from "./model-layer-assets.ts";

export const MODEL_LAYER_ASSEMBLY_VERSION = 1 as const;
export type ModelLayerAssemblyInspection = Readonly<{
  valid: boolean;
  productionApproved: false;
  plan: ModelLayerPlan | null;
  candidates: readonly LayerAssetCandidate[];
  reasons: readonly string[];
}>;

/** Metadata-only bundle. Each selected extension requires one registration.
 * Shirt/trouser retain their existing model path and cannot be replaced here. */
export function inspectModelLayerAssembly(value: unknown): ModelLayerAssemblyInspection {
  const reject = (reason: string, plan: ModelLayerPlan | null = null): ModelLayerAssemblyInspection => ({
    valid: false, productionApproved: false, plan, candidates: [], reasons: [reason],
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) return reject("Assembly must be an object.");
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).sort().join(",") !== "assets,plan,version" || raw.version !== MODEL_LAYER_ASSEMBLY_VERSION) {
    return reject("Unsupported assembly fields or version.");
  }
  const plan = resolveModelLayerPlan(raw.plan);
  if (!plan.valid) return reject(plan.reasons.join(" "), plan);
  if (!Array.isArray(raw.assets) || raw.assets.length !== plan.missingAssetSlots.length) {
    return reject("Supply exactly one candidate registration per selected extension slot.", plan);
  }
  const candidates: LayerAssetCandidate[] = [];
  for (const value of raw.assets) {
    const inspection = inspectModelLayerAssetRegistration(value);
    if (!inspection.valid || !inspection.candidate) return reject(inspection.reasons.join(" "), plan);
    const candidate = inspection.candidate;
    if (!plan.missingAssetSlots.includes(candidate.slot) || candidates.some(item => item.slot === candidate.slot || item.glbPath === candidate.glbPath)) {
      return reject("Asset registrations must cover distinct selected extension slots only.", plan);
    }
    candidates.push(candidate);
  }
  return {
    valid: true, productionApproved: false, plan,
    candidates: plan.missingAssetSlots.map(slot => candidates.find(candidate => candidate.slot === slot)!),
    reasons: ["Assembly metadata only; inspect exact GLB bytes and independent native/physical release evidence."],
  };
}
