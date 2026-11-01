import {readBoundedJsonResponse} from "./bounded-json-response.ts";

/** Only a literal, bounded PostgREST missing-function error permits an empty
 * optional legacy production list. Generic gateway 404/503 and malformed
 * error bodies must never masquerade as missing production evidence. */
export async function isMissingOptionalProductionRpc(response:Response):Promise<boolean>{
  if(response.status!==404) return false;
  const mime=response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if(mime!=="application/json") return false;
  const body=await readBoundedJsonResponse(response,4_096);
  return body!==null && typeof body==="object" && !Array.isArray(body) &&
    (body as Record<string,unknown>).code==="PGRST202";
}
