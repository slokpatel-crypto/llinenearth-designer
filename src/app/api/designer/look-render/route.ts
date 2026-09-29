import { NextResponse } from "next/server";
import {
  assertFashnRateLimit,
  assertFashnRepairRateLimit,
  FashnVisualizationError,
  getCachedSelectedLookRender,
  renderSelectedLookFashnFront,
  renderSelectedLookFashnView,
  repairSelectedLookFashnFront,
  type SelectedLookFashnRequest,
  type SelectedLookView,
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
    const input=body as SelectedLookFashnRequest & {
      view?:SelectedLookView;
      frontImage?:string;
      previousImage?:string;
      repairInstruction?:string;
    };
    const view:SelectedLookView=["front","three-quarter","side","back"].includes(String(input.view)) ? input.view as SelectedLookView : "front";
    if(input.locked!==true) return NextResponse.json({error:"Lock the final design before using the photoreal renderer."},{status:409});
    const repairInstruction=String(input.repairInstruction||"").replace(/\s+/g," ").trim().slice(0,240);
    if(view==="front" && repairInstruction) {
      assertFashnRepairRateLimit(request);
      const result=await repairSelectedLookFashnFront(input,String(input.previousImage||""),repairInstruction);
      return NextResponse.json({result});
    }
    if(view==="front") {
      const cached=getCachedSelectedLookRender(input);
      if(cached) return NextResponse.json({result:cached},{headers:{"x-linen-render-cache":"hit"}});
    }
    assertFashnRateLimit(request);
    const result=view==="front"
      ? await renderSelectedLookFashnFront(input)
      : await renderSelectedLookFashnView(input,String(input.frontImage||""),view);
    return NextResponse.json({result},{headers:{"x-linen-render-cache":result.cached?"hit":"miss"}});
  } catch(error) {
    if(error instanceof FashnVisualizationError) {
      const status=error.code==="not_configured"?503:error.code==="invalid_source"?400:error.code==="rate_limited"?429:502;
      return NextResponse.json({error:error.message},{status});
    }
    console.error("[designer/look-render]",error);
    return NextResponse.json({error:"The photoreal selected-look render could not be completed. Your fabric and style choices are unchanged."},{status:500});
  }
}
