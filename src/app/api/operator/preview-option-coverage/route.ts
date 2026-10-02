import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig } from "@/lib/supabase-admin";
import { customerPreviewCoverageRows } from "@/lib/designer/preview-option-reviews";
import { summarizePreviewOptionCoverage } from "@/lib/designer/preview-option-coverage";

export const runtime="nodejs";

export async function GET(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)){
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }
  try{
    const rows=await customerPreviewCoverageRows();
    const summary=summarizePreviewOptionCoverage(rows.map((row)=>({
      id:row.id,
      styleKey:row.styleKey,
      label:row.label,
      livePreview:row.livePreview,
      constructionStatus:row.constructionStatus,
      previewStatus:row.previewReview?.status||"pending",
    })));
    return NextResponse.json({
      configured:Boolean(getSupabaseAdminConfig()),
      rows,
      summary,
    },{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/preview-option-coverage]",error);
    return NextResponse.json({error:"Preview coverage could not be loaded."},{status:503});
  }
}
