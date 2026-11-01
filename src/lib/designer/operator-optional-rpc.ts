import {readBoundedJsonResponse} from "./bounded-json-response.ts";

/** An optional legacy production RPC may be absent on an older database.
 * Only a bounded, literal PostgREST missing-function error is compatible.
 * Generic 404, gateway HTML, malformed/oversized JSON and SQL failures are
 * NOT evidence that a production ledger is legitimately empty. */
export async function isMissingOptionalProductionRpc(response:Response):Promise<boolean>{
  if(response.status!==404) return false;
  const type=response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if(type!=="application/json") return false;
  const body=await readBoundedJsonResponse(response,4_096);
  if(body===null||typeof body!=="object"||Array.isArray(body)) return false;
  return (body as Record<string,unknown>).code==="PGRST202";
}
