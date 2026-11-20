import { parseCustomerSavedDesignWrite } from "@/lib/customer-saved-design-wire";
import { SAVED_DESIGNS_KEY, type SavedDesign } from "@/lib/saved-designs";

/**
 * Explicit, non-destructive import of a versioned cloud export.
 * Never evicts local drafts or rewrites unknown legacy entries.
 */
export function importCloudDesignExport(
  storage: Pick<Storage, "getItem" | "setItem">,
  exported: unknown,
): SavedDesign {
  if (!exported || typeof exported !== "object" || Array.isArray(exported)) throw new Error("Invalid cloud export.");
  const source = exported as Record<string, unknown>;
  if (Object.keys(source).some(key => !["schemaVersion", "designId", "title", "brief", "version", "renderSet"].includes(key))) {
    throw new Error("Unsupported cloud export fields.");
  }
  const payload = {
    schemaVersion: source.schemaVersion,
    designId: source.designId,
    title: source.title,
    recipe: { brief: source.brief, version: source.version, renderSet: source.renderSet },
  };
  let bytes: number;
  try { bytes = new TextEncoder().encode(JSON.stringify(payload)).length; }
  catch { throw new Error("Invalid cloud export."); }
  const validated = parseCustomerSavedDesignWrite(payload, bytes);
  if (!validated) throw new Error("Cloud export failed version or recipe validation.");
  const raw = storage.getItem(SAVED_DESIGNS_KEY);
  let entries: unknown[] = [];
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Unsupported local format.");
      entries = parsed;
    } catch { throw new Error("Existing browser drafts could not be read; no data changed."); }
  }
  // Do not silently replace an existing design or evict an older one.
  if (entries.length >= 24) throw new Error("Browser draft store is full; no data changed.");
  const ids = new Set(entries.filter((item): item is Record<string, unknown> =>
    item !== null && typeof item === "object" && !Array.isArray(item)).map(item => item.id));
  let id = validated.designId;
  for (let suffix = 1; ids.has(id); suffix++) id = validated.designId + "-import-" + suffix;
  const saved: SavedDesign = {
    id, title: validated.title, savedAt: new Date().toISOString(),
    brief: validated.recipe.brief as SavedDesign["brief"],
    version: validated.recipe.version as SavedDesign["version"],
    renderSet: validated.recipe.renderSet as SavedDesign["renderSet"],
  };
  storage.setItem(SAVED_DESIGNS_KEY, JSON.stringify([saved, ...entries]));
  return saved;
}
