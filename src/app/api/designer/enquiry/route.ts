import { NextResponse } from "next/server";
import { readLockedHandoffRequest, verifiedLockedHandoffAuditId } from "@/lib/designer/locked-handoff-request";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
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

    const spec=revision.garmentSpec;
    const details=[
      "Locked revision: "+revision.revisionId,
      "Recipe hash: "+revision.recipeHash.slice(0,12).toUpperCase(),
      "Shirt: "+spec.fabrics.shirt.name+" — "+spec.shirt.fit+"; "+spec.shirt.collar+"; "+spec.shirt.cuff,
      "Trouser: "+spec.fabrics.trouser.name+" — "+spec.trouser.shape+"; "+spec.trouser.rise+"; "+spec.trouser.waistband,
      "Occasion: "+spec.context.occasion,
    ].join("\n");
    const href=buildWhatsAppUrl({
      topic:"Locked Designer look",
      garment:"Shirt + trouser",
      details,
    });

    let audited=false;
    const cloud=getSupabaseAdminConfig();
    if(cloud){
      try{
        const audit=await fetch(cloud.url.replace(/\/$/,"")+"/rest/v1/rpc/design_enquiry_audit_record",{
          method:"POST",
          headers:{...supabaseAdminHeaders(cloud),"content-type":"application/json",accept:"application/json"},
          body:JSON.stringify({p_revision_id:revision.revisionId,p_recipe_hash:revision.recipeHash}),
          cache:"no-store",
          signal:AbortSignal.timeout(8_000),
        });
        if(audit.ok){
          const auditId=verifiedLockedHandoffAuditId(await audit.json().catch(()=>null));
          audited=Boolean(auditId);
          if(!audited) console.error("[designer/enquiry] audit RPC did not return a valid audit ID");
        }else{
          console.error("[designer/enquiry] audit failed",audit.status);
        }
      }catch(error){
        console.error("[designer/enquiry] audit failed",error);
      }
    }

    // This confirms preparation only. A WhatsApp deep link is not proof of delivery to staff.
    return privateJson({href,audited,revisionId:revision.revisionId,handoffStatus:"prepared_not_sent"});
  }catch{
    return privateJson({error:"Could not create a locked-look enquiry."},{status:400});
  }
}
