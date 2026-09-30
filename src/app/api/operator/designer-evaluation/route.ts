import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { designerFabricFromStock, designerStyleForOccasion } from "@/lib/designer/engine";
import { searchDesignerCatalogue } from "@/lib/designer/search";
import { loadDesignerEvidenceContext } from "@/lib/designer/evidence-context";
import { enrichDesignerFabricsWithIntelligence } from "@/lib/fabric-intelligence-server";
import { buildDesignerBenchmarkCases, DESIGNER_BENCHMARK_VERSION } from "@/lib/designer/benchmark";
import { loadDesignerBenchmarkLabels } from "@/lib/designer/benchmark-labels";
import { nextUnlabelledBenchmarkIndex } from "@/lib/designer/benchmark-progress";

export const runtime="nodejs";
export const maxDuration=30;

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
      loadDesignerBenchmarkLabels(),
    ]);
    const stock=applyDesignerFabricMetadataToStock(metadata).filter((fabric)=>fabric.inStock);
    const baseFabrics=stock.map(designerFabricFromStock);
    const {fabrics,intelligence}=await enrichDesignerFabricsWithIntelligence(baseFabrics);
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
    const nextUnlabelledIndex=nextUnlabelledBenchmarkIndex(
      cases.map((item)=>item.id),
      labelState.labels.keys(),
      index,
    );
    return NextResponse.json({
      configured:labelState.configured,
      version:DESIGNER_BENCHMARK_VERSION,
      totalCases:cases.length,
      labeledCases:labels.length,
      nextUnlabelledIndex,
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
