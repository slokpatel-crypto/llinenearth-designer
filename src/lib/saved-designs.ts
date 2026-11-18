import type { DesignerBrief } from "@/lib/designer-types";
import type { DesignVersion } from "@/lib/refinement-engine";
import type { RenderSet } from "@/lib/visualization-engine";

export const SAVED_DESIGNS_KEY = "linen-earth-saved-designs-v1";

export type SavedDesign = {
  id: string;
  title: string;
  savedAt: string;
  brief: DesignerBrief;
  version: DesignVersion;
  renderSet: RenderSet;
};

export function listSavedDesigns(): SavedDesign[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_DESIGNS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Older browser stores may contain partial/null entries. Preserve usable
    // versioned recipes instead of letting one corrupt entry break all saves.
    return parsed.filter((item): item is SavedDesign =>
      item !== null && typeof item === "object" && !Array.isArray(item) &&
      typeof item.id === "string" && item.id.length > 0 &&
      typeof item.title === "string" &&
      item.brief !== null && typeof item.brief === "object" && !Array.isArray(item.brief) &&
      item.renderSet !== null && typeof item.renderSet === "object" && !Array.isArray(item.renderSet) &&
      item.version !== null && typeof item.version === "object" && !Array.isArray(item.version) &&
      typeof item.version.id === "string" && item.version.id.length > 0 &&
      (item.version.specHash === undefined || typeof item.version.specHash === "string")
    );
  } catch {
    return [];
  }
}

export function saveDesign(input: Omit<SavedDesign, "id" | "savedAt">): SavedDesign {
  if (typeof window === "undefined") throw new Error("Saved designs are available in the browser.");
  // Never overwrite an unreadable legacy store: doing so can permanently erase
  // customer recipes that may still be recoverable from the original bytes.
  const raw = window.localStorage.getItem(SAVED_DESIGNS_KEY);
  if (raw !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Saved designs could not be read. Existing browser data was preserved.");
    }
    if (!Array.isArray(parsed)) {
      throw new Error("Saved designs have an unsupported format. Existing browser data was preserved.");
    }
  }
  const existing = listSavedDesigns();
  const saved: SavedDesign = {
    ...input,
    id: `SD-${input.version.specHash || input.version.id}`,
    savedAt: new Date().toISOString(),
  };
  const identity = saved.version.specHash || saved.version.id;
  const next = [saved, ...existing.filter((item) =>
    (item.version.specHash || item.version.id) !== identity
  )].slice(0, 24);
  window.localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(next));
  return saved;
}

export function removeSavedDesign(id: string) {
  if (typeof window === "undefined") return;
  const next = listSavedDesigns().filter((item) => item.id !== id);
  window.localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(next));
}
