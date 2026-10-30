import { NextResponse } from "next/server";
import { readLockedHandoffRequest, verifiedLockedHandoffAuditId } from "@/lib/designer/locked-handoff-request";
import { createDesignShareToken, designShareConfigured } from "@/lib/designer/design-share";
import { parseConsentedShareIntent } from "@/lib/designer/share-intent";
import { sameLockedEnquiryRevision } from "@/lib/designer/enquiry-intent";
import { parseDesignVaultRecoveryToken } from "@/lib/designer/design-vault";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";
import { getCustomerIdentity } from "@/lib/customer-auth";
import { selectVaultReadRow } from "@/lib/vault-read-integrity";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime="nodejs";

function privateJson(body:unknown,init?:{status?:number}){
  return NextResponse.json(body,{...init,headers:{"cache-control":"private, no-store"}});
}

export async function POST(request:Request){
  const parsed=await readLockedHandoffRequest(request);
  if(!parsed.ok) return privateJson({error:parsed.error},{status:parsed.status});
  try{
    const intent=parseConsentedShareIntent(parsed.revision);
    if(!intent) return privateJson({error:"Explicit share consent and a saved-design recovery token are required."},{status:400});
    const revision=intent.revision;
    if(revision.version!=="linen-earth-design-lock-v1"
      || !await verifyLockedDesignRevision(revision)){
      return privateJson({error:"The locked design revision did not pass integrity verification."},{status:409});
    }
    const access=parseDesignVaultRecoveryToken(intent.recoveryToken);
    if(!access) return privateJson({error:"A valid saved-design recovery token is required."},{status:400});
    const customer=await getCustomerIdentity(request);
    if(!customer) return privateJson({error:"Sign in before creating a shareable design link."},{status:401});
    const cloud=getSupabaseAdminConfig();
    if(!cloud || !designShareConfigured()){
      return privateJson({error:"Verified design sharing is not configured on this deployment."},{status:503});
    }

    async function rpc(name:string,payload:Record<string,unknown>,maxBytes:number){
      const response=await fetch(cloud!.url.replace(/\/$/,"")+"/rest/v1/rpc/"+name,{
        method:"POST",
        headers:{...supabaseAdminHeaders(cloud!),"content-type":"application/json",accept:"application/json"},
        body:JSON.stringify(payload),
        cache:"no-store",
        signal:AbortSignal.timeout(8_000),
      });
      if(!response.ok) throw new Error("Design share RPC failed ("+response.status+").");
      return await readBoundedJsonResponse(response,maxBytes);
    }

    // The caller's hash is not an authorization. Require BOTH an authenticated
    // owner read and a valid independent recovery-token read of the same lock.
    const [ownedResult,tokenResult]=await Promise.all([
      rpc("designer_locked_revision_vault_get_owned",{
        p_vault_id:access.vaultId,p_owner_user_id:customer.id,
      },256*1024),
      rpc("designer_locked_revision_vault_get",{
        p_vault_id:access.vaultId,p_access_hash:access.accessHash,
      },256*1024),
    ]);
    const owned=selectVaultReadRow(ownedResult);
    const byToken=selectVaultReadRow(tokenResult);
    if(!owned?.payload || !byToken?.payload
      || !await verifyLockedDesignRevision(owned.payload)
      || !await verifyLockedDesignRevision(byToken.payload)
      || !sameLockedEnquiryRevision(revision,owned.payload as LockedDesignRevision)
      || !sameLockedEnquiryRevision(owned.payload as LockedDesignRevision,byToken.payload as LockedDesignRevision)){
      return privateJson({error:"This saved design is not verified for the signed-in customer."},{status:409});
    }

    // A best-effort or malformed audit must never mint an apparently verified
    // public bearer link. The audit is evidence of link creation, not delivery.
    const verified=owned.payload as LockedDesignRevision;
    const auditId=verifiedLockedHandoffAuditId(await rpc("design_share_audit_record",{
      p_revision_id:verified.revisionId,p_recipe_hash:verified.recipeHash,
    },4*1024));
    if(!auditId) return privateJson({error:"The share audit did not return a valid receipt."},{status:503});
    const token=createDesignShareToken(verified);
    if(!token) return privateJson({error:"Could not create a share token."},{status:503});
    return privateJson({token,expiresInDays:30,audited:true,auditId,ownerVerified:true,revisionId:verified.revisionId});
  }catch(error){
    console.error("[designer/share] Owner verification or share audit unavailable.",error instanceof Error?error.name:"Unknown error");
    return privateJson({error:"The saved-design share could not be verified or recorded."},{status:503});
  }
}
