import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { summarizeRoadmapBackendHealth } from "@/lib/designer/roadmap-backend-health";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)){
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }
  const cloud=getSupabaseAdminConfig();
  if(!cloud){
    return NextResponse.json({
      configured:false,
      summary:summarizeRoadmapBackendHealth({}),
    },{headers:{"cache-control":"private, no-store"}});
  }
  try{
    const response=await fetch(cloud.url.replace(/\/$/,"")+"/rest/v1/rpc/roadmap_v2_evidence_health",{
      method:"POST",
      headers:{...supabaseAdminHeaders(cloud),"content-type":"application/json",accept:"application/json"},
      body:"{}",
      cache:"no-store",
      signal:AbortSignal.timeout(8_000),
    });
    if(!response.ok){
      const detail=(await response.text()).replace(/\s+/g," ").slice(0,240);
      throw new Error("Roadmap backend health RPC failed ("+response.status+"): "+detail);
    }
    const payload=await response.json() as unknown;
    const raw=Array.isArray(payload)?payload[0]:payload;
    const summary=summarizeRoadmapBackendHealth(raw);
    return NextResponse.json({
      configured:true,
      checkedAt:new Date().toISOString(),
      summary,
    },{headers:{"cache-control":"private, no-store","pragma":"no-cache"}});
  }catch(error){
    console.error("[operator/roadmap-backend-health]",error);
    return NextResponse.json({
      error:"Production backend health could not be verified.",
      summary:summarizeRoadmapBackendHealth({}),
    },{status:503});
  }
}
