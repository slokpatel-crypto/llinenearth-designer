import { parseCustomerSavedDesignWrite } from "./customer-saved-design-wire.ts";
import { SAVED_DESIGNS_KEY, type SavedDesign } from "./saved-designs.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string";

/**
 * Cloud wire validation checks structure and ownership claims. Before adding
 * data to the local atelier screen, also check every property that its
 * rendering and handoff paths dereference. Reject incomplete recipes instead
 * of saving a record that can crash the screen on the next page load.
 */
function isUsableAtelierRecipe(brief: Record<string, unknown>, version: Record<string, unknown>, renderSet: Record<string, unknown>) {
  const fabric = brief.fabric;
  const context = brief.context;
  const candidate = version.candidate;
  const spec = renderSet.spec;
  if (!isRecord(fabric) || !isRecord(context) || !isRecord(candidate) || !isRecord(spec)) return false;
  if (!["occasion", "aesthetic", "venue", "environment", "formality", "time"].every(key => isText(context[key]))) return false;
  const profile = fabric.profile;
  const garments = candidate.garments;
  const renderFabric = spec.fabric;
  if (!isRecord(profile) || !isRecord(garments) || !isRecord(renderFabric)) return false;
  if (!Array.isArray(profile.observations) ||
      !profile.observations.every(item => isRecord(item) && isText(item.label) && isText(item.value)) ||
      !isText(profile.summary) || !isText(renderFabric.material)) return false;
  if (!["shirt", "trouser", "layer", "footwear"].every(key => isText(garments[key]))) return false;
  if (!isText(candidate.concept) || !isText(candidate.aesthetic) ||
      !Array.isArray(candidate.palette) || !candidate.palette.every(isText)) return false;
  if (!isText(renderSet.modelId) || !renderSet.modelId ||
      !Array.isArray(renderSet.renders) || !renderSet.renders.every(item =>
        isRecord(item) && isText(item.view) && isText(item.src))) return false;
  // Optional legacy fields remain optional, but present integrity references
  // must be well-typed and consistent. A numeric or null reference must not
  // silently bypass the cross-version checks during recovery.
  if (renderSet.designVersionId !== undefined &&
      (!isText(renderSet.designVersionId) || renderSet.designVersionId !== version.id)) return false;
  if (version.specHash !== undefined && !isText(version.specHash)) return false;
  if (renderSet.specHash !== undefined && !isText(renderSet.specHash)) return false;
  if (isText(version.specHash) && isText(renderSet.specHash) && renderSet.specHash !== version.specHash) return false;
  return true;
}

/**
 * Explicit, non-destructive import of a versioned cloud export. No browser
 * draft is overwritten or evicted, including unrecognized legacy records.
 * The original version and physical/model identifiers are retained.
 */
export function importCloudDesignExport(
  storage: Pick<Storage, "getItem" | "setItem">,
  exported: unknown,
): SavedDesign {
  if (!isRecord(exported)) throw new Error("Invalid cloud export.");
  if (Object.keys(exported).some(key => !["schemaVersion", "designId", "title", "brief", "version", "renderSet"].includes(key))) {
    throw new Error("Unsupported cloud export fields.");
  }
  const payload = {
    schemaVersion: exported.schemaVersion,
    designId: exported.designId,
    title: exported.title,
    recipe: { brief: exported.brief, version: exported.version, renderSet: exported.renderSet },
  };
  let bytes: number;
  try { bytes = new TextEncoder().encode(JSON.stringify(payload)).length; }
  catch { throw new Error("Invalid cloud export."); }
  const validated = parseCustomerSavedDesignWrite(payload, bytes);
  if (!validated || !isUsableAtelierRecipe(validated.recipe.brief, validated.recipe.version, validated.recipe.renderSet)) {
    throw new Error("Cloud design is incomplete or failed version validation. Browser drafts unchanged.");
  }

  const raw = storage.getItem(SAVED_DESIGNS_KEY);
  let entries: unknown[] = [];
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Unsupported local format.");
      entries = parsed;
    } catch { throw new Error("Existing browser drafts could not be read; no data changed."); }
  }
  // Refuse to evict even a future-format record. Capacity includes all entries.
  if (entries.length >= 24) throw new Error("Browser draft store is full; no data changed.");
  const ids = new Set(entries.filter(isRecord).map(item => item.id));
  let id = validated.designId;
  for (let suffix = 1; ids.has(id); suffix++) id = validated.designId.slice(0, 145) + "-import-" + suffix;
  const saved: SavedDesign = {
    id, title: validated.title, savedAt: new Date().toISOString(),
    brief: validated.recipe.brief as SavedDesign["brief"],
    version: validated.recipe.version as SavedDesign["version"],
    renderSet: validated.recipe.renderSet as SavedDesign["renderSet"],
  };
  storage.setItem(SAVED_DESIGNS_KEY, JSON.stringify([saved, ...entries]));
  return saved;
}
