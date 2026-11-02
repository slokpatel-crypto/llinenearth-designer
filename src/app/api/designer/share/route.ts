import { NextResponse } from "next/server";
import { secureJsonRequestError, readSecureJsonObject, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { createDesignShareToken, designShareConfigured, verifyDesignShareToken } from "@/lib/designer/design-share";
import { createShareRevocationKey,shareRevocationKeyDigest } from "@/lib/designer/design-share-revocation-contract";
import { shareRevocationEnforced,registerShareRevocation,revokeShareToken } from "@/lib/designer/design-share-revocation";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime="nodejs";
const MAX_SHARE_REQUEST_BYTES=1_048_576;
const privateJson=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"cache-control":"private, no-store, max-age=0","pragma":"no-cache"}});

export async function POST(request:Request){
  const requestError=secureJsonRequestError(request,MAX_SHARE_REQUEST_BYTES);
  if(requestError)return privateJson({error:requestError.error},requestError.status);
  try{
    const body=await readSecureJsonObject(request,MAX_SHARE_REQUEST_BYTES);
    if(body.action==="revoke"){
      if(!shareRevocationEnforced())return privateJson({error:"Share revocation is not configured."},503);
      const token=typeof body.token==="string"?body.token:"";
      const revokeKey=typeof body.revokeKey==="string"?body.revokeKey:"";
      if(!verifyDesignShareToken(token)||!revokeKey)
        return privateJson({error:"Invalid share revocation request."},400);
      try{shareRevocationKeyDigest(revokeKey);}
      catch{return privateJson({error:"Invalid share revocation request."},400);}
      try{
        const revoked=await revokeShareToken(token,revokeKey);
        return privateJson(revoked?{revoked:true}:{error:"Share revocation unavailable."},revoked?200:404);
      }catch{
        return privateJson({error:"Secure share revocation is temporarily unavailable."},503);
      }
    }
    const revision=body as unknown as LockedDesignRevision;
    if(!revision || revision.version!=="linen-earth-design-lock-v1") {
      return privateJson({error:"A locked Linen Earth design revision is required."},400);
    }
    if(!await verifyLockedDesignRevision(revision)) {
      return privateJson({error:"The locked design revision did not pass integrity verification."},409);
    }
    if(!designShareConfigured()) {
      return privateJson({error:"Design sharing is not configured on this deployment."},503);
    }
    const token=createDesignShareToken(revision);
    if(!token) return privateJson({error:"Could not create a share token."},413);
    let revokeKey:string|undefined;
    if(shareRevocationEnforced()){
      const payload=verifyDesignShareToken(token);
      if(!payload)return privateJson({error:"Could not verify signed share."},503);
      revokeKey=createShareRevocationKey();
      try{
        await registerShareRevocation(token,revokeKey,payload.expiresAt);
      }catch{
        // Never leak a bearer link that cannot be revoked under enforcement.
        console.error("[designer/share] revocation registration failed (details redacted).");
        return privateJson({error:"Secure share creation is temporarily unavailable."},503);
      }
    }

    let audited=false;
    const cloud=getSupabaseAdminConfig();
    if(cloud){
      try{
        const audit=await fetch(`${cloud.url.replace(/\/$/,"")}/rest/v1/rpc/design_share_audit_record`,{
          method:"POST",
          headers:{...supabaseAdminHeaders(cloud),"content-type":"application/json",accept:"application/json"},
          body:JSON.stringify({p_revision_id:revision.revisionId,p_recipe_hash:revision.recipeHash}),
          cache:"no-store",
          signal:AbortSignal.timeout(8_000),
        });
        audited=audit.ok;
        if(!audit.ok) console.error("[designer/share] audit failed (upstream details redacted).");
      }catch{
        console.error("[designer/share] audit failed (upstream details redacted).");
      }
    }

    return privateJson({token,expiresInDays:30,audited,...(revokeKey?{revokeKey}:{})});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge)return privateJson({error:"Request payload is too large."},413);
    if(error instanceof SecureJsonBodyInvalid)return privateJson({error:"Invalid JSON request."},400);
    return privateJson({error:"Could not create a share link for this design."},400);
  }
}
