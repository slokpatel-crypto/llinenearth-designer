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
import { searchDesignerCatalogue, type DesignerSearchScope } from "@/lib/designer/search";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { loadDesignerEvidenceContext } from "@/lib/designer/evidence-context";
import { loadDesignerFabricIntelligence } from "@/lib/fabric-intelligence-server";
import type { MeasurementProfile } from "@/lib/measurements";
import type { TailorObservationProfile } from "@/lib/designer/tailor-observations";

export const runtime="nodejs";
export const maxDuration=20;

const OCCASIONS:OccasionTier[]=["Casual","Smart-Casual","Semi-Formal","Formal"];
const CLIMATES:DesignerClimate[]=["Not specified","Hot / humid","Cool","Air-conditioned"];
const INTENTIONS:DesignerIntention[]=["Understated","Balanced","Expressive"];
const SCOPES:DesignerSearchScope[]=["keep_shirt","keep_trouser","open"];

const registry=(globalThis as typeof globalThis & {__linenDesignerSearchRate?:Map<string,{at:number;count:number}>}).__linenDesignerSearchRate ||= new Map<string,{at:number;count:number}>();

function rateLimited(request:Request) {
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now=Date.now();
  const current=registry.get(ip);
  if(!current || now-current.at>60_000) {
    registry.set(ip,{at:now,count:1});
    return false;
  }
  current.count+=1;
  return current.count>30;
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

export async function POST(request:Request) {
  if(rateLimited(request)) return NextResponse.json({error:"Designer search is temporarily rate limited."},{status:429});
  const contentLength=Number(request.headers.get("content-length")||0);
  if(contentLength>80_000) return NextResponse.json({error:"Designer search request is too large."},{status:413});

  try {
    const body=await request.json() as {
      shirtId?:unknown;
      pantId?:unknown;
      occasion?:unknown;
      style?:unknown;
      context?:unknown;
      scope?:unknown;
      measurements?:unknown;
      observations?:unknown;
    };
    const shirtId=String(body.shirtId||"").slice(0,160);
    const pantId=String(body.pantId||"").slice(0,160);
    const occasion=String(body.occasion||"") as OccasionTier;
    const scope=String(body.scope||"keep_shirt") as DesignerSearchScope;
    if(!shirtId || !pantId || !OCCASIONS.includes(occasion) || !SCOPES.includes(scope) || !validStyle(body.style) || !validContext(body.context)) {
      return NextResponse.json({error:"A valid fabric pair, occasion and supported style are required."},{status:400});
    }

    const [metadata,evidence]=await Promise.all([
      loadDesignerFabricMetadata(),
      loadDesignerEvidenceContext(),
    ]);
    const stock=applyDesignerFabricMetadataToStock(metadata).filter((fabric)=>fabric.inStock);
    const fabrics=stock.map(designerFabricFromStock);
    const fabricIntelligence=await loadDesignerFabricIntelligence(fabrics.map((fabric)=>fabric.id));
    const shirts=fabrics.filter((fabric)=>fabric.allowedGarments.includes("shirt"));
    const pants=fabrics.filter((fabric)=>fabric.allowedGarments.includes("pant"));
    const currentShirt=shirts.find((fabric)=>fabric.id===shirtId);
    const currentPant=pants.find((fabric)=>fabric.id===pantId);
    if(!currentShirt || !currentPant) return NextResponse.json({error:"The selected fabrics are no longer available in the current Designer catalogue."},{status:409});

    const results=searchDesignerCatalogue({
      shirts,
      pants,
      currentShirt,
      currentPant,
      occasion,
      chosenStyle:body.style,
      context:body.context,
      measurements:safeMeasurements(body.measurements),
      observations:safeObservations(body.observations),
      scope,
      casebook:evidence.casebook,
      fitOutcomes:evidence.fitOutcomes,
      fabricIntelligence,
    });

    const presentation=results.slice(0,3).map((result)=>({
      id:result.id,
      tier:result.tier,
      shirt:result.shirt,
      pant:result.pant,
      style:result.style,
      recommendation:result.recommendation,
    }));
    return NextResponse.json({results:presentation},{headers:{"cache-control":"no-store"}});
  } catch(error) {
    console.error("[designer/search]",error);
    return NextResponse.json({error:"Designer could not prepare alternative directions."},{status:500});
  }
}
