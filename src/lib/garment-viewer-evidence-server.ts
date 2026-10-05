import "server-only";

import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { loadGarmentViewerProductionAssetStatus } from "@/lib/garment-viewer-model-server";
import {
  GARMENT_VIEWER_REALISM_RUBRIC_VERSION,
  garmentViewerAssetIdentityMatches,
  garmentViewerPromotionReadiness,
  type GarmentViewerPatternScaleSample,
} from "@/lib/garment-viewer-readiness";
import type { Phase1BoundaryChecks, RealismAssessment } from "@/lib/designer/proof-scale";

type StyleEventRow={at:string;payload?:Record<string,unknown>};

function patternSamples(value:unknown):GarmentViewerPatternScaleSample[]{
  if(!Array.isArray(value)) return [];
  return value.slice(-20).flatMap((item)=>{
    if(!item||typeof item!=="object"||Array.isArray(item)) return [];
    const row=item as Record<string,unknown>;
    const fabricId=String(row.fabricId||"").trim().slice(0,160);
    const pattern=String(row.pattern||"");
    const errorPct=Number(row.errorPct);
    if(!fabricId||!["stripe","check","other"].includes(pattern)||!Number.isFinite(errorPct)||errorPct<0||errorPct>100) return [];
    return [{fabricId,pattern:pattern as GarmentViewerPatternScaleSample["pattern"],errorPct,verified:row.verified===true}];
  });
}

function latencies(value:unknown){
  return Array.isArray(value)
    ? value.map(Number).filter((item)=>Number.isFinite(item)&&item>=0&&item<=10000).slice(-120)
    : [];
}

function realism(value:unknown):RealismAssessment[]{
  if(!Array.isArray(value)) return [];
  return value.slice(-50).flatMap((item)=>{
    if(!item||typeof item!=="object"||Array.isArray(item)) return [];
    const row=item as Record<string,unknown>;
    const viewerId=String(row.viewerId||"").trim().toLowerCase().slice(0,80);
    const rating=Math.round(Number(row.rating));
    if(viewerId.length<2||rating<1||rating>5) return [];
    return [{viewerId,rating,recordedAt:String(row.recordedAt||"").slice(0,80)}];
  });
}

function boundaries(value:unknown):Phase1BoundaryChecks{
  const input=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
  return {
    neck:input.neck===true,
    cuffs:input.cuffs===true,
    waist:input.waist===true,
    trouserGap:input.trouserGap===true,
  };
}

export async function loadLatestGarmentViewerReadiness(){
  const asset=await loadGarmentViewerProductionAssetStatus();
  const cloud=getSupabaseAdminConfig();
  if(!cloud) return {configured:false as const,asset,latest:null};

  const params=new URLSearchParams({
    select:"at,payload",
    type:"eq.operator_note",
    source:"eq.operator",
    order:"at.desc",
    limit:"300",
  });

  try{
    const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
      cache:"no-store",
      signal:AbortSignal.timeout(8_000),
    });
    if(!response.ok) return {configured:true as const,asset,latest:null};
    const rows=await response.json() as StyleEventRow[];
    for(const row of rows){
      const payload=row.payload||{};
      if(String(payload.subtype||"")!=="garment_viewer_readiness") continue;
      if(String(payload.realismRubricVersion||"")!==GARMENT_VIEWER_REALISM_RUBRIC_VERSION) continue;
      const evidence={
        patternScaleSamples:patternSamples(payload.patternScaleSamples),
        interactionLatencyMs:latencies(payload.interactionLatencyMs),
        realismAssessments:realism(payload.realismAssessments),
        boundaryChecks:boundaries(payload.boundaryChecks),
      };
      const evidenceIdentity={
        modelId:String(payload.modelId||""),
        modelSha256:String(payload.modelSha256||"").toLowerCase(),
        manifestSha256:String(payload.manifestSha256||"").toLowerCase(),
      };
      const identityMatches=garmentViewerAssetIdentityMatches(asset.assetIdentity,evidenceIdentity);
      const readiness=garmentViewerPromotionReadiness({
        contract:identityMatches?asset.model?.contract||null:null,
        manifest:identityMatches?asset.manifest||null:null,
        ...evidence,
      });
      if(!identityMatches) readiness.reasons.unshift("Recorded QA evidence belongs to a different or missing GarmentViewer asset revision.");
      return {
        configured:true as const,
        asset,
        latest:{
          at:row.at,
          evidence,
          evidenceIdentity,
          identityMatches,
          readiness,
          note:String(payload.note||"").slice(0,700),
        },
      };
    }
    return {configured:true as const,asset,latest:null};
  }catch{
    return {configured:true as const,asset,latest:null};
  }
}
