import { NextResponse } from "next/server";
import { readLockedHandoffRequest } from "@/lib/designer/locked-handoff-request";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";
import { parseEnquiryIntent, sameLockedEnquiryRevision } from "@/lib/designer/enquiry-intent";
import { parseDesignVaultRecoveryToken } from "@/lib/designer/design-vault";
import { getCustomerIdentity } from "@/lib/customer-auth";
import { selectVaultReadRow } from "@/lib/vault-read-integrity";
import { normalizeVaultId } from "@/lib/vault-id";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime="nodejs";

function respond(body:unknown,status=200){
  return NextResponse.json(body,{
    status,
    headers:{"cache-control":"private, no-store, max-age=0"},
  });
}

async function rpc(name:string,payload:Record<string,unknown>):Promise<unknown>{
  const cloud=getSupabaseAdminConfig();
  if(!cloud) throw new Error("Enquiry audit storage is not configured.");
  const response=await fetch(cloud.url.replace(/\/$/,"")+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{...supabaseAdminHeaders(cloud),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok) throw new Error("Enquiry audit RPC failed ("+response.status+").");
  // A vault row can contain a locked recipe; bound upstream response bytes
  // before JSON.parse. Oversize/malformed RPC evidence must fail closed.
  return await readBoundedJsonResponse(response,256 * 1024);
}

function whatsappDraft(revision:LockedDesignRevision){
  const spec=revision.garmentSpec;
  return buildWhatsAppUrl({
    topic:"Locked Designer look",
    garment:"Shirt + trouser",
    details:[
      "Locked revision: "+revision.revisionId,
      "Recipe hash: "+revision.recipeHash.slice(0,12).toUpperCase(),
      "Shirt: "+spec.fabrics.shirt.name+" — "+spec.shirt.fit+"; "+spec.shirt.collar+"; "+spec.shirt.cuff,
      "Trouser: "+spec.fabrics.trouser.name+" — "+spec.trouser.shape+"; "+spec.trouser.rise+"; "+spec.trouser.waistband,
      "Occasion: "+spec.context.occasion,
    ].join("\n"),
  });
}

export async function POST(request:Request){
  const parsed=await readLockedHandoffRequest(request);
  if(!parsed.ok) return respond({error:parsed.error},parsed.status);
  try{
    const intent=parseEnquiryIntent(parsed.revision);
    if(!intent) return respond({error:"A locked revision and explicit enquiry consent are required."},400);
    if(!await verifyLockedDesignRevision(intent.revision)) {
      return respond({error:"The locked design revision did not pass integrity verification."},409);
    }

    // Backward-compatible or unsigned-in requests produce a local WhatsApp
    // COMPOSITION DRAFT ONLY. It is not an operator lead or confirmed delivery.
    if(!intent.recoveryToken){
      return respond({
        href:whatsappDraft(intent.revision),
        audited:false,auditId:null,ownerVerified:false,operatorReceived:false,
        status:"whatsapp_draft",handoffStatus:"prepared_not_sent",revisionId:intent.revision.revisionId,
      });
    }

    const access=parseDesignVaultRecoveryToken(intent.recoveryToken);
    if(!access) return respond({error:"A valid saved-design recovery token is required."},400);
    const customer=await getCustomerIdentity(request);
    if(!customer) return respond({error:"Sign in to record an owner-verified enquiry intent."},401);
    if(!getSupabaseAdminConfig()) return respond({error:"Enquiry audit storage is not configured."},503);

    // The token is a capability and customer identity is an independent owner
    // check. Both are needed; a self-hashed client recipe proves neither.
    const [ownedResult,tokenResult]=await Promise.all([
      rpc("designer_locked_revision_vault_get_owned",{
        p_vault_id:access.vaultId,p_owner_user_id:customer.id,
      }),
      rpc("designer_locked_revision_vault_get",{
        p_vault_id:access.vaultId,p_access_hash:access.accessHash,
      }),
    ]);
    const owned=selectVaultReadRow(ownedResult);
    const byToken=selectVaultReadRow(tokenResult);
    if(!owned?.payload||!byToken?.payload
      ||!await verifyLockedDesignRevision(owned.payload)
      ||!await verifyLockedDesignRevision(byToken.payload)
      ||!sameLockedEnquiryRevision(intent.revision,owned.payload as LockedDesignRevision)
      ||!sameLockedEnquiryRevision(owned.payload as LockedDesignRevision,byToken.payload as LockedDesignRevision)){
      return respond({error:"This saved design is not verified for the signed-in customer."},409);
    }

    // This audit records only the *intent to open WhatsApp*, not that a
    // message was sent, read, accepted or that an operator received an order.
    const verified=owned.payload as LockedDesignRevision;
    const auditId=normalizeVaultId(await rpc("design_enquiry_audit_record",{
      p_revision_id:verified.revisionId,p_recipe_hash:verified.recipeHash,
    }));
    if(!auditId) return respond({error:"The enquiry audit did not return a valid receipt."},503);
    return respond({
      href:whatsappDraft(verified),audited:true,auditId,ownerVerified:true,
      operatorReceived:false,status:"intent_recorded",handoffStatus:"prepared_not_sent",revisionId:verified.revisionId,
    });
  }catch(error){
    console.error("[designer/enquiry] Enquiry verification or audit unavailable.",error instanceof Error?error.name:"Unknown error");
    return respond({error:"The saved-design enquiry could not be verified or recorded."},503);
  }
}
