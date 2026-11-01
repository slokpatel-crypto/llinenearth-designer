// The owner-scoped SQL list returns at most 100 vault rows. Check database
// metadata against the locked revision's metadata before showing a design or
// offering a misleading load/delete action for a corrupted row.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[0-9a-f]{64}$/i;
export type OwnedDesignVaultRow={
  vault_id:string;revision_id:string;recipe_hash:string;
  payload:Record<string,unknown>;created_at:string;expires_at:string
};
function isTimestamp(value:unknown):value is string{
  return typeof value==="string"&&value.length>0&&Number.isFinite(Date.parse(value));
}
export function requireOwnedDesignVaultRows(value:unknown):OwnedDesignVaultRow[]{
  if(!Array.isArray(value)||value.length>100)
    throw new Error("Invalid owned design vault list.");
  return value.map((candidate):OwnedDesignVaultRow=>{
    if(!candidate||typeof candidate!=="object"||Array.isArray(candidate))
      throw new Error("Invalid owned design vault row.");
    const row=candidate as Record<string,unknown>;
    const payload=row.payload;
    if(typeof row.vault_id!=="string"||!UUID.test(row.vault_id)||
      typeof row.revision_id!=="string"||row.revision_id.length<12||
      typeof row.recipe_hash!=="string"||!HASH.test(row.recipe_hash)||
      !payload||typeof payload!=="object"||Array.isArray(payload)||
      !isTimestamp(row.created_at)||!isTimestamp(row.expires_at))
      throw new Error("Invalid owned design vault row.");
    const revision=payload as Record<string,unknown>;
    if(revision.version!=="linen-earth-design-lock-v1"||
      revision.revisionId!==row.revision_id||
      typeof revision.recipeHash!=="string"||
      revision.recipeHash.toLowerCase()!==row.recipe_hash.toLowerCase())
      throw new Error("Inconsistent owned design vault metadata.");
    return row as OwnedDesignVaultRow;
  });
}
