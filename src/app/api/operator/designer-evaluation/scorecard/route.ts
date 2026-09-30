import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { designerFabricFromStock, designerStyleForOccasion } from "@/lib/designer/engine";
import { searchDesignerCatalogue } from "@/lib/designer/search";
import { loadDesignerEvidenceContext } from "@/lib/designer/evidence-context";
import { loadDesignerFabricIntelligence } from "@/lib/fabric-intelligence-server";
import { buildDesignerBenchmarkCases, DESIGNER_BENCHMARK_VERSION } from "@/lib/designer/benchmark";
import { loadDesignerBenchmarkLabels, type DesignerBenchmarkCandidateIdentity } from "@/lib/designer/benchmark-labels";

export const runtime="nodejs";
export const maxDuration=30;

const MIN_TOTAL_LABELS=40;
const MIN_ACTIONABLE_LABELS=32;

function sameCandidate(
  result:{tier:string;shirt:{id:string};pant:{id:string}},
  target:DesignerBenchmarkCandidateIdentity,
) {
  return result.tier===target.tier && result.shirt.id===target.shirtId && result.pant.id===target.pantId;
}

export async function GET() {
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)) {
    return NextResponse.json({error:"Unauthorized."},{status:401});
  }

  try{
    const labelState=await loadDesignerBenchmarkLabels();
    const labels=[...labelState.labels.values()];
    const actionable=labels.filter((label)=>Boolean(label.selected));
    const noneLabels=labels.length-actionable.length;
    const readyByVolume=labels.length>=MIN_TOTAL_LABELS && actionable.length>=MIN_ACTIONABLE_LABELS;

    if(!readyByVolume) {
      return NextResponse.json({
        configured:labelState.configured,
        version:DESIGNER_BENCHMARK_VERSION,
        reportable:false,
        minimumTotalLabels:MIN_TOTAL_LABELS,
        minimumActionableLabels:MIN_ACTIONABLE_LABELS,
        labeledCases:labels.length,
        actionableLabels:actionable.length,
        noneLabels,
        remainingTotal:Math.max(0,MIN_TOTAL_LABELS-labels.length),
        remainingActionable:Math.max(0,MIN_ACTIONABLE_LABELS-actionable.length),
      },{headers:{"cache-control":"private, no-store"}});
    }

    const [metadata,evidence]=await Promise.all([
      loadDesignerFabricMetadata(),
      loadDesignerEvidenceContext(),
    ]);
    const stock=applyDesignerFabricMetadataToStock(metadata).filter((fabric)=>fabric.inStock);
    const fabrics=stock.map(designerFabricFromStock);
    const shirts=fabrics.filter((fabric)=>fabric.allowedGarments.includes("shirt"));
    const pants=fabrics.filter((fabric)=>fabric.allowedGarments.includes("pant"));
    const cases=buildDesignerBenchmarkCases(shirts,pants);
    const casesById=new Map(cases.map((item)=>[item.id,item]));
    const intelligence=await loadDesignerFabricIntelligence(fabrics.map((fabric)=>fabric.id));

    let evaluated=0;
    let top1Matches=0;
    let top3Matches=0;
    let unavailableTargets=0;
    const byOccasion=new Map<string,{evaluated:number;top1:number;top3:number}>();
    const currentRuleVersions=new Set<string>();

    for(const label of actionable) {
      if(!label.selected) continue;
      const benchmark=casesById.get(label.caseId);
      if(!benchmark) { unavailableTargets+=1; continue; }
      const currentShirt=shirts.find((fabric)=>fabric.id===benchmark.anchorShirtId);
      const currentPant=pants.find((fabric)=>fabric.id===benchmark.anchorPantId);
      if(!currentShirt || !currentPant) { unavailableTargets+=1; continue; }

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

      const target=label.selected;
      const top1=Boolean(results[0] && sameCandidate(results[0],target));
      const top3=results.some((result)=>sameCandidate(result,target));
      evaluated+=1;
      if(top1) top1Matches+=1;
      if(top3) top3Matches+=1;
      for(const result of results) currentRuleVersions.add(result.recommendation.ruleSetVersion);

      const bucket=byOccasion.get(benchmark.occasion)||{evaluated:0,top1:0,top3:0};
      bucket.evaluated+=1;
      if(top1) bucket.top1+=1;
      if(top3) bucket.top3+=1;
      byOccasion.set(benchmark.occasion,bucket);
    }

    const pct=(value:number,total:number)=>total?Math.round(value/total*1000)/10:null;
    return NextResponse.json({
      configured:labelState.configured,
      version:DESIGNER_BENCHMARK_VERSION,
      reportable:evaluated>=MIN_ACTIONABLE_LABELS,
      minimumTotalLabels:MIN_TOTAL_LABELS,
      minimumActionableLabels:MIN_ACTIONABLE_LABELS,
      labeledCases:labels.length,
      actionableLabels:actionable.length,
      noneLabels,
      evaluated,
      unavailableTargets,
      top1:{matches:top1Matches,total:evaluated,percent:pct(top1Matches,evaluated)},
      top3:{matches:top3Matches,total:evaluated,percent:pct(top3Matches,evaluated)},
      currentRuleVersions:[...currentRuleVersions].sort(),
      labelRuleVersions:[...new Set(labels.map((label)=>label.engineRuleSetVersion).filter(Boolean))].sort(),
      byOccasion:[...byOccasion.entries()].map(([occasion,value])=>({
        occasion,
        evaluated:value.evaluated,
        top1Matches:value.top1,
        top1Percent:pct(value.top1,value.evaluated),
        top3Matches:value.top3,
        top3Percent:pct(value.top3,value.evaluated),
      })).sort((a,b)=>a.occasion.localeCompare(b.occasion)),
      interpretation:"Agreement measures whether the current deterministic Designer reproduces owner-labelled directions. It is not customer conversion, tailoring-fit accuracy or fabric-analysis accuracy.",
    },{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/designer-evaluation/scorecard]",error);
    return NextResponse.json({error:"Designer scorecard could not be calculated."},{status:500});
  }
}
