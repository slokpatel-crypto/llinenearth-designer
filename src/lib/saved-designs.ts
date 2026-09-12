import type { DesignerBrief } from "@/lib/designer-types";
import type { DesignVersion } from "@/lib/refinement-engine";
import type { RenderSet } from "@/lib/visualization-engine";

export const SAVED_DESIGNS_KEY = "llinen-earth-saved-designs-v1";

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
    const parsed = JSON.parse(raw) as SavedDesign[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDesign(input: Omit<SavedDesign, "id" | "savedAt">): SavedDesign {
  if (typeof window === "undefined") throw new Error("Saved designs are available in the browser.");
  const existing = listSavedDesigns();
  const saved: SavedDesign = {
    ...input,
    id: `SD-${input.version.specHash || input.version.id}`,
    savedAt: new Date().toISOString(),
  };
  const next = [saved, ...existing.filter((item) => item.version.specHash !== saved.version.specHash)].slice(0, 24);
  window.localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(next));
  return saved;
}

export function removeSavedDesign(id: string) {
  if (typeof window === "undefined") return;
  const next = listSavedDesigns().filter((item) => item.id !== id);
  window.localStorage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(next));
}
