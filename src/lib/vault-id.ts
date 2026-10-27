const VAULT_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Vault IDs cross browser, API and database trust boundaries. Keep one strict
 * UUID contract so owned-vault actions and recovery tokens cannot disagree.
 */
export function normalizeVaultId(value:unknown):string|null{
  if(typeof value!=="string") return null;
  const normalized=value.trim().toLowerCase();
  return VAULT_ID.test(normalized)?normalized:null;
}
