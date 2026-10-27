import { normalizeVaultId } from "./vault-id.ts";

/**
 * Vault identifiers are security credentials, not values to stringify.
 * JSON arrays such as ["token"] otherwise become a valid token via String().
 * Validate at the request boundary before attempting identity lookup or RPC.
 */
export function parseVaultRequestIdentifiers(
  action:string,
  body:{vaultId?:unknown;recoveryToken?:unknown},
):
  | {ok:false;field:"vaultId"|"recoveryToken"}
  | {ok:true;vaultId:string|null;recoveryToken:string|null}
{
  if(action==="loadOwned"||action==="deleteOwned"){
    const vaultId=normalizeVaultId(body.vaultId);
    if(!vaultId) return {ok:false,field:"vaultId"};
    return {ok:true,vaultId,recoveryToken:null};
  }
  if(action==="claim"||action==="load"||action==="delete"){
    if(typeof body.recoveryToken!=="string"||!body.recoveryToken.trim())
      return {ok:false,field:"recoveryToken"};
    return {ok:true,vaultId:null,recoveryToken:body.recoveryToken.trim()};
  }
  return {ok:true,vaultId:null,recoveryToken:null};
}

/**
 * Possession of a valid recovery credential authorizes load/delete, without
 * requiring an account session. Never make those token-only operations depend
 * on an optional legacy Supabase Auth lookup, which can time out independently
 * of the vault RPC. Claims and owned operations still require identity.
 */
export function vaultActionNeedsCustomerIdentity(action:string):boolean{
  // Only account-only actions require a successful auth lookup. "store" may
  // attempt optional ownership linking but must issue recovery credentials
  // independently when the auth provider is unavailable.
  return action==="claim"||action==="listOwned"||
    action==="loadOwned"||action==="deleteOwned";
}
