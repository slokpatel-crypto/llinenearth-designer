import { NextResponse } from "next/server";
import {
  assertFashnRateLimit,
  FashnVisualizationError,
  renderSelectedLookFashnFront,
  type SelectedLookFashnRequest,
} from "@/lib/ai-visualization";

export const runtime="nodejs";
export const maxDuration=60;

function valid(body:unknown):body is SelectedLookFashnRequest {
  if(!body || typeof body!=="object") return false;
  const value=body as Partial<SelectedLookFashnRequest>;
  return Boolean(
    value.shirt?.id && value.shirt?.image &&
    value.pant?.id && value.pant?.image &&
    value.style?.collar && value.style?.cuff &&
    value.style?.placket && value.style?.shirtWear
  );
}

export async function POST(request:Request) {
  try {
    const body=await request.json() as unknown;
    if(!valid(body)) return NextResponse.json({error:"Selected fabrics and a supported garment configuration are required."},{status:400});
    assertFashnRateLimit(request);
    const result=await renderSelectedLookFashnFront(body);
    return NextResponse.json({result});
  } catch(error) {
    if(error instanceof FashnVisualizationError) {
      const status=error.code==="not_configured"?503:error.code==="invalid_source"?400:error.code==="rate_limited"?429:502;
      return NextResponse.json({error:error.message},{status});
    }
    console.error("[designer/look-render]",error);
    return NextResponse.json({error:"The photoreal selected-look render could not be completed. Your fabric and style choices are unchanged."},{status:500});
  }
}
