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
  const now=Date.now();
  const current=rate.get(ip);
  if(!current||now-current.at>60_000){rate.set(ip,{at:now,count:1});return false;}
  current.count+=1;
  return current.count>30;
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
    const detail=(await response.text()).slice(0,300);
    throw new Error(`Design vault request failed (${response.status}): ${detail}`);
  }
  return await response.json() as T;
}

export async function POST(request:Request){
  if(blocked(request)) return jsonNoStore({error:"Too many design-vault requests."},{status:429});
  try{
    const body=await request.json() as {
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
      const vaultId=await rpc<string>("designer_locked_revision_vault_store",{
        p_revision_id:revision.revisionId,
        p_recipe_hash:revision.recipeHash.toLowerCase(),
        p_access_hash:accessHash,
        p_payload:revision,
        p_ttl_days:180,
      });
      if(!vaultId) throw new Error("The design vault did not return an id.");

      let accountOwned=false;
      if(customer){
        accountOwned=Boolean(await rpc<boolean>("designer_locked_revision_vault_set_owner",{
          p_vault_id:vaultId,p_access_hash:accessHash,p_owner_user_id:customer.id,
        }));
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
      const rows=await rpc<Array<{
        vault_id:string;revision_id:string;recipe_hash:string;
        payload:LockedDesignRevision;created_at:string;expires_at:string;
      }>>("designer_locked_revision_vault_list_owned",{p_owner_user_id:customer.id});
      const designs=[];
      for(const row of rows){
        if(row.payload&&await verifyLockedDesignRevision(row.payload)){
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
      const rows=await rpc<Array<{payload:LockedDesignRevision;expires_at:string}>>(
        "designer_locked_revision_vault_get_owned",
        {p_vault_id:vaultId,p_owner_user_id:customer.id},
      );
      const row=rows[0];
      if(!row?.payload) return jsonNoStore({error:"Design not found."},{status:404});
      if(!await verifyLockedDesignRevision(row.payload)) {
        return jsonNoStore({error:"Stored design failed integrity verification."},{status:409});
      }
      return jsonNoStore({revision:row.payload,expiresAt:row.expires_at});
    }

    if(action==="deleteOwned"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const deleted=await rpc<boolean>("designer_locked_revision_vault_delete_owned",{
        p_vault_id:String(body.vaultId||""),p_owner_user_id:customer.id,
      });
      return jsonNoStore({deleted:Boolean(deleted)});
    }

    const parsed=parseDesignVaultRecoveryToken(String(body.recoveryToken||""));
    if(!parsed) return jsonNoStore({error:"The recovery token is invalid."},{status:400});

    if(action==="claim"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const claimed=await rpc<boolean>("designer_locked_revision_vault_set_owner",{
        p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,p_owner_user_id:customer.id,
      });
      if(claimed){
        const rows=await rpc<Array<{payload:LockedDesignRevision;expires_at:string}>>("designer_locked_revision_vault_get",{
          p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,
        });
        const revision=rows[0]?.payload;
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
      return jsonNoStore({claimed:Boolean(claimed)});
    }

    if(action==="load"){
      const rows=await rpc<Array<{payload:LockedDesignRevision;expires_at:string}>>("designer_locked_revision_vault_get",{
        p_vault_id:parsed.vaultId,
        p_access_hash:parsed.accessHash,
      });
      const row=rows[0];
      if(!row?.payload) return jsonNoStore({error:"Design not found or recovery token expired."},{status:404});
      if(!await verifyLockedDesignRevision(row.payload)) {
        return jsonNoStore({error:"Stored design failed integrity verification."},{status:409});
      }
      return jsonNoStore({revision:row.payload,expiresAt:row.expires_at});
    }

    if(action==="delete"){
      const deleted=await rpc<boolean>("designer_locked_revision_vault_delete",{
        p_vault_id:parsed.vaultId,
        p_access_hash:parsed.accessHash,
      });
      return jsonNoStore({deleted:Boolean(deleted)});
    }

    return jsonNoStore({error:"Unsupported design-vault action."},{status:400});
  }catch(error){
    console.error("[designer/vault]",error);
    return jsonNoStore({error:"Secure design storage is temporarily unavailable."},{status:503});
  }
}
