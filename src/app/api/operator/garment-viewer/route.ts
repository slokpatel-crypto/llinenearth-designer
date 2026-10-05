import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { loadLatestGarmentViewerReadiness } from "@/lib/garment-viewer-evidence-server";

export const runtime="nodejs";

export async function GET(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }
  const status=await loadLatestGarmentViewerReadiness();
  return NextResponse.json(status,{headers:{"cache-control":"private, no-store"}});
}
