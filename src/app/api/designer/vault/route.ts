import { NextResponse } from "next/server";
import { secureJsonRequestError } from "@/lib/secure-json-request";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { getCustomerIdentity } from "@/lib/customer-auth";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { requireDesignVaultBooleanAck } from "@/lib/designer/design-vault-ack";
import { checkDesignVaultRateLimit, type VaultRateEntry } from "@/lib/designer/design-vault-rate-limit";
import { requireSingleDesignVaultRow } from "@/lib/designer/design-vault-row";
import { requireOwnedDesignVaultRows } from "@/lib/designer/design-vault-owned-list";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";
import {
  createDesignVaultAccessKey,
  createDesignVaultRecoveryToken,
  hashDesignVaultAccessKey,
  parseDesignVaultRecoveryToken,
  requireDesignVaultCreatedId,
} from "@/lib/designer/design-vault";

export const runtime="nodejs";
// Limit decoded JSON before parsing; preserve room for a complete garment spec.
const MAX_VAULT_REQUEST_BYTES=1_048_576;
const MAX_VAULT_RESPONSE_BYTES=8_388_608;

function jsonNoStore(body:unknown,init?:{status?:number}){
  return NextResponse.json(body,{
    ...init,
    headers:{"cache-control":"private, no-store, max-age=0","pragma":"no-cache"},
  });
}

const rate=(globalThis as typeof globalThis & {
  __linenDesignVaultRate?:Map<string,VaultRateEntry>
}).__linenDesignVaultRate ||= new Map<string,VaultRateEntry>();

function blocked(request:Request){
  // In-process best effort; the deployment's trusted edge should enforce a
  // separate distributed limit. Forwarded headers are not proof of identity.
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
  return checkDesignVaultRateLimit(rate,ip,Date.now());
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
  if(!response.ok) {
    // Upstream errors may contain tokens, customer data, or SQL details.
    throw new Error("Design vault upstream request failed.");
  }
  const mime=response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if(mime!=="application/json") throw new Error("Invalid design vault response type.");
  return await readBoundedJsonResponse(response,MAX_VAULT_RESPONSE_BYTES) as T;
}

export async function POST(request:Request){
  const requestError=secureJsonRequestError(request,MAX_VAULT_REQUEST_BYTES);
  if(requestError)return jsonNoStore({error:requestError.error},{status:requestError.status});
  if(blocked(request)) return jsonNoStore({error:"Too many design-vault requests."},{status:429});
  try{
    const rawBody=await readBoundedJsonResponse(request,MAX_VAULT_REQUEST_BYTES);
    if(!rawBody||typeof rawBody!=="object"||Array.isArray(rawBody))
      throw new Error("Invalid design vault request.");
    const body=rawBody as {
      action?:string;
      revision?:LockedDesignRevision;
      recoveryToken?:string;
      vaultId?:string;
    };
    const action=String(body.action||"");
    const customer=await getCustomerIdentity(request);

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
      const vaultId=requireDesignVaultCreatedId(await rpc<unknown>("designer_locked_revision_vault_store",{
        p_revision_id:revision.revisionId,
        p_recipe_hash:revision.recipeHash.toLowerCase(),
        p_access_hash:accessHash,
        p_payload:revision,
        p_ttl_days:180,
      }));

      let accountOwned=false;
      if(customer){
        try{
          accountOwned=requireDesignVaultBooleanAck(await rpc<unknown>("designer_locked_revision_vault_set_owner",{
            p_vault_id:vaultId,p_access_hash:accessHash,p_owner_user_id:customer.id,
          }));
        }catch{
          // The store RPC already succeeded. Returning 503 here loses the only
          // recovery key and leaves an unrecoverable private vault row.
          // Never claim ownership succeeded without a strict positive ack.
          console.error("[designer/vault] ownership attachment failed (details redacted).");
          accountOwned=false;
        }
        if(accountOwned){
          try{
            await rpc("production_claim_revision_ownership",{
              p_revision_id:revision.revisionId,
              p_recipe_hash:revision.recipeHash.toLowerCase(),
              p_owner_user_id:customer.id,
            });
          }catch{
            // Ownership propagation is additive; secure design storage remains available
            // while the newer production-ownership migration is being installed.
          }
        }
      }

      const recoveryToken=createDesignVaultRecoveryToken(vaultId,accessKey);
      return jsonNoStore({
        vaultId,recoveryToken,expiresInDays:180,
        accountOwned,
        customer:customer?{email:customer.email}:null,
      });
    }

    if(action==="listOwned"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const responseRows=await rpc<unknown>("designer_locked_revision_vault_list_owned",{
        p_owner_user_id:customer.id,
      });
      const rows=requireOwnedDesignVaultRows(responseRows);
      const designs=[];
      for(const row of rows){
        if(await verifyLockedDesignRevision(row.payload as unknown as LockedDesignRevision)){
          designs.push({
            vaultId:row.vault_id,
            revisionId:row.revision_id,
            recipeHash:row.recipe_hash,
            createdAt:row.created_at,
            expiresAt:row.expires_at,
          });
        }
      }
      return jsonNoStore({designs,customer:{email:customer.email}});
    }

    if(action==="loadOwned"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const vaultId=String(body.vaultId||"");
      const rows=await rpc<unknown>(
        "designer_locked_revision_vault_get_owned",
        {p_vault_id:vaultId,p_owner_user_id:customer.id},
      );
      const row=requireSingleDesignVaultRow(rows);
      if(!row) return jsonNoStore({error:"Design not found."},{status:404});
      const revision=row.payload as LockedDesignRevision;
      if(!await verifyLockedDesignRevision(revision)) {
        return jsonNoStore({error:"Stored design failed integrity verification."},{status:409});
      }
      return jsonNoStore({revision,expiresAt:row.expires_at});
    }

    if(action==="deleteOwned"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const deleted=requireDesignVaultBooleanAck(await rpc<unknown>("designer_locked_revision_vault_delete_owned",{
        p_vault_id:String(body.vaultId||""),p_owner_user_id:customer.id,
      }));
      return jsonNoStore({deleted});
    }

    const parsed=parseDesignVaultRecoveryToken(String(body.recoveryToken||""));
    if(!parsed) return jsonNoStore({error:"The recovery token is invalid."},{status:400});

    if(action==="claim"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const claimed=requireDesignVaultBooleanAck(await rpc<unknown>("designer_locked_revision_vault_set_owner",{
        p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,p_owner_user_id:customer.id,
      }));
      if(claimed){
        const rows=await rpc<unknown>("designer_locked_revision_vault_get",{
          p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,
        });
        const row=requireSingleDesignVaultRow(rows);
        const revision=row?.payload as LockedDesignRevision|undefined;
        if(revision&&await verifyLockedDesignRevision(revision)){
          try{
            await rpc("production_claim_revision_ownership",{
              p_revision_id:revision.revisionId,
              p_recipe_hash:revision.recipeHash.toLowerCase(),
              p_owner_user_id:customer.id,
            });
          }catch{
            // Keep account claim available while the production-ownership migration rolls out.
          }
        }
      }
      return jsonNoStore({claimed});
    }

    if(action==="load"){
      const rows=await rpc<unknown>("designer_locked_revision_vault_get",{
        p_vault_id:parsed.vaultId,
        p_access_hash:parsed.accessHash,
      });
      const row=requireSingleDesignVaultRow(rows);
      if(!row) return jsonNoStore({error:"Design not found or recovery token expired."},{status:404});
      const revision=row.payload as LockedDesignRevision;
      if(!await verifyLockedDesignRevision(revision)) {
        return jsonNoStore({error:"Stored design failed integrity verification."},{status:409});
      }
      return jsonNoStore({revision,expiresAt:row.expires_at});
    }

    if(action==="delete"){
      const deleted=requireDesignVaultBooleanAck(await rpc<unknown>("designer_locked_revision_vault_delete",{
        p_vault_id:parsed.vaultId,
        p_access_hash:parsed.accessHash,
      }));
      return jsonNoStore({deleted});
    }

    return jsonNoStore({error:"Unsupported design-vault action."},{status:400});
  }catch{
    // Never log exception messages: malformed JSON or a database failure may
    // embed the recovery token or private design data in the exception text.
    console.error("[designer/vault] request failed (details redacted).");
    return jsonNoStore({error:"Secure design storage is temporarily unavailable."},{status:503});
  }
}
