import "server-only";
import { createHash } from "node:crypto";
import type { FabricAnalyzerContext, FabricAnalyzerProfile } from "@/lib/fabric-analyzer";

const ANALYZER_VERSION="fabric-analyzer-v4";

function config() {
  const url=(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/,"");
  const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if(!url || !key) return null;
  return {url,key};
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T> {
  const cfg=config();
  if(!cfg) throw new Error("Private Fabric Analyzer store is not configured.");
  const response=await fetch(`${cfg.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{
      apikey:cfg.key,
      authorization:`Bearer ${cfg.key}`,
      "content-type":"application/json",
      accept:"application/json",
    },
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(12_000),
  });
  if(!response.ok) {
    const detail=(await response.text()).slice(0,500);
    throw new Error(`Fabric Analyzer store RPC ${name} failed (${response.status}): ${detail}`);
  }
  return await response.json() as T;
}

function clean(value:unknown,limit:number) {
  return String(value??"").replace(/\s+/g," ").trim().slice(0,limit);
}


function canonicalUrlIdentity(value:unknown,limit=1800) {
  const raw=clean(value,limit);
  if(!raw) return "";
  try {
    const url=new URL(raw);
    // Signed CDN/cache-busting parameters can change while the underlying image
    // stays identical. Fingerprint the stable origin + path identity.
    return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname}`;
  } catch {
    return raw;
  }
}

export function fabricAnalysisFingerprint(input:FabricAnalyzerContext) {
  const contentSha=clean(input.contentSha256,128);
  const perceptualHash=clean(input.perceptualHash,64);
  const evidence={
      sourceId:clean(input.sourceId,80),
      sourcePageUrl:canonicalUrlIdentity(input.sourcePageUrl),
      declaredMaterial:clean(input.declaredMaterial,120),
      declaredFabricType:clean(input.declaredFabricType,120),
      supplierColorName:clean(input.supplierColorName,120),
      supplierPatternName:clean(input.supplierPatternName,120),
      swatchRealWidthMm:Number.isFinite(input.swatchRealWidthMm)?Number(input.swatchRealWidthMm):null,
      repeatRealMm:Number.isFinite(input.repeatRealMm)?Number(input.repeatRealMm):null,
      verifiedGsm:Number.isFinite(input.verifiedGsm)?Number(input.verifiedGsm):null,
      verifiedDrape:clean(input.verifiedDrape,40),
      verifiedFiberContent:clean(input.verifiedFiberContent,220),
      verifiedPhysicalSourceUrl:canonicalUrlIdentity(input.verifiedPhysicalSourceUrl),
    };
  const canonical=contentSha
    ? JSON.stringify({
      contentSha256:contentSha,
      perceptualHash,
      macroContentSha256:clean(input.macroContentSha256,128),
      foldContentSha256:clean(input.foldContentSha256,128),
      evidence,
    })
    : JSON.stringify({
      imageUrl:canonicalUrlIdentity(input.imageUrl),
      macroImageUrl:canonicalUrlIdentity(input.macroImageUrl),
      foldImageUrl:canonicalUrlIdentity(input.foldImageUrl),
      evidence,
    });
  return createHash("sha256").update(canonical).digest("hex");
}

export type StoredFabricAnalysis = {
  id:string;
  image_fingerprint:string;
  image_source:string;
  declared_context:Record<string,unknown>;
  analyzer_version:string;
  model_id:string;
  profile:FabricAnalyzerProfile;
  confidence:FabricAnalyzerProfile["confidence"];
  review_status:"unreviewed"|"approved"|"corrected"|"rejected";
  review_notes:string;
  created_at:string;
  updated_at:string;
};

export async function loadStoredFabricAnalysis(
  input:FabricAnalyzerContext,
):Promise<StoredFabricAnalysis|null> {
  if(!config()) return null;
  const rows=await rpc<StoredFabricAnalysis[]>("fabric_analyzer_profile_get",{
    p_image_fingerprint:fabricAnalysisFingerprint(input),
    p_analyzer_version:ANALYZER_VERSION,
  });
  return rows[0] || null;
}

export async function storeFabricAnalysis(
  input:FabricAnalyzerContext,
  profile:FabricAnalyzerProfile,
  modelId:string,
):Promise<string|null> {
  if(!config()) return null;
  const result=await rpc<string>("fabric_analyzer_profile_upsert",{
    p_image_fingerprint:fabricAnalysisFingerprint(input),
    p_image_source:clean(input.imageUrl,1800),
    p_declared_context:{
      sourcePageUrl:clean(input.sourcePageUrl,1800),
      sourceId:clean(input.sourceId,80),
      declaredMaterial:clean(input.declaredMaterial,120),
      declaredFabricType:clean(input.declaredFabricType,120),
      supplierColorName:clean(input.supplierColorName,120),
      supplierPatternName:clean(input.supplierPatternName,120),
      notes:clean(input.notes,500),
      macroImageUrl:clean(input.macroImageUrl,1800),
      foldImageUrl:clean(input.foldImageUrl,1800),
      swatchRealWidthMm:Number.isFinite(input.swatchRealWidthMm)?input.swatchRealWidthMm:null,
      repeatRealMm:Number.isFinite(input.repeatRealMm)?input.repeatRealMm:null,
      verifiedGsm:Number.isFinite(input.verifiedGsm)?input.verifiedGsm:null,
      verifiedDrape:clean(input.verifiedDrape,40),
      verifiedFiberContent:clean(input.verifiedFiberContent,220),
      verifiedPhysicalSourceUrl:clean(input.verifiedPhysicalSourceUrl,1800),
      contentSha256:clean(input.contentSha256,128),
      perceptualHash:clean(input.perceptualHash,64),
      macroContentSha256:clean(input.macroContentSha256,128),
      foldContentSha256:clean(input.foldContentSha256,128),
    },
    p_analyzer_version:ANALYZER_VERSION,
    p_model_id:clean(modelId,120),
    p_profile:profile,
    p_confidence:profile.confidence,
  });
  const profileId=typeof result==="string" ? result : null;
  const fabricId=clean(input.fabricId,160);
  if(profileId && fabricId) {
    try {
      await rpc<boolean>("fabric_analyzer_profile_bind",{p_fabric_id:fabricId,p_profile_id:profileId});
    } catch {
      // A profile remains useful even if an optional stock binding fails.
    }
  }
  return profileId;
}

export async function recordFabricAnalyzerCorrection(input:{
  profileId:string;
  fieldPath:string;
  previousValue:unknown;
  correctedValue:unknown;
  reason?:string;
}) {
  if(!config()) return null;
  const result=await rpc<string>("fabric_analyzer_feedback_apply",{
    p_profile_id:input.profileId,
    p_field_path:clean(input.fieldPath,180),
    p_previous_value:input.previousValue ?? null,
    p_corrected_value:input.correctedValue ?? null,
    p_reason:clean(input.reason,600),
  });
  return typeof result==="string" ? result : null;
}


export type FabricAnalyzerLearningHint = {
  field_path:string;
  corrected_value:unknown;
  samples:number;
};

let learningCache:{at:number;hints:FabricAnalyzerLearningHint[]}|null=null;

export async function loadFabricAnalyzerLearningHints():Promise<FabricAnalyzerLearningHint[]> {
  if(!config()) return [];
  const now=Date.now();
  if(learningCache && now-learningCache.at<5*60_000) return learningCache.hints;
  try {
    const rows=await rpc<Array<{field_path:string;corrected_value:unknown;samples:number|string}>>(
      "fabric_analyzer_learning_summary",
      {p_min_samples:3},
    );
    const hints=rows.slice(0,80).map((row)=>({
      field_path:clean(row.field_path,180),
      corrected_value:row.corrected_value,
      samples:Math.max(0,Math.min(10000,Number(row.samples)||0)),
    })).filter((row)=>row.field_path && row.samples>=3);
    learningCache={at:now,hints};
    return hints;
  } catch {
    return [];
  }
}


export type BoundFabricAnalysis = StoredFabricAnalysis & {fabric_id:string};

export async function loadFabricAnalysesForFabricIds(
  fabricIds:string[],
  options:{includeUnreviewed?:boolean}={},
):Promise<BoundFabricAnalysis[]> {
  if(!config()) return [];
  const ids=[...new Set(fabricIds.map((id)=>clean(id,160)).filter(Boolean))].slice(0,500);
  if(!ids.length) return [];
  try {
    return await rpc<BoundFabricAnalysis[]>("fabric_analyzer_profiles_for_fabrics",{
      p_fabric_ids:ids,
      p_include_unreviewed:options.includeUnreviewed!==false,
    });
  } catch {
    return [];
  }
}

export async function reviewFabricAnalyzerProfile(input:{
  profileId:string;
  status:"unreviewed"|"approved"|"corrected"|"rejected";
  notes?:string;
}) {
  if(!config()) return false;
  try {
    return await rpc<boolean>("fabric_analyzer_profile_review",{
      p_profile_id:input.profileId,
      p_status:input.status,
      p_notes:clean(input.notes,1200),
    });
  } catch {
    return false;
  }
}

export type FabricAnalyzerBatchItem = {
  fabricId?:string;
  imageUrl?:string;
  macroImageUrl?:string;
  foldImageUrl?:string;
  sourcePageUrl?:string;
  sourceId?:string;
  declaredMaterial?:string;
  declaredFabricType?:string;
  supplierColorName?:string;
  supplierPatternName?:string;
  notes?:string;
  swatchRealWidthMm?:number;
  repeatRealMm?:number;
  verifiedGsm?:number;
  verifiedDrape?:"Fluid"|"Balanced"|"Structured";
  verifiedFiberContent?:string;
  verifiedPhysicalSourceUrl?:string;
  force?:boolean;
};

export async function enqueueFabricAnalyzerBatch(items:FabricAnalyzerBatchItem[]) {
  if(!config()) return null;
  const cleanItems=items.slice(0,500).map((item)=>({
    fabricId:clean(item.fabricId,160),
    imageUrl:clean(item.imageUrl,1800),
    macroImageUrl:clean(item.macroImageUrl,1800),
    foldImageUrl:clean(item.foldImageUrl,1800),
    sourcePageUrl:clean(item.sourcePageUrl,1800),
    sourceId:clean(item.sourceId,80),
    declaredMaterial:clean(item.declaredMaterial,120),
    declaredFabricType:clean(item.declaredFabricType,120),
    supplierColorName:clean(item.supplierColorName,120),
    supplierPatternName:clean(item.supplierPatternName,120),
    notes:clean(item.notes,500),
    swatchRealWidthMm:Number.isFinite(item.swatchRealWidthMm)?Number(item.swatchRealWidthMm):null,
    repeatRealMm:Number.isFinite(item.repeatRealMm)?Number(item.repeatRealMm):null,
    verifiedGsm:Number.isFinite(item.verifiedGsm)?Number(item.verifiedGsm):null,
    verifiedDrape:["Fluid","Balanced","Structured"].includes(String(item.verifiedDrape))?String(item.verifiedDrape):"",
    verifiedFiberContent:clean(item.verifiedFiberContent,220),
    verifiedPhysicalSourceUrl:clean(item.verifiedPhysicalSourceUrl,1800),
    force:item.force===true,
  })).filter((item)=>item.imageUrl||item.sourcePageUrl);
  if(!cleanItems.length) return null;
  const rows=await rpc<Array<{batch_id:string;queued:number}>>("fabric_analyzer_batch_enqueue",{p_items:cleanItems});
  return rows[0] || null;
}

export type ClaimedFabricAnalyzerJob = {
  id:string;
  batch_id:string;
  fabric_id:string|null;
  image_url:string|null;
  source_page_url:string|null;
  source_id:string|null;
  declared_context:Record<string,unknown>;
  force:boolean;
  attempts:number;
};

export async function claimFabricAnalyzerJobs(limit=4):Promise<ClaimedFabricAnalyzerJob[]> {
  if(!config()) return [];
  try {
    return await rpc<ClaimedFabricAnalyzerJob[]>("fabric_analyzer_jobs_claim",{
      p_limit:Math.max(1,Math.min(8,Math.floor(limit)||4)),
    });
  } catch {
    return [];
  }
}

export async function finishFabricAnalyzerJob(input:{
  jobId:string;
  status:"complete"|"error";
  profileId?:string|null;
  error?:string;
}) {
  if(!config()) return false;
  try {
    return await rpc<boolean>("fabric_analyzer_job_finish",{
      p_job_id:input.jobId,
      p_status:input.status,
      p_profile_id:input.profileId || null,
      p_error:clean(input.error,1000),
    });
  } catch {
    return false;
  }
}

export async function loadFabricAnalyzerBatchStatus(batchId:string) {
  if(!config()) return [];
  try {
    return await rpc<Array<{status:string;count:number|string}>>("fabric_analyzer_batch_status",{
      p_batch_id:batchId,
    });
  } catch {
    return [];
  }
}

export type FabricAnalyzerStats = {
  profiles:number;
  pending_review:number;
  approved:number;
  corrected:number;
  rejected:number;
  bindings:number;
  feedback:number;
  source_groups:number;
  material_terms:number;
  pattern_terms:number;
  color_terms:number;
  real_examples:number;
  relationships:number;
  source_backed_relationships:number;
  calibration_cases:number;
};

export async function loadFabricAnalyzerStats():Promise<FabricAnalyzerStats|null> {
  if(!config()) return null;
  try {
    const rows=await rpc<FabricAnalyzerStats[]>("fabric_analyzer_stats",{});
    return rows[0] || null;
  } catch {
    return null;
  }
}

export type FabricAnalyzerCalibrationCase = {
  id:string;
  source_id:string;
  source_url:string;
  expected:Record<string,unknown>;
  notes:string;
  last_profile_id:string|null;
  last_score:number|null;
  last_result:Record<string,unknown>;
  last_run_at:string|null;
};

export async function loadFabricAnalyzerCalibrationCases(limit=12):Promise<FabricAnalyzerCalibrationCase[]> {
  if(!config()) return [];
  try {
    return await rpc<FabricAnalyzerCalibrationCase[]>("fabric_analyzer_calibration_cases_get",{
      p_limit:Math.max(1,Math.min(30,Math.floor(limit)||12)),
    });
  } catch {
    return [];
  }
}

export async function recordFabricAnalyzerCalibration(input:{
  caseId:string;
  profileId:string|null;
  score:number;
  result:Record<string,unknown>;
}) {
  if(!config()) return false;
  try {
    return await rpc<boolean>("fabric_analyzer_calibration_record",{
      p_case_id:clean(input.caseId,160),
      p_profile_id:input.profileId || null,
      p_score:Math.max(0,Math.min(100,input.score)),
      p_result:input.result,
    });
  } catch {
    return false;
  }
}

export async function loadFabricAnalyzerProfilesForReview(limit=50):Promise<BoundFabricAnalysis[]> {
  if(!config()) return [];
  try {
    return await rpc<BoundFabricAnalysis[]>("fabric_analyzer_profiles_for_review",{
      p_limit:Math.max(1,Math.min(200,Math.floor(limit)||50)),
    });
  } catch {
    return [];
  }
}
