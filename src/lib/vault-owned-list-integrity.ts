import {normalizeVaultId} from "./vault-id.ts";
import {parseVaultTimestamptz} from "./vault-read-integrity.ts";

/** JSON returned by remote vault RPCs is not necessarily a well-formed row. */
export function isVaultListRowEnvelope(value:unknown,nowMs:number=Date.now()):boolean{
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const row=value as Record<string,unknown>;
  const created=parseVaultTimestamptz(row.created_at);
  const expires=parseVaultTimestamptz(row.expires_at);
  // An RPC bug must not expose expired entries as recoverable, or offer
  // impossible created-after-expiry records in the customer's account list.
  return normalizeVaultId(row.vault_id)!==null&&created!==null&&expires!==null&&
    Number.isFinite(nowMs)&&expires>nowMs&&created<=expires;
}

/**
 * The DB index fields must name the same locked revision as its verified
 * payload; otherwise the account screen can claim a different order/hash.
 * This is consistency validation, not an authenticity signature.
 */
export function ownedDesignVaultRowMatchesPayload(value:unknown,nowMs:number=Date.now()):boolean{
  if(!isVaultListRowEnvelope(value,nowMs))return false;
  const row=value as Record<string,unknown>;
  const payload=row.payload;
  if(!payload||typeof payload!=="object"||Array.isArray(payload))return false;
  const revision=payload as Record<string,unknown>;
  return typeof row.revision_id==="string"&&typeof row.recipe_hash==="string"&&
    typeof revision.revisionId==="string"&&typeof revision.recipeHash==="string"&&
    row.revision_id===revision.revisionId&&
    row.recipe_hash===revision.recipeHash;
}

/** A successful owner-scoped list must be complete, unambiguous evidence.
 * Never report an empty/partial saved-design list when an installed RPC
 * returned a malformed row or repeated vault ID. UUID case is not identity.
 */
export function requireCompleteOwnedVaultRows(value:unknown):asserts value is Array<Record<string,unknown>>{
  if(!Array.isArray(value))throw new Error("Malformed owned vault list acknowledgement.");
  const seen=new Set<string>();
  for(const row of value){
    if(!isVaultListRowEnvelope(row))throw new Error("Malformed owned vault list acknowledgement.");
    const id=(row as Record<string,unknown>).vault_id;
    const normalized=normalizeVaultId(id);
    if(typeof id!=="string"||!normalized||id.toLowerCase()!==normalized||seen.has(normalized)){
      throw new Error("Malformed owned vault list acknowledgement.");
    }
    seen.add(normalized);
  }
}
