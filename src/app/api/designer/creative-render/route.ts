import { NextResponse } from "next/server";
import {
  assertFashnRateLimit,
  FashnVisualizationError,
  renderCreativeFashnFront,
  type CreativeFashnRequest,
} from "@/lib/ai-visualization";

export const runtime="nodejs";
export const maxDuration=60;

function valid(body:unknown):body is CreativeFashnRequest {
  if(!body || typeof body!=="object") return false;
  const value=body as Partial<CreativeFashnRequest>;
  return Boolean(
    value.shirt?.id && value.shirt?.image &&
    value.pant?.id && value.pant?.image &&
    value.style?.collar && value.style?.cuff &&
    value.creative?.id && value.creative?.name &&
    Array.isArray(value.creative?.treatments) &&
    value.creative.treatments.length>0 &&
    value.creative.treatments.length<=8
  );
}

export async function POST(request:Request) {
  try {
    const body=await request.json() as unknown;
    if(!valid(body)) return NextResponse.json({error:"A selected V5 concept, fabrics and supported base cut are required."},{status:400});
    assertFashnRateLimit(request);
    const result=await renderCreativeFashnFront(body);
    return NextResponse.json({result});
  } catch(error) {
    if(error instanceof FashnVisualizationError) {
      const status=error.code==="not_configured"?503:error.code==="invalid_source"?400:error.code==="rate_limited"?429:502;
      return NextResponse.json({error:error.message},{status});
    }
    console.error("[designer/creative-render]",error);
    return NextResponse.json({error:"The photoreal Creative Lab render could not be completed. The design specification is still saved."},{status:500});
  }
}
