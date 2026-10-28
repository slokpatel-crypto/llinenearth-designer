import { NextResponse } from "next/server";
import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { DESIGNER_REVIEWED_PAIRING, designerFabricFromStock, designerStyleForOccasion } from "@/lib/designer/engine";
import { parseDesignerBrief, explicitDesignerStylePatch } from "@/lib/designer/brief";
import { answerDesignerQuestion, designerTaskFor, safeDesignerJudgement, validDesignerContext, validDesignerOccasion, validDesignerStyle } from "@/lib/designer/advisor";
import { searchDesignerCatalogue, type DesignerSearchTier } from "@/lib/designer/search";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { loadDesignerEvidenceContext } from "@/lib/designer/evidence-context";
import { enrichDesignerFabricsWithIntelligence } from "@/lib/fabric-intelligence-server";
import { loadApprovedHouseEaseModel } from "@/lib/designer/house-ease-server";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";
import type { MeasurementProfile } from "@/lib/measurements";
import { normalizeMeasuredBodyInput } from "@/lib/designer/measurement-input-validation";
import { validStoredTailorObservationProfile, type TailorObservationProfile } from "@/lib/designer/tailor-observations";
import { safePersonalTaste, personalizeDesignerBrief } from "@/lib/designer/personal-taste";
import { compileDesignerIntent, designGoalPatch, scopeStyleLocks } from "@/lib/designer/design-intent";

export const runtime="nodejs";
export const maxDuration=20;

const registry=(globalThis as typeof globalThis & {__linenDesignerBriefRate?:Map<string,{at:number;count:number}>}).__linenDesignerBriefRate ||= new Map<string,{at:number;count:number}>();

function rateLimited(request:Request) {
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now=Date.now();
  const current=registry.get(ip);
  if(!current || now-current.at>60_000) {
    registry.set(ip,{at:now,count:1});
    return false;
  }
  current.count+=1;
  return current.count>20;
}

function safeMeasurements(value:unknown):MeasurementProfile|null {
  return normalizeMeasuredBodyInput(value);
}

function safeObservations(value:unknown):TailorObservationProfile|null {
  return validStoredTailorObservationProfile(value);
}

function tierOrder(preferred:DesignerSearchTier|undefined) {
  if(preferred==="Safe") return ["Safe","Elevated","Statement"] as DesignerSearchTier[];
  if(preferred==="Statement") return ["Statement","Elevated","Safe"] as DesignerSearchTier[];
  return ["Elevated","Safe","Statement"] as DesignerSearchTier[];
}

function directionName(tier:DesignerSearchTier) {
  if(tier==="Safe") return "Quiet confidence";
  if(tier==="Statement") return "Distinctive move";
  return "Refined edge";
}

export async function POST(request:Request) {
  if(rateLimited(request)) return NextResponse.json({error:"Designer brief is temporarily rate limited."},{status:429});
  const unsafe=secureJsonRequestError(request,90_000);
  if(unsafe) return NextResponse.json({error:unsafe.error},{status:unsafe.status});

  try {
    const body=await readSecureJsonObject(request,90_000) as {
      brief?:unknown;
      currentShirtId?:unknown;
      currentPantId?:unknown;
      measurements?:unknown;
      observations?:unknown;
      tasteProfile?:unknown;
      currentStyle?:unknown;
      occasion?:unknown;
      context?:unknown;
      judgement?:unknown;
    };
    const brief=(typeof body.brief==="string"?body.brief:"").replace(/\s+/g," ").trim().slice(0,500);
    if(brief.length<5) return NextResponse.json({error:"Tell Designer where you are going and how you want the outfit to feel."},{status:400});
    // Supplying a malformed or overlength selection must not quietly fall back
    // to another stock roll, especially in advisor/fit handoff paths.
    if(
      (body.currentShirtId!=null&&(typeof body.currentShirtId!=="string"||body.currentShirtId.length>160)) ||
      (body.currentPantId!=null&&(typeof body.currentPantId!=="string"||body.currentPantId.length>160))
    ) return NextResponse.json({error:"Invalid selected fabric identifier; reselect current stock."},{status:400});

    const advisorRequest=body.currentStyle!==undefined;
    if(advisorRequest && (!validDesignerStyle(body.currentStyle) || !validDesignerOccasion(body.occasion) || !validDesignerContext(body.context))) return NextResponse.json({error:"The selected construction or occasion is invalid. Reload the direction before asking Designer."},{status:400});
    const judgement=safeDesignerJudgement(body.judgement);
    if(body.judgement!==undefined && !judgement) return NextResponse.json({error:"Choose a judgement reason or give a specific improvement instruction."},{status:400});
    const base=advisorRequest ? {style:body.currentStyle as Parameters<typeof answerDesignerQuestion>[0]["chosenStyle"],occasion:body.occasion as Parameters<typeof answerDesignerQuestion>[0]["occasion"],context:body.context as Parameters<typeof answerDesignerQuestion>[0]["context"]} : undefined;
    const taskText=brief+(judgement?.note?" "+judgement.note:"");
    const read=parseDesignerBrief(judgement ? judgement.note || "Revise this direction" : taskText,base);
    if(base && ["design","capsule"].includes(designerTaskFor(taskText,judgement)) && !/\b(?:keep|preserve|same|unchanged)\b/i.test(taskText)) read.style={...designerStyleForOccasion(read.occasion),...explicitDesignerStylePatch(taskText)};
    const parsed=!base || ["design","capsule"].includes(designerTaskFor(taskText,judgement)) ? personalizeDesignerBrief(read,safePersonalTaste(body.tasteProfile)) : read;
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
    if(!shirts.length || !pants.length) return NextResponse.json({error:"The current Linen Earth stock does not contain enough shirt and trouser fabrics."},{status:409});

    const requestedShirt=typeof body.currentShirtId==="string"?body.currentShirtId:"";
    const requestedPant=typeof body.currentPantId==="string"?body.currentPantId:"";
    const currentShirt=shirts.find((fabric)=>fabric.id===requestedShirt)
      || shirts.find((fabric)=>fabric.id===DESIGNER_REVIEWED_PAIRING.shirtId)
      || shirts[0];
    const currentPant=pants.find((fabric)=>fabric.id===requestedPant)
      || pants.find((fabric)=>fabric.id===DESIGNER_REVIEWED_PAIRING.pantId)
      || pants[0];

    if(base) {
      if(currentShirt.id!==requestedShirt || currentPant.id!==requestedPant) return NextResponse.json({error:"A selected fabric is no longer available for this garment. Choose current stock before continuing."},{status:409});
      const answer=answerDesignerQuestion({shirts,pants,currentShirt,currentPant,occasion:base.occasion,context:base.context,chosenStyle:base.style,
        measurements,observations,casebook:evidence.casebook,fitOutcomes:evidence.fitOutcomes,fabricIntelligence,easeModel,brief,judgement,parsed});
      return NextResponse.json({...answer,requestId:"LE-ADVICE-"+crypto.randomUUID(),engine:"linen-designer-advisor-v1"},{headers:{"cache-control":"no-store"}});
    }

    const intent=compileDesignerIntent(brief);
    const results=searchDesignerCatalogue({
      shirts,
      pants,
      currentShirt,
      currentPant,
      occasion:parsed.occasion,
      chosenStyle:parsed.style,
      context:parsed.context,
      measurements,
      observations,
      scope:"open",
      casebook:evidence.casebook,
      fitOutcomes:evidence.fitOutcomes,
      preference:parsed.preference,
      stylePatch:{...parsed.personalStylePatch,...designGoalPatch(intent,parsed.occasion),...explicitDesignerStylePatch(brief),...scopeStyleLocks(intent.scope,parsed.style)},
      fabricIntelligence,
      easeModel,
    });

    const order=tierOrder(parsed.preference.preferredTier);
    const ordered=[...results].sort((a,b)=>order.indexOf(a.tier)-order.indexOf(b.tier));
    const presentation=ordered.slice(0,3).map((result,index)=>({
      id:result.id,
      rank:index+1,
      title:directionName(result.tier),
      tier:result.tier,
      shirt:result.shirt,
      pant:result.pant,
      style:result.style,
      recommendation:result.recommendation,
      reasons:result.reasons.slice(0,3),
      tradeoffs:result.tradeoffs.slice(0,2),
      fitAdaptation:result.fitAdaptation || "",
    }));

    return NextResponse.json({
      interpretation:{
        brief:parsed.original,
        occasion:parsed.occasion,
        context:parsed.context,
        notes:[
          ...parsed.interpretation,
          ...(presentation.some((item)=>item.fitAdaptation) ? ["saved measurements adjusted the recommended cut"] : []),
        ],
      },
      results:presentation,
      engine:"linen-designer-brief-v2",
    },{headers:{"cache-control":"no-store"}});
  } catch(error) {
    if(error instanceof SecureJsonBodyTooLarge) return NextResponse.json({error:error.message},{status:413});
    if(error instanceof SecureJsonBodyInvalid) return NextResponse.json({error:error.message},{status:400});
    console.error("[designer/brief]",error);
    return NextResponse.json({error:"Designer could not turn that brief into outfit directions."},{status:500});
  }
}
