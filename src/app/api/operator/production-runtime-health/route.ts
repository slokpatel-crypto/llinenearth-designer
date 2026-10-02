import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { productionRuntimeHealthFromEnv } from "@/lib/designer/production-runtime-health";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)){
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }

  const summary=productionRuntimeHealthFromEnv();
  return NextResponse.json({
    checkedAt:new Date().toISOString(),
    summary,
  },{
    status:summary.gateComplete?200:503,
    headers:{"cache-control":"private, no-store","pragma":"no-cache"},
  });
}
