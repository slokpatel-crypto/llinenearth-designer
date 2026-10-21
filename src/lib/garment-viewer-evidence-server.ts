import "server-only";

import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { loadGarmentViewerProductionAssetStatus } from "@/lib/garment-viewer-model-server";
import {
  GARMENT_VIEWER_REALISM_RUBRIC_VERSION,
  garmentViewerAssetIdentityMatches,
  garmentViewerPromotionReadiness,
  parseGarmentViewerAssetIdentity,
} from "@/lib/garment-viewer-readiness";
import type { Phase1BoundaryChecks } from "@/lib/designer/proof-scale";
import {
  parseGarmentPatternSamples,
  parseGarmentLatencySamples,
  parseGarmentRealismAssessments,
  garmentPatternSubmissionIsLossless,
  garmentLatencySubmissionIsLossless,
  garmentRealismSubmissionIsLossless,
} from "@/lib/garment-viewer-evidence-validation";

type StyleEventRow={at:string;payload?:Record<string,unknown>};

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
      // Old rows are still readable for operator audit, but any missing or
      // truncated raw observation must block release rather than silently
      // turning an otherwise failing record into a passing measurement set.
      const scaleLossless=garmentPatternSubmissionIsLossless(payload.patternScaleSamples);
      const latencyLossless=garmentLatencySubmissionIsLossless(payload.interactionLatencyMs);
      const realismLossless=garmentRealismSubmissionIsLossless(payload.realismAssessments);
      const evidence={
        patternScaleSamples:parseGarmentPatternSamples(payload.patternScaleSamples),
        interactionLatencyMs:parseGarmentLatencySamples(payload.interactionLatencyMs),
        realismAssessments:parseGarmentRealismAssessments(payload.realismAssessments),
        boundaryChecks:boundaries(payload.boundaryChecks),
      };
      // A malformed latest record must block; do not repair a hash or fall back
      // to an older passing record for a different asset snapshot.
      const evidenceIdentity=parseGarmentViewerAssetIdentity(payload);
      const identityMatches=garmentViewerAssetIdentityMatches(asset.assetIdentity,evidenceIdentity);
      const readiness=garmentViewerPromotionReadiness({
        contract:identityMatches?asset.model?.contract||null:null,
        manifest:identityMatches?asset.manifest||null:null,
        ...evidence,
      });
      if(!scaleLossless){
        readiness.scaleReady=false;
        readiness.reasons.unshift("Recorded physical scale evidence contains lost, malformed or truncated observations.");
      }
      if(!latencyLossless){
        readiness.latencyReady=false;
        readiness.reasons.unshift("Recorded latency evidence contains lost, malformed or truncated observations.");
      }
      if(!realismLossless){
        readiness.realismReady=false;
        readiness.reasons.unshift("Recorded realism evidence contains lost, malformed or truncated viewer assessments.");
      }
      readiness.ready=readiness.ready&&scaleLossless&&latencyLossless&&realismLossless;
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
