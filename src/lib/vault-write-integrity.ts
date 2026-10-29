import { normalizeVaultId } from "./vault-id.ts";

/** A store RPC's UUID must be the exact scalar returned by PostgreSQL.
 * Never trim a padded string, coerce an array, or create a recovery token for
 * a success-shaped response that was not an actual UUID receipt.
 */
export function requireVaultStoreId(value:unknown):string{
  const normalized=normalizeVaultId(value);
  if(typeof value!=="string"||!normalized||value.toLowerCase()!==normalized){
    throw new Error("Malformed vault store RPC acknowledgement.");
  }
  return normalized;
}

/** Validate a mutation RPC's JSON acknowledgement before reporting success.
 * Objects, nonempty strings and arrays are truthy under Boolean(value) but do
 * not prove a vault claim or deletion. This check is intentionally shared by
 * account-owned and recovery-token mutations.
 */
export function requireVaultBooleanResult(value:unknown):boolean{
  if(typeof value!=="boolean"){
    throw new Error("Malformed vault mutation RPC acknowledgement.");
  }
  return value;
}
