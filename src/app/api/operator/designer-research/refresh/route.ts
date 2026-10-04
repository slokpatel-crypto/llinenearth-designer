import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { appendCreativeEvent } from "@/lib/designer/creative-profile-server";
import { refreshDesignerResearch, researchRefreshStatus } from "@/lib/designer/research-refresh-server";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request){
  const jar=await cookies();if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value))return NextResponse.json({error:"Operator login required."},{status:401});
  if(request.headers.get("origin")&&request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({error:"Same-origin request required."},{status:403});
  try{const body=await request.json() as {action?:string;enabled?:unknown};
    if(body.action==="settings"&&typeof body.enabled==="boolean"){await appendCreativeEvent("operator_note",{subtype:"designer_research_schedule",enabled:body.enabled},{source:"operator",session:"research-schedule"});return NextResponse.json(await researchRefreshStatus());}
    if(body.action!=="refresh")return NextResponse.json({error:"Supported research action required."},{status:400});
    return NextResponse.json(await refreshDesignerResearch(true));
  }catch{return NextResponse.json({error:"Research refresh is temporarily unavailable."},{status:503});}
}
