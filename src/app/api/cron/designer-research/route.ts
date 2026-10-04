import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshDesignerResearch } from "@/lib/designer/research-refresh-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET,provided=Buffer.from(request.headers.get("authorization")||""),expected=Buffer.from(`Bearer ${secret||""}`);
  if(!secret||provided.length!==expected.length||!timingSafeEqual(provided,expected))return NextResponse.json({error:"Research scheduler authorization required."},{status:401});
  try{return NextResponse.json(await refreshDesignerResearch(),{headers:{"cache-control":"no-store"}});}catch{return NextResponse.json({error:"Research refresh unavailable; inspect the run ledger before retrying."},{status:503});}
}
