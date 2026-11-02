import { NextResponse } from "next/server";
import { secureJsonRequestError, readSecureJsonObject, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { createDesignShareToken, designShareConfigured } from "@/lib/designer/design-share";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime="nodejs";
const MAX_SHARE_REQUEST_BYTES=1_048_576;
const privateJson=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"cache-control":"private, no-store, max-age=0","pragma":"no-cache"}});

export async function POST(request:Request){
  const requestError=secureJsonRequestError(request,MAX_SHARE_REQUEST_BYTES);
  if(requestError)return privateJson({error:requestError.error},requestError.status);
  try{
    const revision=await readSecureJsonObject(request,MAX_SHARE_REQUEST_BYTES) as unknown as LockedDesignRevision;
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

    return privateJson({token,expiresInDays:30,audited});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge)return privateJson({error:"Request payload is too large."},413);
    if(error instanceof SecureJsonBodyInvalid)return privateJson({error:"Invalid JSON request."},400);
    return privateJson({error:"Could not create a share link for this design."},400);
  }
}
