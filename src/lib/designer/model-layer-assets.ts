import {
  LINEN_EARTH_MODEL_IDENTITY_ID, LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM,
} from "./model-identity.ts";
import { MODEL_LAYER_SLOTS, type ModelLayerSlot } from "./model-layer-contract.ts";

/**
 * Strict registration format for FUTURE separate mesh files. This validates
 * metadata only. Never load an asset or interpret self-reported metadata as
 * native geometry, photo parity, UV, collision or tailor approval.
 */
export const MODEL_LAYER_ASSET_VERSION = 1 as const;
export type LayerAssetCandidate = Readonly<{
  version: typeof MODEL_LAYER_ASSET_VERSION;
  slot: Exclude<ModelLayerSlot, "shirt" | "trouser">;
  modelIdentityId: typeof LINEN_EARTH_MODEL_IDENTITY_ID;
  referenceHeightMm: typeof LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM;
  coordinateSpace: "locked-model-local";
  anchor: "torso" | "pelvis" | "neck" | "blazer-chest";
  glbPath: string;
  materialSlots: readonly string[];
  state: "engineering-candidate";
}>;

export type LayerAssetInspection = Readonly<{
  valid: boolean;
  candidate: LayerAssetCandidate | null;
  /** Passing JSON checks can NEVER approve an uninspected 3D asset. */
  productionApproved: false;
  reasons: readonly string[];
}>;

const EXTENSION_SLOTS = MODEL_LAYER_SLOTS.filter(item => item.implementation === "new-asset-required");
const ALLOWED_KEYS = [
  "anchor", "coordinateSpace", "glbPath", "materialSlots", "modelIdentityId",
  "referenceHeightMm", "slot", "state", "version",
].sort().join(",");

const PATH_MAX_LENGTH = 200;
const MATERIAL_MAX_COUNT = 24;

/** Reject remote GLBs, traversal, uploaded body swaps and base-layer remapping. */
export function inspectModelLayerAssetRegistration(value: unknown): LayerAssetInspection {
  const reject = (reason: string): LayerAssetInspection => ({
    valid: false, candidate: null, productionApproved: false, reasons: [reason],
  });
  if (!value || typeof value !== "object" || Array.isArray(value)) return reject("Asset registration must be an object.");
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).sort().join(",") !== ALLOWED_KEYS || raw.version !== MODEL_LAYER_ASSET_VERSION) {
    return reject("Unsupported asset registration schema.");
  }
  const slot = EXTENSION_SLOTS.find(item => item.slot === raw.slot);
  if (!slot) return reject("Only future garment extension slots can be registered.");
  if (raw.modelIdentityId !== LINEN_EARTH_MODEL_IDENTITY_ID
    || raw.referenceHeightMm !== LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM
    || raw.coordinateSpace !== "locked-model-local") {
    return reject("Extension geometry must target the unchanged canonical model frame.");
  }
  if (raw.anchor !== slot.anchor) return reject("Attachment anchor does not match its garment slot.");
  if (raw.state !== "engineering-candidate") return reject("Unverified extension assets cannot be activated or approved.");
  const path = raw.glbPath;
  if (typeof path !== "string" || path.length > PATH_MAX_LENGTH
    || !new RegExp("^/models/garment-extensions/" + slot.slot + "/[a-z0-9-]+\\.glb$").test(path)) {
    return reject("Asset must be a local, slot-scoped GLB path without query strings or traversal.");
  }
  if (!Array.isArray(raw.materialSlots) || raw.materialSlots.length === 0
    || raw.materialSlots.length > MATERIAL_MAX_COUNT) {
    return reject("Extension must declare between 1 and 24 independent material slots.");
  }
  const prefix = "LAYER_" + slot.slot.toUpperCase().replace(/-/g, "_") + "_";
  if (!raw.materialSlots.every(item =>
    typeof item === "string" && item.length <= 80
    && item.startsWith(prefix) && /^[A-Z][A-Z0-9_]+$/.test(item)
  ) || new Set(raw.materialSlots).size !== raw.materialSlots.length) {
    return reject("Extension material slots must be distinct and namespaced to the garment.");
  }
  return {
    valid: true,
    candidate: {
      version: MODEL_LAYER_ASSET_VERSION,
      slot: slot.slot as LayerAssetCandidate["slot"],
      modelIdentityId: LINEN_EARTH_MODEL_IDENTITY_ID,
      referenceHeightMm: LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM,
      coordinateSpace: "locked-model-local",
      anchor: slot.anchor,
      glbPath: path,
      materialSlots: [...raw.materialSlots],
      state: "engineering-candidate",
    },
    productionApproved: false,
    reasons: ["Candidate registration only: native mesh, rig, UV, cloth clearance, performance and owner/tailor evidence still required."],
  };
}
