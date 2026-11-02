import "server-only";
import { getSupabaseAdminConfig,supabaseAdminHeaders } from "@/lib/supabase-admin";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { shareBearerDigest,shareRevocationKeyDigest,requireShareRevocationBoolean } from "@/lib/designer/design-share-revocation-contract";

export function shareRevocationEnforced(){
  return process.env.LINEN_DESIGN_SHARE_REVOCATION_REQUIRED==="1";
}
async function shareRpc(name:string,params:Record<string,unknown>):Promise<boolean>{
  const config=getSupabaseAdminConfig();
  if(!config)throw new Error("Share revocation backend unavailable.");
  const response=await fetch(`${config.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(params),cache:"no-store",signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok||response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="application/json")
    throw new Error("Share revocation backend failed.");
  return requireShareRevocationBoolean(await readBoundedJsonResponse(response,512));
}
export async function registerShareRevocation(token:string,key:string,expiresAt:number,ownerUserId:string|null=null):Promise<void>{
  if(!shareRevocationEnforced())return;
  if(!Number.isFinite(expiresAt)||expiresAt<=Date.now())throw new Error("Share expiry invalid.");
  const ok=await shareRpc("designer_share_register",{
    p_token_hash:shareBearerDigest(token),
    p_revoke_key_hash:shareRevocationKeyDigest(key),
    p_expires_at:new Date(expiresAt).toISOString(),
    p_owner_user_id:ownerUserId,
  });
  if(!ok)throw new Error("Share revocation registration failed.");
}
export async function isShareTokenAllowed(token:string):Promise<boolean>{
  if(!shareRevocationEnforced())return true;
  return !(await shareRpc("designer_share_is_revoked",{p_token_hash:shareBearerDigest(token)}));
}
export async function revokeShareToken(token:string,key:string):Promise<boolean>{
  if(!shareRevocationEnforced())throw new Error("Share revocation not configured.");
  return await shareRpc("designer_share_revoke",{
    p_token_hash:shareBearerDigest(token),
    p_revoke_key_hash:shareRevocationKeyDigest(key),
  });
}

// Owner-scoped management never reveals the signed bearer or issuer capability.
export type OwnedShareRecord={tokenHash:string;expiresAt:string;revokedAt:string|null};
export async function listOwnedShareRevocations(ownerUserId:string):Promise<OwnedShareRecord[]>{
  if(!shareRevocationEnforced())throw new Error("Share management not configured.");
  const config=getSupabaseAdminConfig();
  if(!config)throw new Error("Share management backend unavailable.");
  const response=await fetch(`${config.url}/rest/v1/rpc/designer_share_list_owned`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify({p_owner_user_id:ownerUserId}),cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok||response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="application/json")
    throw new Error("Share management backend failed.");
  const raw=await readBoundedJsonResponse(response,32_768);
  if(!Array.isArray(raw)||raw.length>50)throw new Error("Invalid share management response.");
  return raw.map((entry:unknown)=>{
    if(!entry||typeof entry!=="object"||Array.isArray(entry))
      throw new Error("Invalid share metadata.");
    const item=entry as Record<string,unknown>;
    if(typeof item.token_hash!=="string"||!/^[0-9a-f]{64}$/.test(item.token_hash)||
      typeof item.expires_at!=="string"||!Number.isFinite(Date.parse(item.expires_at))||
      (item.revoked_at!==null&&(typeof item.revoked_at!=="string"||
      !Number.isFinite(Date.parse(item.revoked_at)))))
      throw new Error("Invalid share metadata.");
    return {tokenHash:item.token_hash,expiresAt:item.expires_at,revokedAt:item.revoked_at as string|null};
  });
}
export async function revokeOwnedShare(tokenHash:string,ownerUserId:string):Promise<boolean>{
  if(!shareRevocationEnforced()||!/^[0-9a-f]{64}$/.test(tokenHash))
    throw new Error("Invalid owned share revocation.");
  return await shareRpc("designer_share_revoke_owned",{
    p_token_hash:tokenHash,p_owner_user_id:ownerUserId,
  });
}
