import { NextResponse } from "next/server";
import { DESIGNER_REVIEWED_PAIRING, DESIGNER_STYLE_CHOICES, designerFabricFromStock } from "@/lib/designer/engine";
import { parseDesignerBrief } from "@/lib/designer/brief";
import { searchDesignerCatalogue, type DesignerSearchTier } from "@/lib/designer/search";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { loadDesignerEvidenceContext } from "@/lib/designer/evidence-context";
import { loadDesignerFabricIntelligence } from "@/lib/fabric-intelligence-server";
import type { MeasurementProfile } from "@/lib/measurements";
import type { TailorObservationProfile } from "@/lib/designer/tailor-observations";

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

type SafeTasteProfile = {
  evidence:number;
  preferredTier?:DesignerSearchTier;
  preferredShirtWear?:"Tucked"|"Untucked";
  preferredTrouser?:string;
};

function safeTasteProfile(value:unknown):SafeTasteProfile|null {
  if(!value || typeof value!=="object" || Array.isArray(value)) return null;
  const input=value as Record<string,unknown>;
  if(Number(input.version)!==1) return null;
  const evidence=Math.max(0,Math.min(100,Math.floor(Number(input.evidence)||0)));
  if(evidence<4) return {evidence};
  const tier=String(input.preferredTier||"");
  const wear=String(input.preferredShirtWear||"");
  const trouser=String(input.preferredTrouser||"").slice(0,100);
  return {
    evidence,
    ...(tier==="Safe"||tier==="Elevated"||tier==="Statement" ? {preferredTier:tier} : {}),
    ...(wear==="Tucked"||wear==="Untucked" ? {preferredShirtWear:wear} : {}),
    ...(DESIGNER_STYLE_CHOICES.trouser.includes(trouser) ? {preferredTrouser:trouser} : {}),
  };
}

function personalizeBrief(parsed:ReturnType<typeof parseDesignerBrief>,taste:SafeTasteProfile|null) {
  if(!taste || taste.evidence<4) return parsed;
  const style={...parsed.style};
  const preference={...parsed.preference};
  const interpretation=[...parsed.interpretation];
  const text=parsed.original.toLowerCase();
  const explicitEnergy=/\b(quiet|understated|minimal|subtle|bold|statement|expressive|stand out|standout|not boring|creative|distinctive)\b/.test(text);
  const explicitWear=/\b(tucked|untucked)\b/.test(text);
  const explicitTrouser=/\b(pleat|pleated|flat[- ]?front|wide[- ]?leg|relaxed trouser|cropped|ankle[- ]?length)\b/.test(text);
  const learned:string[]=[];

  if(taste.preferredTier && !explicitEnergy) {
    preference.preferredTier=taste.preferredTier;
    learned.push(`${taste.preferredTier.toLowerCase()} energy`);
  }
  if(taste.preferredShirtWear && !explicitWear) {
    style.shirtWear=taste.preferredShirtWear;
    learned.push(`${taste.preferredShirtWear.toLowerCase()} shirt`);
  }
  if(taste.preferredTrouser && !explicitTrouser) {
    style.trouser=taste.preferredTrouser;
    learned.push(taste.preferredTrouser.toLowerCase());
  }
  if(learned.length) interpretation.push(`learned preference: ${learned.join(", ")}`);
  return {...parsed,style,preference,interpretation};
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
  const contentLength=Number(request.headers.get("content-length")||0);
  if(contentLength>90_000) return NextResponse.json({error:"Designer brief request is too large."},{status:413});

  try {
    const body=await request.json() as {
      brief?:unknown;
      currentShirtId?:unknown;
      currentPantId?:unknown;
      measurements?:unknown;
      observations?:unknown;
      tasteProfile?:unknown;
    };
    const brief=String(body.brief||"").replace(/\s+/g," ").trim().slice(0,500);
    if(brief.length<5) return NextResponse.json({error:"Tell Designer where you are going and how you want the outfit to feel."},{status:400});

    const parsed=personalizeBrief(parseDesignerBrief(brief),safeTasteProfile(body.tasteProfile));
    const [metadata,evidence]=await Promise.all([
      loadDesignerFabricMetadata(),
      loadDesignerEvidenceContext(),
    ]);
    const stock=applyDesignerFabricMetadataToStock(metadata).filter((fabric)=>fabric.inStock);
    const fabrics=stock.map(designerFabricFromStock);
    const fabricIntelligence=await loadDesignerFabricIntelligence(fabrics.map((fabric)=>fabric.id));
    const shirts=fabrics.filter((fabric)=>fabric.allowedGarments.includes("shirt"));
    const pants=fabrics.filter((fabric)=>fabric.allowedGarments.includes("pant"));
    if(!shirts.length || !pants.length) return NextResponse.json({error:"The current Linen Earth stock does not contain enough shirt and trouser fabrics."},{status:409});

    const requestedShirt=String(body.currentShirtId||"").slice(0,160);
    const requestedPant=String(body.currentPantId||"").slice(0,160);
    const currentShirt=shirts.find((fabric)=>fabric.id===requestedShirt)
      || shirts.find((fabric)=>fabric.id===DESIGNER_REVIEWED_PAIRING.shirtId)
      || shirts[0];
    const currentPant=pants.find((fabric)=>fabric.id===requestedPant)
      || pants.find((fabric)=>fabric.id===DESIGNER_REVIEWED_PAIRING.pantId)
      || pants[0];

    const results=searchDesignerCatalogue({
      shirts,
      pants,
      currentShirt,
      currentPant,
      occasion:parsed.occasion,
      chosenStyle:parsed.style,
      context:parsed.context,
      measurements:safeMeasurements(body.measurements),
      observations:safeObservations(body.observations),
      scope:"open",
      casebook:evidence.casebook,
      fitOutcomes:evidence.fitOutcomes,
      preference:parsed.preference,
      fabricIntelligence,
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
    console.error("[designer/brief]",error);
    return NextResponse.json({error:"Designer could not turn that brief into outfit directions."},{status:500});
  }
}
