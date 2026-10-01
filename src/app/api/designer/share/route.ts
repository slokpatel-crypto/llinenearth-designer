import { NextResponse } from "next/server";
import { createDesignShareToken, designShareConfigured } from "@/lib/designer/design-share";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime="nodejs";

export async function POST(request:Request){
  try{
    const revision=await request.json() as LockedDesignRevision;
    if(!revision || revision.version!=="linen-earth-design-lock-v1") {
      return NextResponse.json({error:"A locked Linen Earth design revision is required."},{status:400});
    }
    if(!await verifyLockedDesignRevision(revision)) {
      return NextResponse.json({error:"The locked design revision did not pass integrity verification."},{status:409});
    }
    if(!designShareConfigured()) {
      return NextResponse.json({error:"Design sharing is not configured on this deployment."},{status:503});
    }
    const token=createDesignShareToken(revision);
    if(!token) return NextResponse.json({error:"Could not create a share token."},{status:500});

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
        if(!audit.ok) console.error("[designer/share] audit failed",audit.status,(await audit.text()).slice(0,240));
      }catch(error){
        console.error("[designer/share] audit failed",error);
      }
    }

    return NextResponse.json({token,expiresInDays:30,audited});
  }catch{
    return NextResponse.json({error:"Could not create a share link for this design."},{status:400});
  }
}
