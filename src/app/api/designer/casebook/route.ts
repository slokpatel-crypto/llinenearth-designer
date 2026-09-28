import { NextResponse } from "next/server";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { aggregateDesignerCasebook } from "@/lib/designer/casebook";
import { aggregateFitOutcomes } from "@/lib/designer/fit-outcomes";
import { aggregateCreativeLearning } from "@/lib/designer/creative-learning";

export const runtime = "nodejs";

type CaseRow = {
  type: string;
  source: string;
  payload: Record<string,unknown>;
};

export async function GET() {
  const cloud=getSupabaseAdminConfig();
  if(!cloud) {
    return NextResponse.json({
      configured:false,
      casebook:aggregateDesignerCasebook([]),
      fitOutcomes:aggregateFitOutcomes([]),
      creativeLearning:aggregateCreativeLearning([]),
    },{headers:{"cache-control":"no-store"}});
  }

  try {
    const operatorParams=new URLSearchParams({
      select:"type,source,payload",
      source:"eq.operator",
      type:"eq.operator_note",
      order:"received_at.asc",
      limit:"3000",
    });
    const feedbackParams=new URLSearchParams({
      select:"type,source,payload",
      source:"eq.style-director",
      type:"eq.designer_feedback",
      order:"received_at.asc",
      limit:"3000",
    });
    const [operatorResponse,feedbackResponse]=await Promise.all([
      fetch(`${cloud.url}/rest/v1/style_events?${operatorParams.toString()}`,{
        headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},cache:"no-store",
      }),
      fetch(`${cloud.url}/rest/v1/style_events?${feedbackParams.toString()}`,{
        headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},cache:"no-store",
      }),
    ]);

    if(!operatorResponse.ok || !feedbackResponse.ok) {
      const failed=!operatorResponse.ok?operatorResponse:feedbackResponse;
      console.error("[designer/casebook]",failed.status,(await failed.text()).slice(0,300));
      return NextResponse.json({error:"Designer casebook is temporarily unavailable."},{status:502});
    }

    const operatorRows=await operatorResponse.json() as CaseRow[];
    const feedbackRows=await feedbackResponse.json() as CaseRow[];
    const events=[...operatorRows,...feedbackRows].map((row)=>({
      type:row.type,
      source:row.source,
      payload:row.payload || {},
    }));
    const casebook=aggregateDesignerCasebook(events);
    const fitOutcomes=aggregateFitOutcomes(events);
    const creativeLearning=aggregateCreativeLearning(events);

    // Only aggregate reviewed design/fit signatures leave the server. No raw
    // measurements, session identifiers, customer data or free-form notes are returned.
    return NextResponse.json({
      configured:true,
      casebook,
      fitOutcomes,
      creativeLearning,
    },{headers:{"cache-control":"no-store"}});
  } catch(error) {
    console.error("[designer/casebook]",error);
    return NextResponse.json({error:"Designer casebook is temporarily unavailable."},{status:500});
  }
}
