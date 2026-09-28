import { NextResponse } from "next/server";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { aggregateDesignerCasebook } from "@/lib/designer/casebook";

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
    },{headers:{"cache-control":"no-store"}});
  }

  try {
    const params=new URLSearchParams({
      select:"type,source,payload",
      source:"eq.operator",
      type:"eq.operator_note",
      order:"received_at.desc",
      limit:"3000",
    });
    const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
      cache:"no-store",
    });

    if(!response.ok) {
      console.error("[designer/casebook]",response.status,(await response.text()).slice(0,300));
      return NextResponse.json({error:"Designer casebook is temporarily unavailable."},{status:502});
    }

    const rows=await response.json() as CaseRow[];
    const casebook=aggregateDesignerCasebook(rows.map((row)=>({
      type:row.type,
      source:row.source,
      payload:row.payload || {},
    })));

    // Only aggregate reviewed design signatures leave the server. No session
    // identifiers, customer data or free-form operator notes are returned.
    return NextResponse.json({
      configured:true,
      casebook,
    },{headers:{"cache-control":"no-store"}});
  } catch(error) {
    console.error("[designer/casebook]",error);
    return NextResponse.json({error:"Designer casebook is temporarily unavailable."},{status:500});
  }
}
