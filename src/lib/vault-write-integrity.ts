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
