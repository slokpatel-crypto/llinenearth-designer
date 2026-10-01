import "server-only";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import type { CreativeFashnResult, SelectedLookView } from "@/lib/ai-visualization";

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Render outcome backend is not configured.");
  const response=await fetch(`${config.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    const detail=(await response.text()).slice(0,300);
    throw new Error(`Render outcome RPC ${name} failed (${response.status}): ${detail}`);
  }
  return await response.json() as T;
}

export type RenderOutcomeRow={
  outcome_id:string;
  job_id:string;
  concept_id:string;
  view:SelectedLookView;
  shirt_id:string;
  pant_id:string;
  credits_used:number;
  cached:boolean;
  repair:boolean;
  qa_status:"pass"|"review"|null;
  qa_payload:unknown;
  human_status:"pending"|"approved"|"rejected";
  human_note:string;
  generated_at:string;
  created_at:string;
  reviewed_at:string|null;
};

export async function recordRenderOutcome(input:{
  result:CreativeFashnResult;
  view:SelectedLookView;
  shirtId:string;
  pantId:string;
  repair?:boolean;
}) {
  if(!getSupabaseAdminConfig()) return null;
  try{
    return await rpc<string>("designer_render_outcome_record",{
      p_job_id:input.result.jobId,
      p_concept_id:input.result.conceptId,
      p_view:input.view,
      p_shirt_id:input.shirtId,
      p_pant_id:input.pantId,
      p_credits_used:Number(input.result.creditsUsed)||0,
      p_cached:input.result.cached===true,
      p_repair:input.repair===true,
      p_generated_at:input.result.generatedAt,
    });
  }catch{
    return null;
  }
}

export async function attachRenderQa(input:{
  jobId:string;
  view:SelectedLookView;
  status:"pass"|"review";
  payload:unknown;
}) {
  if(!getSupabaseAdminConfig()) return false;
  try{
    return await rpc<boolean>("designer_render_outcome_attach_qa",{
      p_job_id:input.jobId,
      p_view:input.view,
      p_qa_status:input.status,
      p_qa_payload:input.payload,
    });
  }catch{
    return false;
  }
}

export async function reviewRenderOutcome(input:{
  outcomeId:string;
  status:"approved"|"rejected";
  note?:string;
}) {
  return rpc<boolean>("designer_render_outcome_review",{
    p_outcome_id:input.outcomeId,
    p_human_status:input.status,
    p_human_note:String(input.note||"").slice(0,1000),
  });
}

export async function listRenderOutcomes(limit=200) {
  if(!getSupabaseAdminConfig()) return [] as RenderOutcomeRow[];
  try{
    return await rpc<RenderOutcomeRow[]>("designer_render_outcome_list",{
      p_limit:Math.max(1,Math.min(1000,Math.floor(limit))),
    });
  }catch{
    return [] as RenderOutcomeRow[];
  }
}


export type RenderPatternCalibrationRow={
  calibration_id:string;
  outcome_id:string;
  garment:"shirt"|"trouser";
  expected_repeat_mm:number;
  observed_repeat_mm:number;
  scale_error_pct:number;
  axis_status:"match"|"mismatch"|"not_applicable";
  note:string;
  measurement_method:"legacy_direct_mm"|"pixel_fixture_v2";
  reference_mm:number|null;
  reference_px:number|null;
  observed_repeat_px:number|null;
  created_at:string;
};

export async function recordRenderPatternCalibration(input:{
  outcomeId:string;
  garment:"shirt"|"trouser";
  expectedRepeatMm:number;
  referenceMm:number;
  referencePx:number;
  observedRepeatPx:number;
  axisStatus:"match"|"mismatch"|"not_applicable";
  note?:string;
}) {
  return rpc<string>("designer_render_pattern_calibration_record_v2",{
    p_outcome_id:input.outcomeId,
    p_garment:input.garment,
    p_expected_repeat_mm:input.expectedRepeatMm,
    p_reference_mm:input.referenceMm,
    p_reference_px:input.referencePx,
    p_observed_repeat_px:input.observedRepeatPx,
    p_axis_status:input.axisStatus,
    p_note:String(input.note||"").slice(0,1000),
  });
}

export async function listRenderPatternCalibrations(limit=200) {
  if(!getSupabaseAdminConfig()) return [] as RenderPatternCalibrationRow[];
  try{
    return await rpc<RenderPatternCalibrationRow[]>("designer_render_pattern_calibration_list_v2",{
      p_limit:Math.max(1,Math.min(1000,Math.floor(limit))),
    });
  }catch{
    return [] as RenderPatternCalibrationRow[];
  }
}


export type RenderIdentityReviewRow={
  review_id:string;
  concept_id:string;
  status:"pass"|"fail";
  reviewed_views:string[];
  reviewer:string;
  note:string;
  created_at:string;
};

export type RenderCreditCapRow={
  event_id:string;
  credits_per_approved_cap:number;
  reviewer:string;
  note:string;
  created_at:string;
};

export async function recordRenderIdentityReview(input:{
  conceptId:string;
  status:"pass"|"fail";
  reviewer:string;
  note?:string;
}) {
  return rpc<string>("designer_render_identity_review_record",{
    p_concept_id:String(input.conceptId||"").slice(0,180),
    p_status:input.status,
    p_reviewer:String(input.reviewer||"").slice(0,120),
    p_note:String(input.note||"").slice(0,1000),
  });
}

export async function listRenderIdentityReviews(limit=300) {
  if(!getSupabaseAdminConfig()) return [] as RenderIdentityReviewRow[];
  try{
    return await rpc<RenderIdentityReviewRow[]>("designer_render_identity_review_list",{
      p_limit:Math.max(1,Math.min(1000,Math.floor(limit))),
    });
  }catch{
    return [] as RenderIdentityReviewRow[];
  }
}

export async function recordRenderCreditCap(input:{
  cap:number;
  reviewer:string;
  note?:string;
}) {
  return rpc<string>("designer_render_credit_cap_record",{
    p_cap:input.cap,
    p_reviewer:String(input.reviewer||"").slice(0,120),
    p_note:String(input.note||"").slice(0,1000),
  });
}

export async function latestRenderCreditCap() {
  if(!getSupabaseAdminConfig()) return null as RenderCreditCapRow|null;
  try{
    const rows=await rpc<RenderCreditCapRow[]>("designer_render_credit_cap_latest",{});
    return rows[0]||null;
  }catch{
    return null;
  }
}
