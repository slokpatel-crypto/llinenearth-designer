/**
 * Wire boundary for ordinary Designer saved recipes. This is intentionally
 * separate from the integrity-signed LockedDesignRevision vault contract.
 * The authenticated owner must be derived by the server from a verified
 * session, never accepted from a browser payload.
 *
 * Pure validation only: this module does NOT persist customer records.
 */
export const CUSTOMER_SAVED_DESIGN_WIRE_VERSION = 1;
export const CUSTOMER_SAVED_DESIGN_MAX_BYTES = 1024 * 1024;

export type CustomerSavedDesignWrite = {
  schemaVersion: 1;
  designId: string;
  title: string;
  recipe: {
    brief: Record<string, unknown>;
    version: Record<string, unknown> & { id: string };
    renderSet: Record<string, unknown>;
  };
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const FORBIDDEN_OWNERSHIP_KEYS = new Set(["ownerId", "owner_id", "customerId", "customer_id", "userId", "user_id", "authorization", "sessionToken", "accessToken"]);\n\n/** Reject nested ownership claims, including prototype-shaped objects and cycles. */\nfunction hasUnsafeClaims(value: unknown, seen = new Set<object>(), depth = 0): boolean {\n  if (depth > 32) return true;\n  if (value === null || typeof value !== "object") return false;\n  if (seen.has(value)) return true;\n  seen.add(value);\n  for (const [key, child] of Object.entries(value)) {\n    if (FORBIDDEN_OWNERSHIP_KEYS.has(key) || key === "__proto__" || key === "constructor" || key === "prototype" || hasUnsafeClaims(child, seen, depth + 1)) return true;\n  }\n  seen.delete(value);\n  return false;\n}\n\nconst validId = (value: unknown) =>
  typeof value === "string" && value.length >= 1 && value.length <= 160 &&
  /^[A-Za-z0-9_-]+$/.test(value);

export function parseCustomerSavedDesignWrite(
  value: unknown,
  serializedBytes: number,
): CustomerSavedDesignWrite | null {
  if (!Number.isSafeInteger(serializedBytes) ||
      serializedBytes < 1 || serializedBytes > CUSTOMER_SAVED_DESIGN_MAX_BYTES ||
      !record(value)) return null;
  // No caller-supplied owner or authorization fields, including future
  // accidental spread of account state into a persisted recipe.
  if (Object.keys(value).some((key) =>
    !["schemaVersion", "designId", "title", "recipe"].includes(key))) return null;
  if (value.schemaVersion !== CUSTOMER_SAVED_DESIGN_WIRE_VERSION ||
      !validId(value.designId) ||
      typeof value.title !== "string" || value.title.length > 200 ||
      !record(value.recipe)) return null;
  if (Object.keys(value.recipe).some((key) =>
    !["brief", "version", "renderSet"].includes(key))) return null;
  const {brief, version, renderSet} = value.recipe;
  if (!record(brief) || !record(version) || !record(renderSet) ||
      !validId(version.id) || hasUnsafeClaims(value.recipe)) return null;
  return value as CustomerSavedDesignWrite;
}
