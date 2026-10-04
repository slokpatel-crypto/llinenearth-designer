import "server-only";
import { createHash } from "node:crypto";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { appendCreativeEvent } from "@/lib/designer/creative-profile-server";
import { FASHION_RESEARCH_SOURCES } from "@/lib/designer/fashion-research-source-pool";
import { collectFashionResearchPage } from "@/lib/designer/research-source-analysis";
import { RESEARCH_DAILY_LIMIT, researchPageHypothesis, researchRefreshSources, researchRunKey } from "@/lib/designer/research-refresh";

export async function researchRefreshStatus(){
  const cloud=getSupabaseAdminConfig();
  const base={configured:Boolean(cloud),cronConfigured:Boolean(process.env.CRON_SECRET),enabled:false,maxSources:RESEARCH_DAILY_LIMIT,paidModelCalls:0,runs:[] as Array<Record<string,unknown>>};
  if(!cloud)return base;
  const read=async(subtype:string,limit:string)=>{const params=new URLSearchParams({select:"payload,received_at",source:"eq.operator",type:"eq.operator_note","payload->>subtype":`eq.${subtype}`,order:"received_at.desc,id.desc",limit});const response=await fetch(`${cloud.url}/rest/v1/style_events?${params}`,{headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error("Research schedule is temporarily unavailable.");return await response.json() as Array<{payload:Record<string,unknown>;received_at:string}>;};
  const [settings,runs]=await Promise.all([read("designer_research_schedule","1"),read("designer_research_run","12")]);
  return {...base,enabled:settings[0]?.payload.enabled===true,runs:runs.map(r=>({...r.payload,receivedAt:r.received_at}))};
}
export async function refreshDesignerResearch(manual=false){
  const status=await researchRefreshStatus();
  if(!status.configured)return {status:"unconfigured",candidates:0,paidModelCalls:0};
  if(!manual&&!status.enabled)return {status:"paused",candidates:0,paidModelCalls:0};
  const now=new Date(),key=researchRunKey(now),sources=researchRefreshSources(FASHION_RESEARCH_SOURCES,now);
  // The ledger primary key is an atomic daily budget claim across serverless
  // instances. A failed/abandoned run cannot spend a second daily batch.
  const claim=await appendCreativeEvent("operator_note",{subtype:"designer_research_run",runKey:key,status:"started",sources:sources.map(s=>s.id),paidModelCalls:0},{id:key,source:"operator",session:"research-schedule"});
  if(claim.duplicate)return {status:"already_claimed",candidates:0,paidModelCalls:0};
  const results=await Promise.all(sources.map(async source=>{
    try{const page=await collectFashionResearchPage(source.baseUrl),hash=createHash("sha256").update(page.text).digest("hex"),candidate=researchPageHypothesis(source,page,{contentHash:hash,fetchedAt:new Date().toISOString()});
      if(!candidate)return {source:source.id,status:"no_design_signal"};
      const saved=await appendCreativeEvent("operator_note",{...candidate,subtype:"designer_creative_research",researchId:candidate.id},{id:`EV-RESEARCH-CANDIDATE-${candidate.id}`,source:"operator",session:"research-schedule"});
      return {source:source.id,status:saved.duplicate?"unchanged":"pending_review"};
    }catch{return {source:source.id,status:"fetch_failed"};}
  }));
  const completed={subtype:"designer_research_run",runKey:key,status:results.some(r=>r.status==="fetch_failed")?"completed_with_errors":"completed",results,candidates:results.filter(r=>r.status==="pending_review").length,paidModelCalls:0};
  await appendCreativeEvent("operator_note",completed,{id:key+"-complete",source:"operator",session:"research-schedule"});
  return completed;
}
