import {normalizeVaultId} from "./vault-id.ts";

/** JSON returned by remote vault RPCs is not necessarily a well-formed row. */
export function isVaultListRowEnvelope(value:unknown):boolean{
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const row=value as Record<string,unknown>;
  return normalizeVaultId(row.vault_id)!==null &&
    typeof row.created_at==="string"&&Number.isFinite(Date.parse(row.created_at)) &&
    typeof row.expires_at==="string"&&Number.isFinite(Date.parse(row.expires_at));
}

/**
 * The DB index fields must name the same locked revision as its verified
 * payload; otherwise the account screen can claim a different order/hash.
 * This is consistency validation, not an authenticity signature.
 */
export function ownedDesignVaultRowMatchesPayload(value:unknown):boolean{
  if(!isVaultListRowEnvelope(value))return false;
  const row=value as Record<string,unknown>;
  const payload=row.payload;
  if(!payload||typeof payload!=="object"||Array.isArray(payload))return false;
  const revision=payload as Record<string,unknown>;
  return typeof row.revision_id==="string"&&typeof row.recipe_hash==="string"&&
    typeof revision.revisionId==="string"&&typeof revision.recipeHash==="string"&&
    row.revision_id===revision.revisionId&&
    row.recipe_hash===revision.recipeHash;
}
