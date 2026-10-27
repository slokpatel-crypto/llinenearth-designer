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
    if(typeof body.vaultId!=="string"||!body.vaultId.trim())
      return {ok:false,field:"vaultId"};
    return {ok:true,vaultId:body.vaultId.trim(),recoveryToken:null};
  }
  if(action==="claim"||action==="load"||action==="delete"){
    if(typeof body.recoveryToken!=="string"||!body.recoveryToken.trim())
      return {ok:false,field:"recoveryToken"};
    return {ok:true,vaultId:null,recoveryToken:body.recoveryToken.trim()};
  }
  return {ok:true,vaultId:null,recoveryToken:null};
}
