import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import {
  loadDesignerRenderCacheStats,
  loadPopularDesignerRenderPairs,
} from "@/lib/designer/render-cache";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET() {
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }
  const [database,popularPairs]=await Promise.all([
    loadDesignerRenderCacheStats(),
    loadPopularDesignerRenderPairs(20),
  ]);
  return NextResponse.json({
    engine:"private-designer-render-cache-v1",
    visibleOnCustomerWeb:false,
    database,
    popularPairs,
  },{headers:{"cache-control":"private, no-store, max-age=0","x-content-type-options":"nosniff"}});
}
