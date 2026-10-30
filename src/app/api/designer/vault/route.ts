import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { linkVaultOwnerBestEffort, resolveVaultStoreOwnerBestEffort, vaultOwnershipWarning } from "@/lib/vault-owner-link";
import { parseVaultRequestIdentifiers, vaultActionNeedsCustomerIdentity } from "@/lib/vault-request-identifiers";
import { vaultRateBlocked } from "@/lib/vault-rate-guard";
import { ownedDesignVaultRowMatchesPayload, requireCompleteOwnedVaultRows } from "@/lib/vault-owned-list-integrity";
import { selectVaultReadRow } from "@/lib/vault-read-integrity";
import { requireVaultBooleanResult, requireVaultStoreId } from "@/lib/vault-write-integrity";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { NextResponse } from "next/server";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { getCustomerIdentity } from "@/lib/customer-auth";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";
import {
  createDesignVaultAccessKey,
  createDesignVaultRecoveryToken,
  hashDesignVaultAccessKey,
  parseDesignVaultRecoveryToken,
} from "@/lib/designer/design-vault";

export const runtime="nodejs";

function jsonNoStore(body:unknown,init?:{status?:number}){
  return NextResponse.json(body,{
    ...init,
    headers:{"cache-control":"private, no-store, max-age=0","pragma":"no-cache"},
  });
}

const rate=(globalThis as typeof globalThis & {
  __linenDesignVaultRate?:Map<string,{at:number;count:number}>
}).__linenDesignVaultRate ||= new Map<string,{at:number;count:number}>();

function blocked(request:Request){
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
  return vaultRateBlocked(rate,ip);
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Design vault is not configured.");
  const response=await fetch(`${config.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    // Never buffer an untrusted error response or surface remote body details.
    throw new Error(`Design vault request failed (${response.status}).`);
  }
  // Single revisions/profiles are small; owned lists have a larger finite cap.
  // Oversized, malformed or interrupted upstream evidence fails closed.
  const maxBytes=name.endsWith("_list_owned")?4 * 1024 * 1024:256 * 1024;
  return await readBoundedJsonResponse(response,maxBytes) as T;
}

export async function POST(request:Request){
  if(blocked(request)) return jsonNoStore({error:"Too many design-vault requests."},{status:429});
  const unsafe=secureJsonRequestError(request,98304);
  if(unsafe) return jsonNoStore({error:unsafe.error},{status:unsafe.status});
  try{
    const input:unknown=await readSecureJsonObject(request,98304);
    const body=input as {
      action?:string;
      revision?:LockedDesignRevision;
      recoveryToken?:string;
      vaultId?:string;
    };
    const action=body.action;
    if(typeof action!=="string"||!["store","listOwned","loadOwned","deleteOwned","claim","load","delete"].includes(action))
      return jsonNoStore({error:"Unsupported design-vault action."},{status:400});
    const identifiers=parseVaultRequestIdentifiers(action,body);
    if(!identifiers.ok){
      const field=identifiers.field==="vaultId"?"vault ID":"recovery token";
      return jsonNoStore({error:`A valid ${field} string is required.`},{status:400});
    }
    const optionalOwner=action==="store"?await resolveVaultStoreOwnerBestEffort(()=>getCustomerIdentity(request)):null;
    const customer=optionalOwner?optionalOwner.customer:vaultActionNeedsCustomerIdentity(action)?await getCustomerIdentity(request):null;

    if(action==="store"){
      const revision=body.revision;
      if(!revision||revision.version!=="linen-earth-design-lock-v1") {
        return jsonNoStore({error:"A locked Linen Earth design revision is required."},{status:400});
      }
      if(!await verifyLockedDesignRevision(revision)) {
        return jsonNoStore({error:"The locked design revision failed integrity verification."},{status:409});
      }
      const accessKey=createDesignVaultAccessKey();
      const accessHash=hashDesignVaultAccessKey(accessKey);
      const vaultId=requireVaultStoreId(await rpc<unknown>("designer_locked_revision_vault_store",{
        p_revision_id:revision.revisionId,
        p_recipe_hash:revision.recipeHash.toLowerCase(),
        p_access_hash:accessHash,
        p_payload:revision,
        p_ttl_days:180,
      }));
      if(!vaultId) throw new Error("The design vault did not return an id.");

      // A successful remote store must still yield a recovery credential if
      // account linking or optional production ownership propagation fails.
      const recoveryToken=createDesignVaultRecoveryToken(vaultId,accessKey);
      const linkStatus=await linkVaultOwnerBestEffort(customer?.id,async ownerId=>{
        const attached=requireVaultBooleanResult(await rpc<unknown>("designer_locked_revision_vault_set_owner",{
          p_vault_id:vaultId,p_access_hash:accessHash,p_owner_user_id:ownerId,
        }));
        if(!attached)return false;
        // A true owner-link acknowledgement does not prove that the newly
        // stored design can be recovered by this authenticated account.
        // Keep the recovery token available if this optional check fails.
        const ownedRows=await rpc<Array<{payload:LockedDesignRevision;expires_at:string}>>(
          "designer_locked_revision_vault_get_owned",
          {p_vault_id:vaultId,p_owner_user_id:ownerId},
        );
        const ownedRevision=selectVaultReadRow(ownedRows)?.payload as LockedDesignRevision | undefined;
        return !!ownedRevision&&await verifyLockedDesignRevision(ownedRevision)&&
          ownedRevision.revisionId===revision.revisionId&&ownedRevision.recipeHash===revision.recipeHash;
      });
      if(linkStatus==="linked"&&customer){
        try{
          await rpc("production_claim_revision_ownership",{
            p_revision_id:revision.revisionId,
            p_recipe_hash:revision.recipeHash.toLowerCase(),
            p_owner_user_id:customer.id,
          });
        }catch{
          // Production ownership propagation is additive; secure design recovery
          // must remain possible during migration / temporary RPC failure.
        }
      }

      return jsonNoStore({
        vaultId,recoveryToken,expiresInDays:180,
        accountOwned:linkStatus==="linked",
        ownershipWarning:optionalOwner?.lookupFailed?vaultOwnershipWarning("unavailable"):vaultOwnershipWarning(linkStatus),
        customer:customer?{email:customer.email}:null,
      });
    }

    if(action==="listOwned"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const rows=await rpc<Array<{
        vault_id:string;revision_id:string;recipe_hash:string;
        payload:LockedDesignRevision;created_at:string;expires_at:string;
      }>>("designer_locked_revision_vault_list_owned",{p_owner_user_id:customer.id});
      // A malformed or duplicated RPC row must never be hidden as a shorter
      // apparently complete account list. Validate every saved revision.
      requireCompleteOwnedVaultRows(rows,100);
      const designs=[];
      for(const row of rows){
        if(!ownedDesignVaultRowMatchesPayload(row)||!await verifyLockedDesignRevision(row.payload)){
          throw new Error("Invalid owned design vault row.");
        }
        designs.push({
          vaultId:row.vault_id,
          revisionId:row.revision_id,
          recipeHash:row.recipe_hash,
          createdAt:row.created_at,
          expiresAt:row.expires_at,
        });
      }
      return jsonNoStore({designs,customer:{email:customer.email}});
    }

    if(action==="loadOwned"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const vaultId=identifiers.vaultId!;
      const rows=await rpc<Array<{payload:LockedDesignRevision;expires_at:string}>>(
        "designer_locked_revision_vault_get_owned",
        {p_vault_id:vaultId,p_owner_user_id:customer.id},
      );
      const row=selectVaultReadRow(rows);
      if(!row?.payload) return jsonNoStore({error:"Design not found."},{status:404});
      if(!await verifyLockedDesignRevision(row.payload)) {
        return jsonNoStore({error:"Stored design failed integrity verification."},{status:409});
      }
      return jsonNoStore({revision:row.payload,expiresAt:row.expires_at});
    }

    if(action==="deleteOwned"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const deleted=requireVaultBooleanResult(await rpc<unknown>("designer_locked_revision_vault_delete_owned",{
        p_vault_id:identifiers.vaultId!,p_owner_user_id:customer.id,
      }));
      return jsonNoStore({deleted});
    }

    const parsed=parseDesignVaultRecoveryToken(identifiers.recoveryToken!);
    if(!parsed) return jsonNoStore({error:"The recovery token is invalid."},{status:400});

    if(action==="claim"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      // A claim is a durable owner-scoped recovery assertion. Verify the
      // token's single unexpired, integrity-checked revision BEFORE changing
      // ownership; a successful set_owner RPC alone cannot certify recovery.
      const rows=await rpc<Array<{payload:LockedDesignRevision;expires_at:string}>>("designer_locked_revision_vault_get",{
        p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,
      });
      const revision=selectVaultReadRow(rows)?.payload as LockedDesignRevision | undefined;
      if(!revision) return jsonNoStore({error:"Design not found or recovery token expired."},{status:404});
      if(!await verifyLockedDesignRevision(revision))
        return jsonNoStore({error:"Stored design failed integrity verification."},{status:409});
      const claimed=requireVaultBooleanResult(await rpc<unknown>("designer_locked_revision_vault_set_owner",{
        p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,p_owner_user_id:customer.id,
      }));
      if(claimed){
        // A successful set_owner receipt alone cannot prove that this signed-in
        // account can actually recover the same immutable locked revision.
        // Re-read through the owner-scoped RPC before reporting claimed:true.
        const ownedRows=await rpc<Array<{payload:LockedDesignRevision;expires_at:string}>>(
          "designer_locked_revision_vault_get_owned",
          {p_vault_id:parsed.vaultId,p_owner_user_id:customer.id},
        );
        const ownedRevision=selectVaultReadRow(ownedRows)?.payload as LockedDesignRevision | undefined;
        if(!ownedRevision||!await verifyLockedDesignRevision(ownedRevision)||
          ownedRevision.revisionId!==revision.revisionId||ownedRevision.recipeHash!==revision.recipeHash){
          throw new Error("Owner-scoped locked design recovery could not be confirmed.");
        }
        try{
          await rpc("production_claim_revision_ownership",{
            p_revision_id:revision.revisionId,
            p_recipe_hash:revision.recipeHash.toLowerCase(),
            p_owner_user_id:customer.id,
          });
        }catch{
          // Keep verified vault claim available while the production-ownership migration rolls out.
        }
      }
      return jsonNoStore({claimed});
    }

    if(action==="load"){
      const rows=await rpc<Array<{payload:LockedDesignRevision;expires_at:string}>>("designer_locked_revision_vault_get",{
        p_vault_id:parsed.vaultId,
        p_access_hash:parsed.accessHash,
      });
      const row=selectVaultReadRow(rows);
      if(!row?.payload) return jsonNoStore({error:"Design not found or recovery token expired."},{status:404});
      if(!await verifyLockedDesignRevision(row.payload)) {
        return jsonNoStore({error:"Stored design failed integrity verification."},{status:409});
      }
      return jsonNoStore({revision:row.payload,expiresAt:row.expires_at});
    }

    if(action==="delete"){
      const deleted=requireVaultBooleanResult(await rpc<unknown>("designer_locked_revision_vault_delete",{
        p_vault_id:parsed.vaultId,
        p_access_hash:parsed.accessHash,
      }));
      return jsonNoStore({deleted});
    }

    return jsonNoStore({error:"Unsupported design-vault action."},{status:400});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return jsonNoStore({error:error.message},{status:413});
    if(error instanceof SecureJsonBodyInvalid) return jsonNoStore({error:error.message},{status:400});
    console.error("[designer/vault]",error);
    return jsonNoStore({error:"Secure design storage is temporarily unavailable."},{status:503});
  }
}
