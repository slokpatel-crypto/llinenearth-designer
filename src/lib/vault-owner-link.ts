/** An optional account link must never invalidate a successfully stored vault item.
 * Returns only link state; never log an access key, recovery token or owner ID.
 * A successful remote store still requires the caller to return its recovery token.
 */
export type VaultOwnerLinkStatus="not-requested"|"linked"|"unavailable";
export async function linkVaultOwnerBestEffort(
  ownerId:string|undefined,
  attach:(ownerId:string)=>Promise<boolean>,
):Promise<VaultOwnerLinkStatus>{
  if(!ownerId) return "not-requested";
  try{
    return await attach(ownerId)===true?"linked":"unavailable";
  }catch{
    return "unavailable";
  }
}

export function vaultOwnershipWarning(status:VaultOwnerLinkStatus):string|undefined{
  return status==="unavailable"
    ?"Account linking could not be confirmed. Keep this recovery token private: it is required to retrieve, delete or claim this secure copy."
    :undefined;
}

/**
 * A customer session is optional when storing a new recovery-token vault copy.
 * A legacy session introspection outage must not prevent the independent
 * secure store; surface account-link uncertainty instead of silently treating
 * the failed lookup as an intentionally anonymous request.
 */
export async function resolveVaultStoreOwnerBestEffort<T>(
  lookup:()=>Promise<T|null>,
):Promise<{customer:T|null;lookupFailed:boolean}>{
  try{return {customer:await lookup(),lookupFailed:false};}
  catch{return {customer:null,lookupFailed:true};}
}
