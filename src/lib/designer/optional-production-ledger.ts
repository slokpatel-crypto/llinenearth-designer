/**
 * A 200 response from an optional production evidence RPC is not proof of an
 * empty ledger unless it is a literal JSON array. Missing migrations are
 * handled separately by HTTP status, never by coercing a malformed body.
 */
export function verifiedOptionalProductionRows(value:unknown):unknown[]{
  if(!Array.isArray(value)) throw new Error("Malformed optional production evidence ledger.");
  return value;
}
