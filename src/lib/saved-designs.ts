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

function isSavedDesign(item: unknown): item is SavedDesign {
  return item !== null && typeof item === "object" && !Array.isArray(item) &&
    typeof (item as SavedDesign).id === "string" && (item as SavedDesign).id.length > 0 &&
    typeof (item as SavedDesign).title === "string" &&
    (item as SavedDesign).brief !== null && typeof (item as SavedDesign).brief === "object" && !Array.isArray((item as SavedDesign).brief) &&
    (item as SavedDesign).renderSet !== null && typeof (item as SavedDesign).renderSet === "object" && !Array.isArray((item as SavedDesign).renderSet) &&
    (item as SavedDesign).version !== null && typeof (item as SavedDesign).version === "object" && !Array.isArray((item as SavedDesign).version) &&
    typeof (item as SavedDesign).version.id === "string" && (item as SavedDesign).version.id.length > 0 &&
    ((item as SavedDesign).version.specHash === undefined || typeof (item as SavedDesign).version.specHash === "string");
}

export function listSavedDesigns(): SavedDesign[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_DESIGNS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Older browser stores may contain partial/null entries. Preserve usable
    // versioned recipes instead of letting one corrupt entry break all saves.
    return parsed.filter(isSavedDesign);
  } catch {
    return [];
  }
}

export function saveDesign(input: Omit<SavedDesign, "id" | "savedAt">): SavedDesign {
  if (typeof window === "undefined") throw new Error("Saved designs are available in the browser.");
  // Never overwrite an unreadable legacy store: doing so can permanently erase
  // customer recipes that may still be recoverable from the original bytes.
  const raw = window.localStorage.getItem(SAVED_DESIGNS_KEY);
  let rawEntries: unknown[] = [];
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
    rawEntries = parsed;
  }
  const existing = rawEntries.filter(isSavedDesign);
  const saved: SavedDesign = {
    ...input,
    id: `SD-${input.version.specHash || input.version.id}`,
    savedAt: new Date().toISOString(),
  };
  const identity = saved.version.specHash || saved.version.id;
  const next = [saved, ...existing.filter((item) =>
    (item.version.specHash || item.version.id) !== identity
  )].slice(0, 24);
  // Unknown legacy records are not part of the 24 readable-design limit.
  // Preserve them during saves just as during deletion; they may be recoverable.
  const unknown = rawEntries.filter((item) => !isSavedDesign(item));
  window.localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify([...next, ...unknown]));
  return saved;
}

export function removeSavedDesign(id: string) {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(SAVED_DESIGNS_KEY);
  if (raw === null) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Saved designs could not be read. Existing browser data was preserved.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Saved designs have an unsupported format. Existing browser data was preserved.");
  }
  // Remove only the requested valid entry. Keep every other raw record byte-for-
  // byte equivalent after serialization, including legacy shapes not understood
  // by the current reader, so a delete cannot silently discard recoverable data.
  const next = parsed.filter((item) =>
    item === null || typeof item !== "object" || Array.isArray(item) ||
    (item as { id?: unknown }).id !== id
  );
  if (next.length === parsed.length) return;
  window.localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(next));
}
