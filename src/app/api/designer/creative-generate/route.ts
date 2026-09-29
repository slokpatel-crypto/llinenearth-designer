import { NextResponse } from "next/server";
import {
  DESIGNER_STYLE_CHOICES,
  designerFabricFromStock,
  type DesignerClimate,
  type DesignerContext,
  type DesignerIntention,
  type DesignerStyle,
  type OccasionTier,
} from "@/lib/designer/engine";
import {
  chooseCreativeRedesign,
  generateCreativeDirections,
  type CreativeDirection,
} from "@/lib/designer/creative-engine";
import type { CreativeFeedbackReason, CreativeLearningBook } from "@/lib/designer/creative-learning";
import type { CreativeResearchLibrary } from "@/lib/designer/creative-research";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";

export const runtime="nodejs";
export const maxDuration=30;

const OCCASIONS:OccasionTier[]=["Casual","Smart-Casual","Semi-Formal","Formal"];
const CLIMATES:DesignerClimate[]=["Not specified","Hot / humid","Cool","Air-conditioned"];
const INTENTIONS:DesignerIntention[]=["Understated","Balanced","Expressive"];

const registry=(globalThis as typeof globalThis & {__linenCreativeGenerateRate?:Map<string,{at:number;count:number}>}).__linenCreativeGenerateRate ||= new Map<string,{at:number;count:number}>();

function rateLimited(request:Request) {
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now=Date.now();
  const current=registry.get(ip);
  if(!current || now-current.at>60_000) {
    registry.set(ip,{at:now,count:1});
    return false;
  }
  current.count+=1;
  return current.count>24;
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

function safeLearning(value:unknown):CreativeLearningBook|null {
  if(!value || typeof value!=="object" || Array.isArray(value)) return null;
  const input=value as Partial<CreativeLearningBook>;
  if(input.version!=="designer-creative-learning-v1" || !Array.isArray(input.buckets)) return null;
  return {
    version:"designer-creative-learning-v1",
    totalReviews:Number(input.totalReviews)||0,
    renderMismatchReviews:Number(input.renderMismatchReviews)||0,
    usableFamilies:Number(input.usableFamilies)||0,
    buckets:input.buckets.slice(0,240),
  };
}

function safeResearch(value:unknown):CreativeResearchLibrary|null {
  if(!value || typeof value!=="object" || Array.isArray(value)) return null;
  const input=value as Partial<CreativeResearchLibrary>;
  if(input.version!=="designer-creative-research-v1" || !Array.isArray(input.signals)) return null;
  const signals=input.signals
    .filter((signal)=>signal && typeof signal==="object" && signal.active && typeof signal.id==="string" && typeof signal.sourceUrl==="string")
    .slice(0,240);
  return {
    version:"designer-creative-research-v1",
    total:signals.length,
    active:signals.length,
    signals,
  };
}

function validReason(value:unknown):value is CreativeFeedbackReason {
  return ["visual_balance","too_busy","too_safe","pattern_detail","proportion","originality","render_mismatch","other"].includes(String(value));
}

function validCurrent(value:unknown):value is CreativeDirection {
  if(!value || typeof value!=="object" || Array.isArray(value)) return false;
  const item=value as Partial<CreativeDirection>;
  return Boolean(
    item.id && typeof item.id==="string" && item.id.length<=220 &&
    item.name && typeof item.name==="string" && item.name.length<=180 &&
    Array.isArray(item.treatments) && item.treatments.length<=10 &&
    Array.isArray(item.critics) && item.critics.length<=8
  );
}

export async function POST(request:Request) {
  if(rateLimited(request)) return NextResponse.json({error:"Creative generation is temporarily rate limited."},{status:429});
  const contentLength=Number(request.headers.get("content-length")||0);
  if(contentLength>650_000) return NextResponse.json({error:"Creative generation request is too large."},{status:413});
  try {
    const body=await request.json() as {
      mode?:unknown;
      shirtId?:unknown;
      pantId?:unknown;
      occasion?:unknown;
      style?:unknown;
      context?:unknown;
      limit?:unknown;
      creativeLearning?:unknown;
      creativeResearch?:unknown;
      current?:unknown;
      reason?:unknown;
    };
    const shirtId=String(body.shirtId||"").slice(0,160);
    const pantId=String(body.pantId||"").slice(0,160);
    const occasion=String(body.occasion||"") as OccasionTier;
    if(!shirtId || !pantId || !OCCASIONS.includes(occasion) || !validStyle(body.style) || !validContext(body.context)) {
      return NextResponse.json({error:"A valid fabric pair, occasion and supported style are required."},{status:400});
    }

    const metadata=await loadDesignerFabricMetadata();
    const stock=applyDesignerFabricMetadataToStock(metadata).filter((fabric)=>fabric.inStock);
    const fabrics=stock.map(designerFabricFromStock);
    const shirt=fabrics.find((fabric)=>fabric.id===shirtId && fabric.allowedGarments.includes("shirt"));
    const pant=fabrics.find((fabric)=>fabric.id===pantId && fabric.allowedGarments.includes("pant"));
    if(!shirt || !pant) return NextResponse.json({error:"The selected fabrics are no longer available in the current Designer catalogue."},{status:409});

    const limit=Math.max(1,Math.min(12,Math.round(Number(body.limit)||5)));
    const creativeLearning=safeLearning(body.creativeLearning);
    const creativeResearch=safeResearch(body.creativeResearch);
    const input={
      shirt,pant,occasion,style:body.style,context:body.context,
      creativeLearning,creativeResearch,researchFreedom:"maximum" as const,
      limit:body.mode==="redesign"?Math.max(12,limit):limit,
    };
    const concepts=generateCreativeDirections(input);

    if(body.mode==="redesign") {
      if(!validCurrent(body.current) || !validReason(body.reason)) {
        return NextResponse.json({error:"A current concept and redesign reason are required."},{status:400});
      }
      const redesign=chooseCreativeRedesign(concepts,body.current,body.reason);
      return NextResponse.json({concepts:concepts.slice(0,limit),redesign:redesign || null},{headers:{"cache-control":"no-store"}});
    }

    return NextResponse.json({concepts:concepts.slice(0,limit)},{headers:{"cache-control":"no-store"}});
  } catch(error) {
    console.error("[designer/creative-generate]",error);
    return NextResponse.json({error:"Creative Designer could not generate directions."},{status:500});
  }
}
