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
import { loadDesignerFabricIntelligence } from "@/lib/fabric-intelligence-server";
import { loadDurableSelectedLookRender, storeDurableSelectedLookRender } from "@/lib/designer/render-cache";

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

    // Never trust physical facts posted by the browser. Enrich the render only
    // from the private Analyzer store, where mm/GSM/drape/fibre values exist
    // only when supplied as verified owner/supplier evidence.
    const intelligence=await loadDesignerFabricIntelligence([input.shirt.id,input.pant.id]);
    const renderFacts=(fabricId:string)=>{
      const value=intelligence[fabricId];
      if(!value) return undefined;
      return {
        gsm:value.verifiedPhysical.gsm,
        drape:value.verifiedPhysical.drape,
        fiberContent:value.verifiedPhysical.fiberContent,
        repeatMm:value.measuredEvidence.patternPhysicalScale==="unknown" ? null : value.measuredEvidence.repeatMm,
        stripeWidthMm:value.measuredEvidence.patternPhysicalScale==="unknown" ? null : value.measuredEvidence.stripeWidthMm,
        physicalScaleStatus:value.measuredEvidence.patternPhysicalScale,
      };
    };
    input.renderEvidence={
      shirt:renderFacts(input.shirt.id),
      pant:renderFacts(input.pant.id),
    };
    const repairInstruction=String(input.repairInstruction||"").replace(/\s+/g," ").trim().slice(0,240);
    if(view==="front" && repairInstruction) {
      assertFashnRepairRateLimit(request);
      const result=await repairSelectedLookFashnFront(input,String(input.previousImage||""),repairInstruction);
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
