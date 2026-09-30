import "server-only";

import { DESIGNER_BENCHMARK_VERSION } from "@/lib/designer/benchmark";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export type DesignerBenchmarkCandidateIdentity={
  id:string;
  tier:string;
  shirtId:string;
  pantId:string;
};

export type DesignerBenchmarkLabel={
  caseId:string;
  choice:"0"|"1"|"2"|"none";
  reason:string;
  occasion:string;
  climate:string;
  intention:string;
  anchorShirtId:string;
  anchorPantId:string;
  candidates:DesignerBenchmarkCandidateIdentity[];
  selected:DesignerBenchmarkCandidateIdentity|null;
  engineRuleSetVersion:string|null;
  at:string;
};

type Row={at:string;payload?:Record<string,unknown>};

function clean(value:unknown,limit=180){
  return String(value??"").trim().slice(0,limit);
}

export async function loadDesignerBenchmarkLabels() {
  const cloud=getSupabaseAdminConfig();
  if(!cloud) return {configured:false,labels:new Map<string,DesignerBenchmarkLabel>()};

  try{
    const params=new URLSearchParams({
      select:"at,payload",
      type:"eq.operator_note",
      source:"eq.operator",
      order:"at.desc",
      limit:"1600",
    });
    const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
      cache:"no-store",
    });
    if(!response.ok) return {configured:true,labels:new Map<string,DesignerBenchmarkLabel>()};

    const rows=await response.json() as Row[];
    const labels=new Map<string,DesignerBenchmarkLabel>();
    for(const row of rows){
      const payload=row.payload||{};
      if(clean(payload.subtype,80)!=="designer_benchmark_label") continue;
      if(clean(payload.version,80)!==DESIGNER_BENCHMARK_VERSION) continue;
      const caseId=clean(payload.caseId,80);
      const choice=clean(payload.choice,20) as DesignerBenchmarkLabel["choice"];
      if(!caseId || !["0","1","2","none"].includes(choice) || labels.has(caseId)) continue;

      const candidates=Array.isArray(payload.candidates)
        ? payload.candidates.slice(0,3).map((raw)=>{
          const item=raw && typeof raw==="object" ? raw as Record<string,unknown> : {};
          return {
            id:clean(item.id,180),
            tier:clean(item.tier,30),
            shirtId:clean(item.shirtId,140),
            pantId:clean(item.pantId,140),
          };
        }).filter((item)=>item.id&&item.tier&&item.shirtId&&item.pantId)
        : [];
      const selected=choice==="none" ? null : candidates[Number(choice)] || null;
      labels.set(caseId,{
        caseId,
        choice,
        reason:clean(payload.reason,80)||"other",
        occasion:clean(payload.occasion,40),
        climate:clean(payload.climate,40),
        intention:clean(payload.intention,40),
        anchorShirtId:clean(payload.anchorShirtId,140),
        anchorPantId:clean(payload.anchorPantId,140),
        candidates,
        selected,
        engineRuleSetVersion:clean(payload.engineRuleSetVersion,100)||null,
        at:row.at,
      });
    }
    return {configured:true,labels};
  }catch{
    return {configured:true,labels:new Map<string,DesignerBenchmarkLabel>()};
  }
}
