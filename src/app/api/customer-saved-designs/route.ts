import { NextResponse } from "next/server";
import { getCustomerIdentity } from "@/lib/customer-auth";
import { secureJsonRequestError, readSecureJsonObject } from "@/lib/secure-json-request";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { CUSTOMER_SAVED_DESIGN_MAX_BYTES, parseCustomerSavedDesignWrite } from "@/lib/customer-saved-design-wire";

export const runtime = "nodejs";
const privateJson = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "cache-control": "private, no-store, max-age=0", pragma: "no-cache" },
});
const validId = (id: unknown): id is string =>
  typeof id === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(id);

async function rpc(name: string, payload: Record<string, unknown>): Promise<unknown> {
  const config = getSupabaseAdminConfig();
  if (!config) throw new Error("Saved-design backend unavailable");
  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(8000),
    headers: { ...supabaseAdminHeaders(config), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok || response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
    throw new Error("Saved-design RPC unavailable");
  return readBoundedJsonResponse(response, 25 * CUSTOMER_SAVED_DESIGN_MAX_BYTES);
}

export async function GET(request: Request) {
  try {
    const customer = await getCustomerIdentity(request);
    if (!customer) return privateJson({ error: "Customer sign-in is required." }, 401);
    const id = new URL(request.url).searchParams.get("designId");
    if (id !== null && !validId(id)) return privateJson({ error: "Invalid design ID." }, 400);
    const rows = await rpc(id === null ? "customer_saved_design_list_owned" : "customer_saved_design_get_owned",
      id === null ? { p_owner_user_id: customer.id } : { p_owner_user_id: customer.id, p_design_id: id });
    if (!Array.isArray(rows) || rows.length > (id === null ? 24 : 1)) throw new Error("Unexpected saved-design rows");
    for (const row of rows) {
      if (!row || typeof row !== "object" || !("payload" in row) ||
          !parseCustomerSavedDesignWrite(row.payload, Buffer.byteLength(JSON.stringify(row.payload), "utf8")))
        throw new Error("Invalid saved-design record");
    }
    if (id !== null && rows.length === 0) return privateJson({ error: "Design not found." }, 404);
    return privateJson(id === null ? { designs: rows } : { design: rows[0] });
  } catch {
    console.error("[customer-saved-designs] read failed (details redacted)");
    return privateJson({ error: "Saved designs temporarily unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  const requestError = secureJsonRequestError(request, CUSTOMER_SAVED_DESIGN_MAX_BYTES);
  if (requestError) return privateJson({ error: requestError.error }, requestError.status);
  try {
    const customer = await getCustomerIdentity(request);
    if (!customer) return privateJson({ error: "Customer sign-in is required." }, 401);
    const body = await readSecureJsonObject(request, CUSTOMER_SAVED_DESIGN_MAX_BYTES) as Record<string, unknown>;
    if (body.action === "save") {
      const payload = body.design;
      const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
      const design = parseCustomerSavedDesignWrite(payload, bytes);
      if (!design || Object.keys(body).some(key => key !== "action" && key !== "design"))
        return privateJson({ error: "Invalid saved design." }, 400);
      const ack = await rpc("customer_saved_design_upsert_owned", {
        p_owner_user_id: customer.id, p_design_id: design.designId, p_payload: design,
      });
      if (ack !== true) throw new Error("Saved-design write not acknowledged");
      return privateJson({ saved: true, designId: design.designId });
    }
    if (body.action === "delete" && validId(body.designId) &&
        Object.keys(body).every(key => key === "action" || key === "designId")) {
      const ack = await rpc("customer_saved_design_delete_owned", {
        p_owner_user_id: customer.id, p_design_id: body.designId,
      });
      if (typeof ack !== "boolean") throw new Error("Invalid saved-design delete acknowledgement");
      return privateJson({ deleted: ack });
    }
    return privateJson({ error: "Invalid saved-design action." }, 400);
  } catch {
    console.error("[customer-saved-designs] write failed (details redacted)");
    return privateJson({ error: "Saved-design action temporarily unavailable." }, 503);
  }
}
