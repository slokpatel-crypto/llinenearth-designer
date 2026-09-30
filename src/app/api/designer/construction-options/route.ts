import { NextResponse } from "next/server";
import { loadDesignerOptionReviews } from "@/lib/designer/option-reviews";

export const runtime="nodejs";

export async function GET() {
  const reviews=await loadDesignerOptionReviews();
  return NextResponse.json({
    reviews:Object.fromEntries(Object.entries(reviews).map(([id,review])=>[id,review.status])),
  },{headers:{"cache-control":"private, no-store"}});
}
