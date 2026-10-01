import { NextResponse } from "next/server";
import { verifyStyleDirectorHandoffToken, styleDirectorHandoffMatches } from "@/lib/designer/style-director-handoff";
import type { DesignerClimate, DesignerIntention, DesignerStyle, OccasionTier } from "@/lib/designer/engine";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime="nodejs";

export async function POST(request:Request){
  try{
    const body=await request.json() as {token?:string;shirtId?:string;pantId?:string;occasion?:OccasionTier;climate?:DesignerClimate;intention?:DesignerIntention;style?:DesignerStyle};
    const token=String(body.token||"");
    const payload=verifyStyleDirectorHandoffToken(token);
    if(!payload) return NextResponse.json({error:"Style Director handoff token is invalid or expired."},{status:409});
    if(!body.shirtId||!body.pantId||!body.occasion||!body.climate||!body.intention||!body.style) return NextResponse.json({error:"Observed Designer handoff state is incomplete."},{status:400});
    if(!styleDirectorHandoffMatches(payload,{shirtId:body.shirtId,pantId:body.pantId,occasion:body.occasion,climate:body.climate,intention:body.intention,style:body.style})){
      return NextResponse.json({error:"Designer state no longer matches the signed Style Director handoff."},{status:409});
    }

    const cloud=getSupabaseAdminConfig();
    if(!cloud) return NextResponse.json({verified:true,audited:false,auditId:null,sourceLookId:payload.sourceLookId});
    const response=await fetch(cloud.url.replace(/\/$/,"")+"/rest/v1/rpc/style_director_handoff_audit_record",{
      method:"POST",
      headers:{...supabaseAdminHeaders(cloud),"content-type":"application/json",accept:"application/json"},
      body:JSON.stringify({
        p_source_look_id:payload.sourceLookId,
        p_shirt_id:payload.shirtId,
        p_pant_id:payload.pantId,
        p_occasion:payload.occasion,
      }),
      cache:"no-store",
      signal:AbortSignal.timeout(8_000),
    });
    if(!response.ok){
      console.error("[style-director/handoff] audit failed",response.status,(await response.text()).slice(0,240));
      return NextResponse.json({verified:true,audited:false,auditId:null,sourceLookId:payload.sourceLookId});
    }
    const auditId=await response.json() as string;
    return NextResponse.json({verified:true,audited:true,auditId,sourceLookId:payload.sourceLookId});
  }catch(error){
    console.error("[style-director/handoff]",error);
    return NextResponse.json({error:"Style Director handoff could not be verified."},{status:400});
  }
}
