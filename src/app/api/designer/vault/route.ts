import { NextResponse } from "next/server";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";
import {
  createDesignVaultAccessKey,
  createDesignVaultRecoveryToken,
  hashDesignVaultAccessKey,
  parseDesignVaultRecoveryToken,
} from "@/lib/designer/design-vault";

export const runtime="nodejs";

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
  if(blocked(request)) return NextResponse.json({error:"Too many design-vault requests."},{status:429});
  try{
    const body=await request.json() as {action?:string;revision?:LockedDesignRevision;recoveryToken?:string};
    const action=String(body.action||"");

    if(action==="store"){
      const revision=body.revision;
      if(!revision||revision.version!=="linen-earth-design-lock-v1") {
        return NextResponse.json({error:"A locked Linen Earth design revision is required."},{status:400});
      }
      if(!await verifyLockedDesignRevision(revision)) {
        return NextResponse.json({error:"The locked design revision failed integrity verification."},{status:409});
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
      const recoveryToken=createDesignVaultRecoveryToken(vaultId,accessKey);
      return NextResponse.json({vaultId,recoveryToken,expiresInDays:180});
    }

    const parsed=parseDesignVaultRecoveryToken(String(body.recoveryToken||""));
    if(!parsed) return NextResponse.json({error:"The recovery token is invalid."},{status:400});

    if(action==="load"){
      const rows=await rpc<Array<{payload:LockedDesignRevision;expires_at:string}>>("designer_locked_revision_vault_get",{
        p_vault_id:parsed.vaultId,
        p_access_hash:parsed.accessHash,
      });
      const row=rows[0];
      if(!row?.payload) return NextResponse.json({error:"Design not found or recovery token expired."},{status:404});
      if(!await verifyLockedDesignRevision(row.payload)) {
        return NextResponse.json({error:"Stored design failed integrity verification."},{status:409});
      }
      return NextResponse.json({revision:row.payload,expiresAt:row.expires_at});
    }

    if(action==="delete"){
      const deleted=await rpc<boolean>("designer_locked_revision_vault_delete",{
        p_vault_id:parsed.vaultId,
        p_access_hash:parsed.accessHash,
      });
      return NextResponse.json({deleted:Boolean(deleted)});
    }

    return NextResponse.json({error:"Unsupported design-vault action."},{status:400});
  }catch(error){
    console.error("[designer/vault]",error);
    return NextResponse.json({error:"Secure design storage is temporarily unavailable."},{status:503});
  }
}
