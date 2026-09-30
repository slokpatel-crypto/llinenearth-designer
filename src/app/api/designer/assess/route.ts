import { NextResponse } from "next/server";
import {
  DESIGNER_STYLE_CHOICES,
  designerFabricFromStock,
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
import { buildCanonicalGarmentSpec, type CanonicalCreativeVisualReview } from "@/lib/designer/garment-spec";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import type { MeasurementProfile } from "@/lib/measurements";
import type { TailorObservationProfile } from "@/lib/designer/tailor-observations";
import type { CreativeDirection } from "@/lib/designer/creative-engine";
import { toLegacyStyle, validateStyleSpecV2, type StyleSpecV2 } from "@/lib/designer/style-spec-v2";
import { validBodyPreviewProfile, type BodyPreviewProfile } from "@/lib/designer/body-profile";

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
  if(!value || typeof value!=="object" || Array.isArray(value)) return null;
  const input=value as Partial<MeasurementProfile>;
  if(input.version!==1 || !["cm","in"].includes(String(input.unit)) || !input.shirt || !input.pants) return null;
  const clean=(source:Record<string,unknown>)=>Object.fromEntries(
    Object.entries(source).filter(([,raw])=>{
      if(raw===undefined || raw===null || raw==="") return false;
      const n=Number(raw);
      return Number.isFinite(n) && n>0 && n<=350;
    }).map(([key,raw])=>[key,Number(raw)])
  );
  return {
    version:1,
    unit:input.unit as "cm"|"in",
    shirt:clean(input.shirt as unknown as Record<string,unknown>),
    pants:clean(input.pants as unknown as Record<string,unknown>),
    updatedAt:typeof input.updatedAt==="string"?input.updatedAt.slice(0,80):new Date().toISOString(),
  };
}

function safeObservations(value:unknown):TailorObservationProfile|null {
  if(!value || typeof value!=="object" || Array.isArray(value)) return null;
  const input=value as Partial<TailorObservationProfile>;
  if(input.version!==1) return null;
  const shoulder=["unknown","level","square","sloping"] as const;
  const posture=["unknown","balanced","erect","forward"] as const;
  const seat=["unknown","balanced","flat","full"] as const;
  const mobility=["standard","high"] as const;
  if(!shoulder.includes(input.shoulderBalance as never) || !posture.includes(input.posture as never) || !seat.includes(input.seatBalance as never) || !mobility.includes(input.mobilityPriority as never)) return null;
  return {
    version:1,
    shoulderBalance:input.shoulderBalance!,
    posture:input.posture!,
    seatBalance:input.seatBalance!,
    mobilityPriority:input.mobilityPriority!,
    updatedAt:typeof input.updatedAt==="string"?input.updatedAt.slice(0,80):new Date().toISOString(),
  };
}

function safeVisualReview(value:unknown):CanonicalCreativeVisualReview|null {
  if(!value || typeof value!=="object" || Array.isArray(value)) return null;
  const input=value as Record<string,unknown>;
  const status=String(input.status||"");
  if(!["pass","review"].includes(status)) return null;
  return {
    status:status as "pass"|"review",
    heroVisibility:Math.max(0,Math.min(100,Number(input.heroVisibility)||0)),
    boundaryIntegrity:Math.max(0,Math.min(100,Number(input.boundaryIntegrity)||0)),
    protectedChange:Math.max(0,Math.min(100,Number(input.protectedChange)||0)),
    evidenceAvailable:Boolean(input.evidenceAvailable),
    semanticAvailable:Boolean(input.semanticAvailable),
    ...(["pass","review"].includes(String(input.semanticStatus))?{semanticStatus:String(input.semanticStatus) as "pass"|"review"}:{}),
    ...(typeof input.semanticIssue==="string"?{semanticIssue:input.semanticIssue.slice(0,180)}:{}),
    ...(typeof input.redesignReason==="string"?{redesignReason:input.redesignReason.slice(0,40)}:{}),
  };
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
    !input.baseStyle || !input.recommendation
  ) return null;
  return value as CreativeDirection;
}

export async function POST(request:Request) {
  if(rateLimited(request)) return NextResponse.json({error:"Designer assessment is temporarily rate limited."},{status:429});
  const contentLength=Number(request.headers.get("content-length")||0);
  if(contentLength>180_000) return NextResponse.json({error:"Designer assessment request is too large."},{status:413});
  try {
    const body=await request.json() as {
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
    const shirtId=String(body.shirtId||"").slice(0,160);
    const pantId=String(body.pantId||"").slice(0,160);
    const occasion=String(body.occasion||"") as OccasionTier;
    const styleSpec=validateStyleSpecV2(body.styleSpec) ? body.styleSpec as StyleSpecV2 : null;
    const bodyProfile=validBodyPreviewProfile(body.bodyProfile) ? body.bodyProfile as BodyPreviewProfile : null;
    const resolvedStyle=styleSpec ? toLegacyStyle(styleSpec) : body.style;
    if(!shirtId || !pantId || !OCCASIONS.includes(occasion) || !validStyle(resolvedStyle) || !validContext(body.context)) {
      return NextResponse.json({error:"A valid fabric pair, occasion and supported style are required."},{status:400});
    }

    const metadata=await loadDesignerFabricMetadata();
    const stock=applyDesignerFabricMetadataToStock(metadata).filter((fabric)=>fabric.inStock);
    const fabrics=stock.map(designerFabricFromStock);
    const shirt=fabrics.find((fabric)=>fabric.id===shirtId && fabric.allowedGarments.includes("shirt"));
    const pant=fabrics.find((fabric)=>fabric.id===pantId && fabric.allowedGarments.includes("pant"));
    if(!shirt || !pant) return NextResponse.json({error:"The selected fabrics are no longer available in the current Designer catalogue."},{status:409});

    const measurements=safeMeasurements(body.measurements);
    const observations=safeObservations(body.observations);
    const creative=safeCreative(body.creative);
    const visualReview=safeVisualReview(body.creativeVisualReview);
    const recommendation=evaluateDesignerCombo(shirt,pant,occasion,resolvedStyle,undefined,body.context);
    const fitConstruction=assessFitConstruction(measurements,resolvedStyle,{
      climate:body.context.climate,
      shirtFabric:shirt,
      trouserFabric:pant,
      observations,
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
    },{headers:{"cache-control":"no-store"}});
  } catch(error) {
    console.error("[designer/assess]",error);
    return NextResponse.json({error:"Designer could not assess this look."},{status:500});
  }
}
