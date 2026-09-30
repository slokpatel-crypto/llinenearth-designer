import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { designerFabricFromStock, designerStyleForOccasion } from "@/lib/designer/engine";
import { searchDesignerCatalogue } from "@/lib/designer/search";
import { loadDesignerEvidenceContext } from "@/lib/designer/evidence-context";
import { loadDesignerFabricIntelligence } from "@/lib/fabric-intelligence-server";
import { buildDesignerBenchmarkCases, DESIGNER_BENCHMARK_VERSION } from "@/lib/designer/benchmark";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime="nodejs";
export const maxDuration=30;

type LabelRow={at:string;payload?:Record<string,unknown>};
type BenchmarkLabel={
  caseId:string;
  choice:"0"|"1"|"2"|"none";
  reason:string;
  at:string;
};

async function loadLabels() {
  const cloud=getSupabaseAdminConfig();
  if(!cloud) return {configured:false,labels:new Map<string,BenchmarkLabel>()};

  try {
    const params=new URLSearchParams({
      select:"at,payload",
      type:"eq.operator_note",
      source:"eq.operator",
      order:"at.desc",
      limit:"1200",
    });
    const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
      cache:"no-store",
    });
    if(!response.ok) return {configured:true,labels:new Map<string,BenchmarkLabel>()};
    const rows=await response.json() as LabelRow[];
    const labels=new Map<string,BenchmarkLabel>();
    for(const row of rows) {
      const payload=row.payload||{};
      if(String(payload.subtype||"")!=="designer_benchmark_label") continue;
      if(String(payload.version||"")!==DESIGNER_BENCHMARK_VERSION) continue;
      const caseId=String(payload.caseId||"").slice(0,80);
      const choice=String(payload.choice||"") as BenchmarkLabel["choice"];
      if(!caseId || !["0","1","2","none"].includes(choice) || labels.has(caseId)) continue;
      labels.set(caseId,{
        caseId,
        choice,
        reason:String(payload.reason||"other").slice(0,80),
        at:row.at,
      });
    }
    return {configured:true,labels};
  } catch {
    return {configured:true,labels:new Map<string,BenchmarkLabel>()};
  }
}

export async function GET(request:Request) {
  const jar=await cookies();
  const valid=await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if(!valid) return NextResponse.json({error:"Unauthorized."},{status:401});

  try {
    const url=new URL(request.url);
    const requested=Math.max(0,Math.min(47,Math.floor(Number(url.searchParams.get("case")||0))||0));
    const [metadata,evidence,labelState]=await Promise.all([
      loadDesignerFabricMetadata(),
      loadDesignerEvidenceContext(),
      loadLabels(),
    ]);
    const stock=applyDesignerFabricMetadataToStock(metadata).filter((fabric)=>fabric.inStock);
    const fabrics=stock.map(designerFabricFromStock);
    const shirts=fabrics.filter((fabric)=>fabric.allowedGarments.includes("shirt"));
    const pants=fabrics.filter((fabric)=>fabric.allowedGarments.includes("pant"));
    const cases=buildDesignerBenchmarkCases(shirts,pants);
    if(!cases.length) {
      return NextResponse.json({error:"Designer benchmark needs at least one available shirt and trouser fabric."},{status:409});
    }
    const index=Math.min(requested,cases.length-1);
    const benchmark=cases[index];
    const currentShirt=shirts.find((fabric)=>fabric.id===benchmark.anchorShirtId) || shirts[0];
    const currentPant=pants.find((fabric)=>fabric.id===benchmark.anchorPantId) || pants[0];
    if(!currentShirt || !currentPant) {
      return NextResponse.json({error:"Designer benchmark stock is unavailable."},{status:409});
    }

    const intelligence=await loadDesignerFabricIntelligence(fabrics.map((fabric)=>fabric.id));
    const results=searchDesignerCatalogue({
      shirts,
      pants,
      currentShirt,
      currentPant,
      occasion:benchmark.occasion,
      chosenStyle:designerStyleForOccasion(benchmark.occasion),
      context:{climate:benchmark.climate,intention:benchmark.intention},
      scope:"open",
      casebook:evidence.casebook,
      fitOutcomes:evidence.fitOutcomes,
      fabricIntelligence:intelligence,
    }).slice(0,3);

    const candidates=results.map((result)=>({
      id:result.id,
      tier:result.tier,
      shirt:{
        id:result.shirt.id,
        name:result.shirt.name,
        line:result.shirt.line,
        image:result.shirt.image,
        patternType:result.shirt.patternType,
      },
      pant:{
        id:result.pant.id,
        name:result.pant.name,
        line:result.pant.line,
        image:result.pant.image,
        patternType:result.pant.patternType,
      },
      style:{
        collar:result.style.collar,
        cuff:result.style.cuff,
        shirtFit:result.style.shirtFit,
        shirtWear:result.style.shirtWear,
        trouser:result.style.trouser,
        rise:result.style.rise,
        waistband:result.style.waistband,
        break:result.style.break,
      },
      decision:{
        overall:Math.round(result.decision.overall*10)/10,
        certainty:Math.round(result.decision.certainty*10)/10,
        risk:result.decision.risk,
      },
      recommendation:{
        status:result.recommendation.status,
        confidenceScore:result.recommendation.confidenceScore,
        ruleSetVersion:result.recommendation.ruleSetVersion,
      },
      reasons:result.reasons.slice(0,3),
      tradeoffs:result.tradeoffs.slice(0,3),
    }));

    const labels=[...labelState.labels.values()];
    return NextResponse.json({
      configured:labelState.configured,
      version:DESIGNER_BENCHMARK_VERSION,
      totalCases:cases.length,
      labeledCases:labels.length,
      index,
      benchmark,
      currentLabel:labelState.labels.get(benchmark.id)||null,
      candidates,
    },{headers:{"cache-control":"no-store"}});
  } catch(error) {
    console.error("[operator/designer-evaluation]",error);
    return NextResponse.json({error:"Designer benchmark case could not be prepared."},{status:500});
  }
}
