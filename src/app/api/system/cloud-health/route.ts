import { NextResponse } from "next/server";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const cloud = getSupabaseAdminConfig();
  if (!cloud) {
    return NextResponse.json({
      configured:false,
      connected:false,
      schemaVersion:null,
      healthy:false,
    },{headers:{"cache-control":"no-store"}});
  }

  try {
    const response = await fetch(`${cloud.url}/rest/v1/rpc/llinen_cloud_health`,{
      method:"POST",
      headers:{
        ...supabaseAdminHeaders(cloud),
        "content-type":"application/json",
        accept:"application/json",
      },
      body:"{}",
      cache:"no-store",
    });

    if (!response.ok) {
      console.error("[system/cloud-health]",response.status,(await response.text()).slice(0,180));
      return NextResponse.json({
        configured:true,
        connected:false,
        schemaVersion:null,
        healthy:false,
      },{status:503,headers:{"cache-control":"no-store"}});
    }

    const raw = await response.json() as Record<string,unknown>;
    const schemaVersion = Number(raw.schemaVersion || 0) || null;
    const healthy = schemaVersion === 5
      && raw.tableExists === true
      && raw.rlsEnabled === true
      && raw.anonSelect === false
      && raw.authenticatedSelect === false
      && raw.serviceSelect === true
      && raw.serviceInsert === true
      && raw.serviceUpdate === false
      && raw.serviceDelete === false;

    return NextResponse.json({
      configured:true,
      connected:true,
      schemaVersion,
      healthy,
    },{headers:{"cache-control":"no-store"}});
  } catch (error) {
    console.error("[system/cloud-health]",error);
    return NextResponse.json({
      configured:true,
      connected:false,
      schemaVersion:null,
      healthy:false,
    },{status:503,headers:{"cache-control":"no-store"}});
  }
}
