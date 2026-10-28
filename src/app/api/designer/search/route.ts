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
import { enrichDesignerFabricsWithIntelligence } from "@/lib/fabric-intelligence-server";
import { loadApprovedHouseEaseModel } from "@/lib/designer/house-ease-server";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";
import type { MeasurementProfile } from "@/lib/measurements";
import { normalizeMeasuredBodyInput } from "@/lib/designer/measurement-input-validation";
import {validateStyleSpecV2,type StyleSpecV2} from "@/lib/designer/style-spec-v2";
import { validStoredTailorObservationProfile, type TailorObservationProfile } from "@/lib/designer/tailor-observations";

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
  return normalizeMeasuredBodyInput(value);
}

function safeObservations(value:unknown):TailorObservationProfile|null {
  return validStoredTailorObservationProfile(value);
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
      styleSpec?:unknown;
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

    const advanced=body.styleSpec!==null&&body.styleSpec!==undefined
      ?validateStyleSpecV2(body.styleSpec)?body.styleSpec as StyleSpecV2:null
      :null;
    if(body.styleSpec!=null&&!advanced)
      return NextResponse.json({error:"Invalid advanced tailoring choices; select supported construction options."},{status:422});
    let measurements:MeasurementProfile|null;
    try { measurements=safeMeasurements(body.measurements); }
    catch(error) {
      return NextResponse.json({error:error instanceof Error?error.message:"Invalid body measurements."},{status:422});
    }
    const observations=safeObservations(body.observations);
    if(body.observations!==undefined && body.observations!==null && !observations) {
      return NextResponse.json({error:"Invalid tailor observations; review the current fit notes."},{status:422});
    }
    const [metadata,evidence,easeModel]=await Promise.all([
      loadDesignerFabricMetadata(),
      loadDesignerEvidenceContext(),
      loadApprovedHouseEaseModel(),
    ]);
    const liveStock=await applyLiveVerifiedStockAvailability(applyDesignerFabricMetadataToStock(metadata));
    const stock=liveStock.stock.filter((fabric)=>fabric.inStock);
    const baseFabrics=stock.map(designerFabricFromStock);
    const {fabrics,intelligence:fabricIntelligence}=await enrichDesignerFabricsWithIntelligence(baseFabrics);
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
      styleSpec:advanced,
      context:body.context,
      measurements,
      observations,
      scope,
      casebook:evidence.casebook,
      fitOutcomes:evidence.fitOutcomes,
      fabricIntelligence,
      easeModel,
    });

    const presentation=results.slice(0,3).map((result)=>({
      id:result.id,
      tier:result.tier,
      shirt:result.shirt,
      pant:result.pant,
      style:result.style,
      ...(result.styleSpec?{styleSpec:result.styleSpec}:{}),
      recommendation:result.recommendation,
    }));
    return NextResponse.json({results:presentation},{headers:{"cache-control":"no-store"}});
  } catch(error) {
    console.error("[designer/search]",error);
    return NextResponse.json({error:"Designer could not prepare alternative directions."},{status:500});
  }
}
