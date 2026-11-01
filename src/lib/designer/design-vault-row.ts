// A vault lookup SQL function yields no rows or exactly one complete row.
// Never turn malformed or duplicate PostgREST HTTP-200 envelopes into "not
// found", and never trust an arbitrary first element in the returned array.
export type SingleDesignVaultRow={payload:Record<string,unknown>;expires_at:string};
export function requireSingleDesignVaultRow(value:unknown):SingleDesignVaultRow|null {
  if(!Array.isArray(value)||value.length>1)
    throw new Error("Invalid design vault lookup envelope.");
  if(value.length===0)return null;
  const row=value[0];
  if(!row||typeof row!=="object"||Array.isArray(row)||
    !row.payload||typeof row.payload!=="object"||Array.isArray(row.payload)||
    typeof row.expires_at!=="string"||
    !Number.isFinite(Date.parse(row.expires_at)))
    throw new Error("Invalid design vault lookup row.");
  return {payload:row.payload as Record<string,unknown>,expires_at:row.expires_at};
}
