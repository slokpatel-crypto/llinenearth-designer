import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { runFabricAnalyzerCalibration } from "@/lib/fabric-analyzer-calibration";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

function sameOrigin(request:Request) {
  const origin=request.headers.get("origin");
  if(!origin) return true;
  try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}

export async function POST(request:Request) {
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }
  if(!sameOrigin(request)) return NextResponse.json({error:"Cross-site calibration requests are not allowed."},{status:403});
  const body=await request.json().catch(()=>({})) as {limit?:unknown};
  const limit=Math.max(1,Math.min(4,Number(body.limit)||4));
  const result=await runFabricAnalyzerCalibration(limit);
  return NextResponse.json(result,{headers:{"cache-control":"private, no-store, max-age=0","x-content-type-options":"nosniff"}});
}
