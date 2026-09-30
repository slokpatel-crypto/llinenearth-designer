import "server-only";
import type { CreativeFashnResult, SelectedLookFashnRequest, SelectedLookView } from "@/lib/ai-visualization";
import { selectedLookRenderCacheKey } from "@/lib/designer/render-cache-key";

const TRUSTED_OUTPUT=/^https:\/\/(cdn|media)\.fashn\.ai\//i;

function config() {
  const url=(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/,"");
  const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if(!url || !key) return null;
  return {url,key};
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T> {
  const cfg=config();
  if(!cfg) throw new Error("Designer render cache is not configured.");
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
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok) {
    const detail=(await response.text()).slice(0,400);
    throw new Error(`Designer render cache RPC ${name} failed (${response.status}): ${detail}`);
  }
  return await response.json() as T;
}

function validResult(value:unknown):value is CreativeFashnResult {
  if(!value || typeof value!=="object") return false;
  const result=value as Partial<CreativeFashnResult>;
  return typeof result.image==="string"
    && TRUSTED_OUTPUT.test(result.image)
    && typeof result.jobId==="string"
    && Number.isFinite(result.creditsUsed)
    && typeof result.conceptId==="string"
    && typeof result.generatedAt==="string";
}

export async function loadDurableSelectedLookRender(
  input:SelectedLookFashnRequest,
  view:SelectedLookView="front",
  frontImage?:string,
):Promise<CreativeFashnResult|null> {
  if(!config()) return null;
  const key=selectedLookRenderCacheKey(input,view,frontImage);
  try {
    const rows=await rpc<Array<{result:unknown}>>("designer_render_cache_get",{p_cache_key:key});
    const result=rows[0]?.result;
    return validResult(result) ? {...result,cached:true} : null;
  } catch {
    return null;
  }
}

export async function storeDurableSelectedLookRender(
  input:SelectedLookFashnRequest,
  result:CreativeFashnResult,
  view:SelectedLookView="front",
  frontImage?:string,
) {
  if(!config() || !validResult(result)) return false;
  const key=selectedLookRenderCacheKey(input,view,frontImage);
  try {
    await rpc<boolean>("designer_render_cache_upsert_v2",{
      p_cache_key:key,
      p_view:view,
      p_shirt_id:input.shirt.id,
      p_pant_id:input.pant.id,
      p_result:{
        image:result.image,
        jobId:result.jobId,
        creditsUsed:result.creditsUsed,
        conceptId:result.conceptId,
        generatedAt:result.generatedAt,
      },
      p_ttl_hours:720,
    });
    return true;
  } catch {
    return false;
  }
}


export type DesignerRenderCacheStats={
  total_entries:number;
  fresh_entries:number;
  total_hits:number;
  distinct_pairs:number;
  last_hit_at:string|null;
};

export type DesignerRenderCachePopularPair={
  shirt_id:string;
  pant_id:string;
  cache_hits:number;
  cached_variants:number;
  last_hit_at:string|null;
};

export async function loadDesignerRenderCacheStats() {
  if(!config()) return null;
  try {
    const rows=await rpc<DesignerRenderCacheStats[]>("designer_render_cache_stats",{});
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function loadPopularDesignerRenderPairs(limit=20) {
  if(!config()) return [] as DesignerRenderCachePopularPair[];
  try {
    return await rpc<DesignerRenderCachePopularPair[]>("designer_render_cache_popular",{
      p_limit:Math.max(1,Math.min(100,Math.floor(limit))),
    });
  } catch {
    return [] as DesignerRenderCachePopularPair[];
  }
}
