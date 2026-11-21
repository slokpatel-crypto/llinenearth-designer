import { readBoundedJsonResponse } from "./bounded-json-response.ts";

const MAX_AUDIT_RESULT_BYTES = 256;

// PostgreSQL RPC style_director_handoff_audit_record_v2 returns uuid as a
// JSON string. HTTP 200 by itself does not prove that an audit was persisted.
export function verifiedStyleDirectorAuditId(value: unknown): string | null {
  if (typeof value !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return null;
  return value.toLowerCase();
}

/** Read only a small, correctly typed PostgreSQL RPC reply before claiming an audit. */
export async function readStyleDirectorAuditId(
  response: Pick<Response, "headers" | "body">,
): Promise<string | null> {
  if (response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
    return null;
  try {
    return verifiedStyleDirectorAuditId(await readBoundedJsonResponse(response, MAX_AUDIT_RESULT_BYTES));
  } catch {
    return null;
  }
}
