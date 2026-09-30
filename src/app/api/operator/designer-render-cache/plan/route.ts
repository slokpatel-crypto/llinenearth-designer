import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { buildDesignerPrewarmPlan } from "@/lib/designer/prewarm-plan";
import { loadPopularDesignerRenderPairs } from "@/lib/designer/render-cache";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request) {
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }
  const raw=Number(new URL(request.url).searchParams.get("limit")||12);
  const limit=Math.max(1,Math.min(30,Number.isFinite(raw)?Math.floor(raw):12));
  const [plan,popularPairs]=await Promise.all([
    Promise.resolve(buildDesignerPrewarmPlan(limit)),
    loadPopularDesignerRenderPairs(limit),
  ]);
  return NextResponse.json({
    engine:"private-designer-prewarm-plan-v1",
    visibleOnCustomerWeb:false,
    spendsRenderCredits:false,
    note:"Candidates are planning output only. No FASHN request is made by this endpoint.",
    candidates:plan,
    existingPopularPairs:popularPairs,
  },{headers:{"cache-control":"private, no-store, max-age=0","x-content-type-options":"nosniff"}});
}
