import "server-only";

import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { loadGarmentViewerProductionAssetStatus } from "@/lib/garment-viewer-model-server";
import {
  GARMENT_VIEWER_REALISM_RUBRIC_VERSION,
  garmentViewerAssetIdentityMatches,
  garmentViewerPromotionReadiness,
  normalizeGarmentViewerPatternSamples,
  normalizeGarmentViewerLatencies,
  normalizeGarmentViewerRealism,
  normalizeGarmentViewerBoundaries,
} from "@/lib/garment-viewer-readiness";

type StyleEventRow={at:string;payload?:Record<string,unknown>};

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
        patternScaleSamples:normalizeGarmentViewerPatternSamples(payload.patternScaleSamples),
        interactionLatencyMs:normalizeGarmentViewerLatencies(payload.interactionLatencyMs),
        realismAssessments:normalizeGarmentViewerRealism(payload.realismAssessments),
        boundaryChecks:normalizeGarmentViewerBoundaries(payload.boundaryChecks),
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
