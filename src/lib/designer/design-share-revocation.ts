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
export async function registerShareRevocation(token:string,key:string,expiresAt:number):Promise<void>{
  if(!shareRevocationEnforced())return;
  if(!Number.isFinite(expiresAt)||expiresAt<=Date.now())throw new Error("Share expiry invalid.");
  const ok=await shareRpc("designer_share_register",{
    p_token_hash:shareBearerDigest(token),
    p_revoke_key_hash:shareRevocationKeyDigest(key),
    p_expires_at:new Date(expiresAt).toISOString(),
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
