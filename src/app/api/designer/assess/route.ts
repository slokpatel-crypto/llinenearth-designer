import { validCreativeCraft, resolveCraftFabrics } from "@/lib/designer/creative-spec";
import { NextResponse } from "next/server";
import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import {
  DESIGNER_STYLE_CHOICES,
  evaluateDesignerCombo,
  type DesignerClimate,
  type DesignerContext,
  type DesignerIntention,
  type DesignerStyle,
  type OccasionTier,
} from "@/lib/designer/engine";
import { assessFitConstruction } from "@/lib/designer/fit-construction";
import { assessBlockStrategy } from "@/lib/designer/block-strategy";
import { evaluateLinenEarthBrandLanguage } from "@/lib/designer/brand-language";
import { buildDesignerNegotiation } from "@/lib/designer/constraint-negotiation";
import { buildCanonicalGarmentSpec } from "@/lib/designer/garment-spec";
import { parseCanonicalCreativeVisualReview } from "@/lib/designer/visual-review-input";
import { loadActiveDesignerCatalogueFabrics } from "@/lib/designer/catalog-stock-server";
import type { MeasurementProfile } from "@/lib/measurements";
import { normalizeMeasuredBodyInput } from "@/lib/designer/measurement-input-validation";
import { validStoredTailorObservationProfile, type TailorObservationProfile } from "@/lib/designer/tailor-observations";
import type { CreativeDirection } from "@/lib/designer/creative-engine";
import { fromLegacyStyle, toLegacyStyle, validateStyleSpecV2, type StyleSpecV2 } from "@/lib/designer/style-spec-v2";
import { creativeDirectionMatchesSelection } from "@/lib/designer/creative-selection";
import { validBodyPreviewProfile, type BodyPreviewProfile } from "@/lib/designer/body-profile";
import { loadApprovedHouseEaseModel } from "@/lib/designer/house-ease-server";

export const runtime="nodejs";
export const maxDuration=20;

const OCCASIONS:OccasionTier[]=["Casual","Smart-Casual","Semi-Formal","Formal"];
const CLIMATES:DesignerClimate[]=["Not specified","Hot / humid","Cool","Air-conditioned"];
const INTENTIONS:DesignerIntention[]=["Understated","Balanced","Expressive"];

const registry=(globalThis as typeof globalThis & {__linenDesignerAssessRate?:Map<string,{at:number;count:number}>}).__linenDesignerAssessRate ||= new Map<string,{at:number;count:number}>();

function rateLimited(request:Request) {
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now=Date.now();
  const current=registry.get(ip);
  if(!current || now-current.at>60_000) {
    registry.set(ip,{at:now,count:1});
    return false;
  }
  current.count+=1;
  return current.count>40;
}

function validStyle(value:unknown):value is DesignerStyle {
  if(!value || typeof value!=="object" || Array.isArray(value)) return false;
  const input=value as Partial<DesignerStyle>;
  return (Object.keys(DESIGNER_STYLE_CHOICES) as Array<keyof DesignerStyle>).every((key)=>
    typeof input[key]==="string" && DESIGNER_STYLE_CHOICES[key].includes(input[key] as never)
  );
}

function validContext(value:unknown):value is DesignerContext {
  if(!value || typeof value!=="object" || Array.isArray(value)) return false;
  const input=value as Partial<DesignerContext>;
  return Boolean(input.climate && CLIMATES.includes(input.climate) && input.intention && INTENTIONS.includes(input.intention));
}

function safeMeasurements(value:unknown):MeasurementProfile|null {
  return normalizeMeasuredBodyInput(value);
}

function safeObservations(value:unknown):TailorObservationProfile|null {
  return validStoredTailorObservationProfile(value);
}

function safeCreative(value:unknown):CreativeDirection|null {
  if(!value || typeof value!=="object" || Array.isArray(value)) return null;
  const input=value as Partial<CreativeDirection>;
  if(
    typeof input.id!=="string" || input.id.length>220 ||
    typeof input.name!=="string" || input.name.length>180 ||
    typeof input.thesis!=="string" || input.thesis.length>900 ||
    !Array.isArray(input.treatments) || input.treatments.length>10 ||
    !Array.isArray(input.research) || input.research.length>8 ||
    !Array.isArray(input.critics) || input.critics.length>8 ||
    (input.craft!==undefined&&!validCreativeCraft(input.craft)) ||
    !input.baseStyle || !input.recommendation
  ) return null;
  return value as CreativeDirection;
}

export async function POST(request:Request) {
  if(rateLimited(request)) return NextResponse.json({error:"Designer assessment is temporarily rate limited."},{status:429});
  const unsafe=secureJsonRequestError(request,180_000);
  if(unsafe) return NextResponse.json({error:unsafe.error},{status:unsafe.status});
  try {
    const body=await readSecureJsonObject(request,180_000) as {
      shirtId?:unknown;
      pantId?:unknown;
      occasion?:unknown;
      style?:unknown;
      styleSpec?:unknown;
      bodyProfile?:unknown;
      context?:unknown;
      measurements?:unknown;
      observations?:unknown;
      creative?:unknown;
      creativeVisualReview?:unknown;
    };
    // A coerced JSON array may stringify to a real fabric ID or occasion.
    // Reject the supplied type and overlength IDs rather than laundering/truncating evidence.
    const shirtId=typeof body.shirtId==="string"&&body.shirtId.length<=160?body.shirtId:"";
    const pantId=typeof body.pantId==="string"&&body.pantId.length<=160?body.pantId:"";
    const occasion=(typeof body.occasion==="string"?body.occasion:"") as OccasionTier;
    const styleSpec=validateStyleSpecV2(body.styleSpec) ? body.styleSpec as StyleSpecV2 : null;
    // Invalid new-format cut choices must not silently downgrade to legacy
    // style fields and return a falsely favourable compatibility assessment.
    // Old clients with no expanded style remain supported unchanged.
    if(body.styleSpec!==undefined && body.styleSpec!==null && !styleSpec) {
      return NextResponse.json({error:"Invalid advanced tailoring specification; please reselect the cut options."},{status:422});
    }
    const bodyProfile=validBodyPreviewProfile(body.bodyProfile) ? body.bodyProfile as BodyPreviewProfile : null;
    if(body.bodyProfile!==undefined && body.bodyProfile!==null && !bodyProfile) {
      return NextResponse.json({error:"Invalid body preview profile; reselect the current model proportions."},{status:422});
    }
    const resolvedStyle=styleSpec ? toLegacyStyle(styleSpec) : body.style;
    if(!shirtId || !pantId || !OCCASIONS.includes(occasion) || !validStyle(resolvedStyle) || !validContext(body.context)) {
      return NextResponse.json({error:"A valid fabric pair, occasion and supported style are required."},{status:400});
    }

    let measurements:MeasurementProfile|null;
    try{ measurements=safeMeasurements(body.measurements); }
    catch(error){
      return NextResponse.json({
        error:error instanceof Error?error.message:"Invalid body measurements.",
      },{status:422});
    }
    const observations=safeObservations(body.observations);
    if(body.observations!==undefined && body.observations!==null && !observations) {
      return NextResponse.json({error:"Invalid tailor observations; review the current fit notes."},{status:422});
    }
    const [catalogue,easeModel]=await Promise.all([
      loadActiveDesignerCatalogueFabrics(),
      loadApprovedHouseEaseModel(),
    ]);
    const fabrics=catalogue.fabrics;
    const shirt=fabrics.find((fabric)=>fabric.id===shirtId && fabric.allowedGarments.includes("shirt"));
    const pant=fabrics.find((fabric)=>fabric.id===pantId && fabric.allowedGarments.includes("pant"));
    if(!shirt || !pant) return NextResponse.json({error:"The selected fabrics are no longer available in the current Designer catalogue."},{status:409});

    const creative=safeCreative(body.creative);
    if(body.creative&&!creative)return NextResponse.json({error:"Invalid creative recipe."},{status:400});
    // Revalidate the complete creative recipe against the live catalogue, not
    // merely the fabric IDs. A stale same-ID roll cannot enter a new tech pack.
    if(creative&&!creativeDirectionMatchesSelection(creative,{
      shirtId,pantId,shirt,pant,occasion,
      climate:body.context.climate,intention:body.context.intention,
      style:resolvedStyle,styleSpec:styleSpec??fromLegacyStyle(resolvedStyle),
    }))return NextResponse.json({
      error:"Creative direction no longer matches the selected fabric revision, context or cut.",
    },{status:409});
    if(creative?.craft){const canonical=resolveCraftFabrics(creative.craft,fabrics,shirtId,pantId);if(!canonical)return NextResponse.json({error:"Craft fabrics are unavailable or do not match this look."},{status:409});creative.craft=canonical;}
    const visualReview=parseCanonicalCreativeVisualReview(body.creativeVisualReview);
    if(body.creativeVisualReview!==undefined && body.creativeVisualReview!==null && !visualReview) {
      return NextResponse.json({error:"Invalid creative visual-review evidence; please review the current render again."},{status:422});
    }
    const recommendation=evaluateDesignerCombo(shirt,pant,occasion,resolvedStyle,undefined,body.context,styleSpec);
    const fitConstruction=assessFitConstruction(measurements,resolvedStyle,{
      climate:body.context.climate,
      shirtFabric:shirt,
      trouserFabric:pant,
      observations,
      easeModel,
    });
    const blockStrategy=assessBlockStrategy(measurements,resolvedStyle,observations);
    const brandLanguage=evaluateLinenEarthBrandLanguage(shirt,pant,resolvedStyle,occasion,body.context);
    const negotiation=buildDesignerNegotiation(recommendation,fitConstruction);
    const garmentSpec=buildCanonicalGarmentSpec(
      recommendation,
      fitConstruction,
      measurements,
      brandLanguage,
      blockStrategy,
      creative,
      visualReview,
      styleSpec,
      bodyProfile,
    );

    return NextResponse.json({
      assessment:{recommendation,fitConstruction,blockStrategy,brandLanguage,negotiation,garmentSpec},
      runtime:{houseEaseModel:easeModel?{modelId:easeModel.modelId,version:easeModel.version,approvedBy:easeModel.approvedBy}:null},
    },{headers:{"cache-control":"no-store"}});
  } catch(error) {
    if(error instanceof SecureJsonBodyTooLarge) return NextResponse.json({error:error.message},{status:413});
    if(error instanceof SecureJsonBodyInvalid) return NextResponse.json({error:error.message},{status:400});
    console.error("[designer/assess]",error);
    return NextResponse.json({error:"Designer could not assess this look."},{status:500});
  }
}
