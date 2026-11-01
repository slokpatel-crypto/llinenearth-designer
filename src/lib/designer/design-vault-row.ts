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

 
// The owner-scoped SQL list has a hard LIMIT 100. A malformed HTTP-200
// envelope must not silently hide a saved design or advertise a bogus ID.
export type OwnedDesignVaultRow={
  vault_id:string;revision_id:string;recipe_hash:string;
  payload:Record<string,unknown>;created_at:string;expires_at:string;
};
const OWNED_VAULT_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWNED_RECIPE_HASH=/^[a-f0-9]{64}$/;
export function requireOwnedDesignVaultRows(value:unknown):OwnedDesignVaultRow[] {
  if(!Array.isArray(value)||value.length>100)
    throw new Error("Invalid owned design vault list envelope.");
  const seen=new Set<string>();
  return value.map(item=>{
    if(!item||typeof item!=="object"||Array.isArray(item))
      throw new Error("Invalid owned design vault list row.");
    const row=item as Record<string,unknown>;
    const payload=row.payload;
    if(typeof row.vault_id!=="string"||!OWNED_VAULT_UUID.test(row.vault_id)||
      typeof row.revision_id!=="string"||!row.revision_id||
      typeof row.recipe_hash!=="string"||!OWNED_RECIPE_HASH.test(row.recipe_hash)||
      !payload||typeof payload!=="object"||Array.isArray(payload)||
      (payload as Record<string,unknown>).version!=="linen-earth-design-lock-v1"||
      (payload as Record<string,unknown>).revisionId!==row.revision_id||
      (payload as Record<string,unknown>).recipeHash!==row.recipe_hash||
      typeof row.created_at!=="string"||typeof row.expires_at!=="string"||
      !Number.isFinite(Date.parse(row.created_at))||
      !Number.isFinite(Date.parse(row.expires_at))||
      Date.parse(row.expires_at)<=Date.parse(row.created_at))
      throw new Error("Invalid owned design vault list row.");
    const id=row.vault_id.toLowerCase();
    if(seen.has(id))throw new Error("Duplicate owned design vault list row.");
    seen.add(id);
    return {
      vault_id:id,revision_id:row.revision_id,recipe_hash:row.recipe_hash,
      payload:payload as Record<string,unknown>,
      created_at:row.created_at,expires_at:row.expires_at,
    };
  });
}
