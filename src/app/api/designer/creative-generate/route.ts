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
import type { CreativeFeedbackReason } from "@/lib/designer/creative-learning";
import { loadDesignerCreativeContext } from "@/lib/designer/creative-context";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { enrichDesignerFabricsWithIntelligence } from "@/lib/fabric-intelligence-server";

import { attachCreativeCraft, craftClarifications, DEFAULT_CRAFT_REQUEST, resolveCraftRequest, reviseCreativeCraft, validCraftRequest, validCreativeCraft, resolveCraftFabrics } from "@/lib/designer/creative-spec";
import { getCustomerIdentity } from "@/lib/customer-auth";
import { readCreativePersonalContext } from "@/lib/designer/creative-profile-server";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";

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

function validReason(value:unknown):value is CreativeFeedbackReason {
  return ["visual_balance","too_busy","too_safe","pattern_detail","proportion","originality","render_mismatch","other"].includes(String(value));
}

function validCurrent(value:unknown):value is CreativeDirection {
  if(!value || typeof value!=="object" || Array.isArray(value)) return false;
  const item=value as Partial<CreativeDirection>;
  return Boolean(
    item.id && typeof item.id==="string" && item.id.length<=220 &&
    item.name && typeof item.name==="string" && item.name.length<=180 &&
    typeof item.thesis==="string"&&item.thesis.length<=900 && validStyle(item.baseStyle) &&
    Array.isArray(item.refinement)&&item.refinement.length<=100&&item.refinement.every(v=>typeof v==="string"&&v.length<=1000) &&
    Number.isInteger(item.iteration)&&Number(item.iteration)>=0&&Number(item.iteration)<60 &&
    Array.isArray(item.treatments) && item.treatments.length<=10 && item.treatments.every(t=>t&&typeof t.id==="string"&&typeof t.instruction==="string"&&t.instruction.length<=1000) &&
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
      craft?:unknown;
      shirtId?:unknown;
      pantId?:unknown;
      occasion?:unknown;
      style?:unknown;
      context?:unknown;
      limit?:unknown;
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
    const stock=(await applyLiveVerifiedStockAvailability(applyDesignerFabricMetadataToStock(metadata))).stock.filter((fabric)=>fabric.inStock);
    const baseFabrics=stock.map(designerFabricFromStock);
    const {fabrics}=await enrichDesignerFabricsWithIntelligence(baseFabrics);
    const shirt=fabrics.find((fabric)=>fabric.id===shirtId && fabric.allowedGarments.includes("shirt"));
    const pant=fabrics.find((fabric)=>fabric.id===pantId && fabric.allowedGarments.includes("pant"));
    if(!shirt || !pant) return NextResponse.json({error:"The selected fabrics are no longer available in the current Designer catalogue."},{status:409});

    if(body.craft!==undefined&&!validCraftRequest(body.craft))return NextResponse.json({error:"Supported craft controls are required."},{status:400});
    const requested=body.craft===undefined?{...DEFAULT_CRAFT_REQUEST}:body.craft as import("@/lib/designer/creative-spec").CreativeCraftRequest;
    const clarifications=craftClarifications(requested);
    if(clarifications.length)return NextResponse.json({concepts:[],clarifications},{headers:{"cache-control":"no-store"}});
    const identity=await getCustomerIdentity(request);
    let personal:Awaited<ReturnType<typeof readCreativePersonalContext>>|null=null;
    let memoryAvailable=true;
    if(identity)try{personal=await readCreativePersonalContext(identity.id);}catch{memoryAvailable=false;}
    const craftRequest=resolveCraftRequest(requested,personal?.effective);
    const accent=craftRequest.accentId&&craftRequest.accentId!=="auto"?fabrics.find(f=>f.id===craftRequest.accentId):undefined;
    const garment=["waistband","pleat","trouser-leg"].includes(craftRequest.zone)?"pant":"shirt";
    if(craftRequest.accentId&&craftRequest.accentId!=="auto"&&(!accent||!accent.allowedGarments.includes(garment as "shirt"|"pant")))return NextResponse.json({error:"Choose an available accent fabric suitable for the selected garment."},{status:409});
    const limit=Math.max(1,Math.min(12,Math.round(Number(body.limit)||5)));
    const creativeContext=await loadDesignerCreativeContext();
    const input={
      shirt,pant,occasion,style:body.style,context:body.context,
      creativeLearning:personal?.learning,
      creativeResearch:creativeContext.research,
      researchFreedom:"maximum" as const,
      limit:body.mode==="redesign"?Math.max(12,limit):limit,
    };
    const autoAccents=fabrics.filter(f=>f.allowedGarments.includes(garment as "shirt"|"pant")&&f.id!==(garment==="shirt"?shirtId:pantId)).sort((a,b)=>Number(b.patternType.toLowerCase()==="solid")-Number(a.patternType.toLowerCase()==="solid")||a.id.localeCompare(b.id)).slice(0,6);
    const concepts=attachCreativeCraft(generateCreativeDirections(input),craftRequest,accent,autoAccents);
    const memory={authenticated:Boolean(identity),enabled:personal?.preferences.enabled||false,reviewCount:personal?.reviewCount||0,available:memoryAvailable};

    if(body.mode==="redesign") {
      if(!validCurrent(body.current) || !validReason(body.reason)) {
        return NextResponse.json({error:"A current concept and redesign reason are required."},{status:400});
      }
      if(body.current.craft!==undefined&&!validCreativeCraft(body.current.craft))return NextResponse.json({error:"Invalid craft recipe."},{status:400});
      if(body.current.craft){const canonical=resolveCraftFabrics(body.current.craft,fabrics,shirtId,pantId);if(!canonical)return NextResponse.json({error:"Current craft recipe does not match available fabrics."},{status:409});body.current.craft=canonical;}
      const redesign=body.current.craft?reviseCreativeCraft(body.current,body.reason):chooseCreativeRedesign(concepts,body.current,body.reason);
      return NextResponse.json({concepts:concepts.slice(0,limit),redesign:redesign || null,memory},{headers:{"cache-control":"no-store"}});
    }

    return NextResponse.json({concepts:concepts.slice(0,limit),memory},{headers:{"cache-control":"no-store"}});
  } catch(error) {
    console.error("[designer/creative-generate]",error);
    return NextResponse.json({error:"Creative Designer could not generate directions."},{status:500});
  }
}
