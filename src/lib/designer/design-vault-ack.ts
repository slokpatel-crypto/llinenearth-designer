// PostgREST returns JSON scalar booleans for owner and delete RPCs.
// Never coerce "false", null, arrays or objects into a successful mutation.
export function requireDesignVaultBooleanAck(value:unknown):boolean{
  if(typeof value!=="boolean")throw new Error("Invalid design vault acknowledgment.");
  return value;
}
