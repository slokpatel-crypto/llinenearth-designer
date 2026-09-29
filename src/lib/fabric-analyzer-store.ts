import "server-only";
import { createHash } from "node:crypto";
import type { FabricAnalyzerContext, FabricAnalyzerProfile } from "@/lib/fabric-analyzer";

const ANALYZER_VERSION="fabric-analyzer-v3";

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

export function fabricAnalysisFingerprint(input:FabricAnalyzerContext) {
  const canonical=JSON.stringify({
    imageUrl:clean(input.imageUrl,1800),
    declaredMaterial:clean(input.declaredMaterial,120),
    declaredFabricType:clean(input.declaredFabricType,120),
    supplierColorName:clean(input.supplierColorName,120),
    supplierPatternName:clean(input.supplierPatternName,120),
    notes:clean(input.notes,300),
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
      declaredMaterial:clean(input.declaredMaterial,120),
      declaredFabricType:clean(input.declaredFabricType,120),
      supplierColorName:clean(input.supplierColorName,120),
      supplierPatternName:clean(input.supplierPatternName,120),
      notes:clean(input.notes,300),
    },
    p_analyzer_version:ANALYZER_VERSION,
    p_model_id:clean(modelId,120),
    p_profile:profile,
    p_confidence:profile.confidence,
  });
  return typeof result==="string" ? result : null;
}

export async function recordFabricAnalyzerCorrection(input:{
  profileId:string;
  fieldPath:string;
  previousValue:unknown;
  correctedValue:unknown;
  reason?:string;
}) {
  if(!config()) return null;
  const result=await rpc<string>("fabric_analyzer_feedback_insert",{
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
