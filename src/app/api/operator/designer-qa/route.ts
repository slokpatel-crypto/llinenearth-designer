import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FABRIC_STOCK, fabricProfileFromStock } from "@/lib/fabric-stock";
import type { ContextProfile, DesignerBrief } from "@/lib/designer-types";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { LOW_CONFIDENCE_THRESHOLD, rankStockPairings, recommendStockPairing } from "@/lib/shirt-pant-designer";

export const runtime = "nodejs";
export const maxDuration = 30;

const SCENARIOS:Array<{id:string;label:string;context:ContextProfile}> = [
  {id:"business-day",label:"Business · daytime",context:{occasion:"Business",venue:"Office / boardroom",time:"Daytime",environment:"Indoor / air-conditioned",formality:"Formal",impression:"Sharp and powerful",fit:"Tailored",aesthetic:"Modern Classic"}},
  {id:"smart-casual",label:"Smart casual · city",context:{occasion:"Smart casual",venue:"Outdoor city",time:"Late afternoon",environment:"Mixed indoor + outdoor",formality:"Smart relaxed",impression:"Quiet confidence",fit:"Straight",aesthetic:"Quiet Luxury"}},
  {id:"dinner-evening",label:"Dinner · evening",context:{occasion:"Dinner / evening",venue:"Restaurant / club",time:"Evening",environment:"Mostly indoor",formality:"Refined",impression:"Relaxed sophistication",fit:"Tailored",aesthetic:"Italian-Inspired"}},
  {id:"wedding",label:"Wedding · hotel",context:{occasion:"Wedding",venue:"Luxury hotel",time:"Evening",environment:"Mostly indoor",formality:"Formal",impression:"Traditional refinement",fit:"Tailored",aesthetic:"Contemporary Indian"}},
  {id:"resort",label:"Resort · hot weather",context:{occasion:"Resort / holiday",venue:"Beach / coast",time:"Daytime",environment:"Hot / humid outdoor",formality:"Relaxed",impression:"Relaxed sophistication",fit:"Relaxed",aesthetic:"Resort Luxury"}},
  {id:"festive",label:"Festive · evening",context:{occasion:"Festive / cultural",venue:"Home / private event",time:"Evening",environment:"Mostly indoor",formality:"Refined",impression:"Creative individuality",fit:"Tailored",aesthetic:"Contemporary Indian"}},
];

export async function GET() {
  const jar = await cookies();
  const valid = await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
  if (!valid) return NextResponse.json({error:"Unauthorized."},{status:401});

  const metadata = await loadDesignerFabricMetadata();
  const stock = applyDesignerFabricMetadataToStock(metadata);
  const anchors = stock.filter((fabric)=>fabric.inStock && (fabric.suitableFor.includes("shirt") || fabric.suitableFor.includes("trouser")));

  const warningCounts:Record<string,number> = {};
  const modeCounts:Record<string,number> = {};
  const cases:Array<{
    scenarioId:string;scenarioLabel:string;anchorId:string;anchorName:string;anchorLine:string;
    anchorKind:string;directions:number;confidence:number;held:boolean;pairing:string;
    warnings:string[];unknowns:string[];
  }> = [];

  let directionTotal=0;
  let heldTotal=0;
  let noResultTotal=0;
  let confidenceTotal=0;
  let confidenceCases=0;

  for (const scenario of SCENARIOS) {
    for (const anchor of anchors) {
      const brief:DesignerBrief = {
        sessionId:"DESIGNER-QA",
        fabric:{
          profile:fabricProfileFromStock(anchor),
          materialOverride:anchor.family,
          toneOverride:anchor.colorName,
          source:"stock",
          stockId:anchor.id,
          swatchImageUrl:anchor.swatchImageUrl,
        },
        context:scenario.context,
      };

      const ranked = rankStockPairings(brief,stock);
      const primary = ranked.find((item)=>item.mode==="Elevated") || ranked[0] || recommendStockPairing(brief,stock);
      directionTotal += ranked.length;

      if (!primary) {
        noResultTotal += 1;
        cases.push({
          scenarioId:scenario.id,scenarioLabel:scenario.label,anchorId:anchor.id,anchorName:anchor.colorName,anchorLine:anchor.line,
          anchorKind:anchor.suitableFor.includes("shirt")?"shirt":"trouser",directions:0,confidence:0,held:true,pairing:"No valid opposite-category stock",
          warnings:[],unknowns:[],
        });
        continue;
      }

      confidenceTotal += primary.confidenceScore;
      confidenceCases += 1;
      const held = !primary.forced || primary.confidenceScore < LOW_CONFIDENCE_THRESHOLD;
      if (held) heldTotal += 1;

      for (const item of ranked) {
        const mode = item.mode || "Primary";
        modeCounts[mode] = (modeCounts[mode] || 0) + 1;
      }

      const warnings = primary.rules.filter((rule)=>rule.status==="warn").map((rule)=>rule.id);
      const unknowns = primary.rules.filter((rule)=>rule.status==="unknown").map((rule)=>rule.id);
      for (const id of warnings) warningCounts[id] = (warningCounts[id] || 0) + 1;

      cases.push({
        scenarioId:scenario.id,
        scenarioLabel:scenario.label,
        anchorId:anchor.id,
        anchorName:anchor.colorName,
        anchorLine:anchor.line,
        anchorKind:anchor.suitableFor.includes("shirt")?"shirt":"trouser",
        directions:ranked.length || 1,
        confidence:primary.confidenceScore,
        held,
        pairing:`${primary.shirt.colorName} + ${primary.trouser.colorName}`,
        warnings,
        unknowns,
      });
    }
  }

  const metadataValues = Object.values(metadata);
  const coverage = {
    total:stock.length,
    physicallyVerified:metadataValues.filter((item)=>item.availability==="available" || item.availability==="unavailable").length,
    weight:stock.filter((item)=>item.weightClass || item.weightGsm).length,
    season:stock.filter((item)=>item.seasonTags?.length).length,
    formality:stock.filter((item)=>item.formalityScore != null).length,
    drape:stock.filter((item)=>item.drape).length,
  };

  const totalCases = SCENARIOS.length * anchors.length;
  const weakCases = cases
    .filter((item)=>item.held || item.warnings.length || item.directions<2)
    .sort((a,b)=>Number(b.held)-Number(a.held) || a.confidence-b.confidence || b.warnings.length-a.warnings.length)
    .slice(0,120);

  return NextResponse.json({
    generatedAt:new Date().toISOString(),
    scenarios:SCENARIOS.map(({id,label})=>({id,label})),
    coverage,
    summary:{
      anchors:anchors.length,
      scenarios:SCENARIOS.length,
      totalCases,
      heldCases:heldTotal,
      noResultCases:noResultTotal,
      averageConfidence:confidenceCases ? Math.round(confidenceTotal/confidenceCases) : 0,
      averageDirections:totalCases ? Math.round((directionTotal/totalCases)*10)/10 : 0,
      modeCounts,
      warningCounts,
    },
    weakCases,
  });
}
