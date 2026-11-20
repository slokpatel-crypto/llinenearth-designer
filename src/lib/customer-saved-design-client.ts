import type { SavedDesign } from "./saved-designs";
import { parseCustomerSavedDesignRow, parseCustomerSavedDesignWrite } from "./customer-saved-design-wire.ts";

/** Explicit signed-in cloud operations. Never migrate browser localStorage implicitly. */
export type SavedDesignTransport = (input: string, init?: RequestInit) => Promise<Response>;
const endpoint = "/api/customer-saved-designs";
const validId = (id: string) => /^[A-Za-z0-9_-]{1,160}$/.test(id);

function cloudRecord(saved: SavedDesign) {
  return { schemaVersion: 1, designId: saved.id, title: saved.title,
    recipe: { brief: saved.brief, version: saved.version, renderSet: saved.renderSet } };
}

function decodeRow(row: unknown): SavedDesign {
  const parsed = parseCustomerSavedDesignRow(row);
  if (!parsed) throw new Error("Invalid cloud saved-design response.");
  return { id: parsed.payload.designId, title: parsed.payload.title,
    savedAt: parsed.updated_at, brief: parsed.payload.recipe.brief as SavedDesign["brief"],
    version: parsed.payload.recipe.version as SavedDesign["version"],
    renderSet: parsed.payload.recipe.renderSet as SavedDesign["renderSet"] };
}

async function json(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(response.status === 401
    ? "Sign in to access cloud saved designs." : "Cloud saved designs unavailable.");
  if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    throw new Error("Invalid cloud saved-design response.");
  return response.json();
}

export async function saveCloudDesign(saved: SavedDesign, transport: SavedDesignTransport = fetch): Promise<void> {
  const design = cloudRecord(saved);
  if (!parseCustomerSavedDesignWrite(design, new TextEncoder().encode(JSON.stringify(design)).length))
    throw new Error("This design cannot be saved to the cloud.");
  const result = await json(await transport(endpoint, { method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "save", design }), credentials: "same-origin", cache: "no-store" }));
  if (!result || typeof result !== "object" || Array.isArray(result) ||
    Object.keys(result).sort().join(",") !== "designId,saved" ||
    (result as {saved?: unknown}).saved !== true ||
    (result as {designId?: unknown}).designId !== saved.id)
    throw new Error("Cloud save was not acknowledged.");
}

export async function listCloudDesigns(transport: SavedDesignTransport = fetch): Promise<SavedDesign[]> {
  const result = await json(await transport(endpoint, { credentials: "same-origin", cache: "no-store" }));
  if (!result || typeof result !== "object" || Array.isArray(result) ||
    !Array.isArray((result as {designs?: unknown}).designs) ||
    (result as {designs: unknown[]}).designs.length > 24)
    throw new Error("Invalid cloud saved-design response.");
  return (result as {designs: unknown[]}).designs.map(decodeRow);
}

export async function deleteCloudDesign(id: string, transport: SavedDesignTransport = fetch): Promise<boolean> {
  if (!validId(id)) throw new Error("Invalid design ID.");
  const result = await json(await transport(endpoint, { method: "POST",
    headers: { "content-type": "application/json" }, credentials: "same-origin",
    cache: "no-store", body: JSON.stringify({ action: "delete", designId: id }) }));
  if (!result || typeof result !== "object" || Array.isArray(result) ||
    Object.keys(result).join(",") !== "deleted" ||
    typeof (result as {deleted?: unknown}).deleted !== "boolean")
    throw new Error("Cloud delete was not acknowledged.");
  return (result as {deleted: boolean}).deleted;
}

/** Recover one explicitly selected cloud design; never fall back to localStorage. */
export async function getCloudDesign(id: string, transport: SavedDesignTransport = fetch): Promise<SavedDesign | null> {
  if (!validId(id)) throw new Error("Invalid design ID.");
  const response = await transport(`${endpoint}?designId=${encodeURIComponent(id)}`, {
    credentials: "same-origin", cache: "no-store",
  });
  if (response.status === 404) return null;
  const result = await json(response);
  if (!result || typeof result !== "object" || Array.isArray(result) ||
    Object.keys(result).join(",") !== "design")
    throw new Error("Invalid cloud saved-design response.");
  const design = decodeRow((result as {design: unknown}).design);
  if (design.id !== id) throw new Error("Invalid cloud saved-design response.");
  return design;
}
