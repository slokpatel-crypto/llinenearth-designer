import { NextResponse } from "next/server";
import { readLockedHandoffRequest, verifiedLockedHandoffAuditId } from "@/lib/designer/locked-handoff-request";
import { createDesignShareToken, designShareConfigured } from "@/lib/designer/design-share";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime="nodejs";

function privateJson(body:unknown,init?:{status?:number}){
  return NextResponse.json(body,{...init,headers:{"cache-control":"private, no-store"}});
}

export async function POST(request:Request){
  try{
    const parsed=await readLockedHandoffRequest(request);
    if(!parsed.ok) return privateJson({error:parsed.error},{status:parsed.status});
    const revision=parsed.revision as unknown as LockedDesignRevision;
    if(!revision || revision.version!=="linen-earth-design-lock-v1") {
      return privateJson({error:"A locked Linen Earth design revision is required."},{status:400});
    }
    if(!await verifyLockedDesignRevision(revision)) {
      return privateJson({error:"The locked design revision did not pass integrity verification."},{status:409});
    }
    if(!designShareConfigured()) {
      return privateJson({error:"Design sharing is not configured on this deployment."},{status:503});
    }
    const token=createDesignShareToken(revision);
    if(!token) return privateJson({error:"Could not create a share token."},{status:500});

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
        if(audit.ok){
          const auditId=verifiedLockedHandoffAuditId(await audit.json().catch(()=>null));
          audited=Boolean(auditId);
          if(!audited) console.error("[designer/share] audit RPC did not return a valid audit ID");
        }else{
          console.error("[designer/share] audit failed",audit.status);
        }
      }catch(error){
        console.error("[designer/share] audit failed",error);
      }
    }

    return privateJson({token,expiresInDays:30,audited});
  }catch{
    return privateJson({error:"Could not create a share link for this design."},{status:400});
  }
}
