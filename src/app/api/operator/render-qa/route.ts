import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { listRenderOutcomes, reviewRenderOutcome } from "@/lib/designer/render-outcomes";
import { summarizeRenderOutcomes } from "@/lib/designer/render-outcome-metrics";

export const runtime="nodejs";

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  const outcomes=await listRenderOutcomes(300);
  return NextResponse.json({
    outcomes,
    summary:summarizeRenderOutcomes(outcomes),
  },{headers:{"cache-control":"private, no-store"}});
}

export async function POST(request:Request){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const body=await request.json() as {outcomeId?:string;status?:string;note?:string};
    const outcomeId=String(body.outcomeId||"").trim();
    const status=String(body.status||"");
    if(!outcomeId||!["approved","rejected"].includes(status)) {
      return NextResponse.json({error:"Outcome and review status are required."},{status:400});
    }
    const updated=await reviewRenderOutcome({
      outcomeId,
      status:status as "approved"|"rejected",
      note:String(body.note||""),
    });
    return NextResponse.json({updated:Boolean(updated)});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Render review failed."},{status:409});
  }
}
