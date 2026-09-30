import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { GARMENT_OPTION_LIBRARY } from "@/lib/designer/options/library";
import { loadDesignerOptionReviews } from "@/lib/designer/option-reviews";
import { getSupabaseAdminConfig } from "@/lib/supabase-admin";

export const runtime="nodejs";

export async function GET() {
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }
  const reviews=await loadDesignerOptionReviews();
  const options=GARMENT_OPTION_LIBRARY
    .filter((option)=>option.provenance==="owner-provided")
    .map((option)=>({
      id:option.id,
      group:option.group,
      label:option.label,
      description:option.description,
      formality:option.formality,
      climateTags:option.climateTags,
      parameters:option.parameters,
      renderSupport:option.renderSupport,
      review:reviews[option.id]||null,
    }))
    .sort((a,b)=>{
      const priority=(value:typeof a)=>{
        if(value.group==="pant.fit"||value.group==="pant.rise") return 0;
        if(value.group.startsWith("pant.")) return 1;
        if(value.group==="shirt.type"||value.group==="shirt.fit") return 2;
        return 3;
      };
      return priority(a)-priority(b) || a.group.localeCompare(b.group) || a.label.localeCompare(b.label);
    });
  const approved=options.filter((option)=>option.review?.status==="approved").length;
  const rejected=options.filter((option)=>option.review?.status==="rejected").length;
  return NextResponse.json({
    configured:Boolean(getSupabaseAdminConfig()),
    total:options.length,
    approved,
    rejected,
    pending:options.length-approved-rejected,
    options,
  },{headers:{"cache-control":"private, no-store"}});
}
