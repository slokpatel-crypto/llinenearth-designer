import { readBoundedJsonResponse } from "./bounded-json-response.ts";

// A generic upstream 404 is NOT evidence that an optional production RPC is
// absent. Only PostgREST's specific missing-function code may retain legacy
// compatibility; malformed, oversized and unavailable responses fail closed.
export async function isMissingOptionalProductionRpcResponse(response: Response): Promise<boolean> {
  if (response.status !== 404) return false;
  try {
    const receipt = await readBoundedJsonResponse(response, 4 * 1024);
    return receipt !== null && typeof receipt === "object" && !Array.isArray(receipt)
      && (receipt as Record<string, unknown>).code === "PGRST202";
  } catch {
    return false;
  }
}
