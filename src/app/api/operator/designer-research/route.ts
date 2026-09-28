import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { aggregateCreativeResearch } from "@/lib/designer/creative-research";
import {
  FASHION_RESEARCH_POOL_STATS,
  FASHION_RESEARCH_SOURCES,
  FASHION_RESEARCH_TOPICS,
} from "@/lib/designer/fashion-research-source-pool";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET() {
  const jar=await cookies();
  const valid=await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if(!valid) return NextResponse.json({error:"Operator login required."},{status:401});

  const cloud=getSupabaseAdminConfig();
  if(!cloud) {
    return NextResponse.json({
      configured:false,
      library:aggregateCreativeResearch([]),
      pool:FASHION_RESEARCH_POOL_STATS,
      sources:FASHION_RESEARCH_SOURCES,
      topics:FASHION_RESEARCH_TOPICS,
    },{headers:{"cache-control":"no-store"}});
  }

  try {
    const params=new URLSearchParams({
      select:"type,source,payload",
      source:"eq.operator",
      type:"eq.operator_note",
      order:"received_at.asc",
      limit:"4000",
    });
    const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
      cache:"no-store",
    });
    if(!response.ok) return NextResponse.json({error:"Research library is temporarily unavailable."},{status:502});
    const rows=await response.json() as Array<{type:string;source:string;payload:Record<string,unknown>}>;
    return NextResponse.json({
      configured:true,
      library:aggregateCreativeResearch(rows),
      pool:FASHION_RESEARCH_POOL_STATS,
      sources:FASHION_RESEARCH_SOURCES,
      topics:FASHION_RESEARCH_TOPICS,
    },{headers:{"cache-control":"no-store"}});
  } catch(error) {
    console.error("[operator/designer-research]",error);
    return NextResponse.json({error:"Research library is temporarily unavailable."},{status:500});
  }
}
