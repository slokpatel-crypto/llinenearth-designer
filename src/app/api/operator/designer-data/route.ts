import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FABRIC_STOCK } from "@/lib/fabric-stock";
import { loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const jar = await cookies();
  const valid = await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if (!valid) return NextResponse.json({error:"Unauthorized."},{status:401});

  const cloud = getSupabaseAdminConfig();
  const metadata = await loadDesignerFabricMetadata();

  return NextResponse.json({
    configured:Boolean(cloud),
    fabrics:FABRIC_STOCK.map((fabric)=>({
      id:fabric.id,
      colorName:fabric.colorName,
      line:fabric.line,
      family:fabric.family,
      pattern:fabric.pattern,
      suitableFor:fabric.suitableFor,
      swatchImageUrl:fabric.swatchImageUrl,
      yarnCountLea:fabric.yarnCountLea || [],
      metadata:metadata[fabric.id] || {
        fabricId:fabric.id,
        availability:"unknown",
      },
    })),
  });
}
