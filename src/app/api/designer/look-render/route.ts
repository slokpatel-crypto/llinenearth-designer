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
import { loadDurableSelectedLookRender, storeDurableSelectedLookRender } from "@/lib/designer/render-cache";
import { enrichSelectedLookEvidence, resolveSelectedLookRequest } from "@/lib/designer/selected-look-server";
import { loadDesignerOptionReviews, rejectedConstructionOptions } from "@/lib/designer/option-reviews";
import { recordRenderOutcome } from "@/lib/designer/render-outcomes";

export const runtime="nodejs";
export const maxDuration=60;

export async function POST(request:Request) {
  try {
    const body=await request.json() as Record<string,unknown>;
    const resolved=await resolveSelectedLookRequest(body);
    if(!resolved) return NextResponse.json({error:"Selected fabrics and a supported garment configuration are required."},{status:400});
    if(resolved.locked!==true) return NextResponse.json({error:"Lock the final design before using the photoreal renderer."},{status:409});
    if(resolved.styleSpec) {
      const constructionReviews=await loadDesignerOptionReviews();
      const rejected=rejectedConstructionOptions(resolved.styleSpec,constructionReviews);
      if(rejected.length) {
        return NextResponse.json({
          error:`This final design includes a construction option not offered by Linen Earth: ${rejected.map((item)=>item.label).join(", ")}. Choose an approved or provisional alternative before photoreal rendering.`,
        },{status:409});
      }
    }

    // Canonical stock data and verified Analyzer facts are resolved server-side.
    // Browser-posted fabric labels/images/physical facts never become render truth.
    const enriched=await enrichSelectedLookEvidence(resolved);
    const input:SelectedLookFashnRequest & {
      view?:SelectedLookView;
      frontImage?:string;
      previousImage?:string;
      repairInstruction?:string;
    }={
      ...enriched,
      view:body.view as SelectedLookView|undefined,
      frontImage:typeof body.frontImage==="string" ? body.frontImage : undefined,
      previousImage:typeof body.previousImage==="string" ? body.previousImage : undefined,
      repairInstruction:typeof body.repairInstruction==="string" ? body.repairInstruction : undefined,
    };
    const view:SelectedLookView=["front","three-quarter","side","back"].includes(String(input.view)) ? input.view as SelectedLookView : "front";
    const repairInstruction=String(input.repairInstruction||"").replace(/\s+/g," ").trim().slice(0,240);
    if(view==="front" && repairInstruction) {
      assertFashnRepairRateLimit(request);
      const result=await repairSelectedLookFashnFront(input,String(input.previousImage||""),repairInstruction);
      await recordRenderOutcome({result,view:"front",shirtId:input.shirt.id,pantId:input.pant.id,repair:true});
      return NextResponse.json({result});
    }
    if(view==="front") {
      const memoryCached=getCachedSelectedLookRender(input);
      if(memoryCached) return NextResponse.json({result:memoryCached},{headers:{"x-linen-render-cache":"memory"}});
      const durableCached=await loadDurableSelectedLookRender(input,"front");
      if(durableCached) return NextResponse.json({result:durableCached},{headers:{"x-linen-render-cache":"durable"}});
    } else {
      const frontImage=String(input.frontImage||"");
      if(!frontImage) return NextResponse.json({error:"Generate or load the locked front render before requesting another view."},{status:409});
      const durableCached=await loadDurableSelectedLookRender(input,view,frontImage);
      if(durableCached) return NextResponse.json({result:durableCached},{headers:{"x-linen-render-cache":"durable"}});
    }

    assertFashnRateLimit(request);
    const frontImage=String(input.frontImage||"");
    const result=view==="front"
      ? await renderSelectedLookFashnFront(input)
      : await renderSelectedLookFashnView(input,frontImage,view);
    await storeDurableSelectedLookRender(input,result,view,view==="front"?undefined:frontImage);
    await recordRenderOutcome({result,view,shirtId:input.shirt.id,pantId:input.pant.id});
    return NextResponse.json({result},{headers:{"x-linen-render-cache":"miss"}});
  } catch(error) {
    if(error instanceof FashnVisualizationError) {
      const status=error.code==="not_configured"?503:error.code==="invalid_source"?400:error.code==="rate_limited"?429:502;
      return NextResponse.json({error:error.message},{status});
    }
    console.error("[designer/look-render]",error);
    return NextResponse.json({error:"The photoreal selected-look render could not be completed. Your fabric and style choices are unchanged."},{status:500});
  }
}
