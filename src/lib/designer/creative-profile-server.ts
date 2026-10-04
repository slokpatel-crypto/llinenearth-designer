import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { creativePersonalContext, type CreativeProfileEvent } from "@/lib/designer/creative-profile";

export async function readCreativePersonalContext(owner:string){
  const cloud=getSupabaseAdminConfig();
  if(!cloud)return {...creativePersonalContext([],owner),configured:false};
  const params=new URLSearchParams({select:"type,payload,received_at","payload->>customerId":`eq.${owner}`,type:"in.(customer_updated,designer_feedback)",order:"received_at.desc,id.desc",limit:"1000"});
  const response=await fetch(`${cloud.url}/rest/v1/style_events?${params}`,{headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error("Creative memory is temporarily unavailable.");
  const rows=await response.json() as CreativeProfileEvent[];
  // Read settings separately: a long review history must not erase opt-out/reset.
  const settingsParams=new URLSearchParams({select:"type,payload,received_at","payload->>customerId":`eq.${owner}`,"payload->>subtype":"eq.designer_creative_profile",type:"eq.customer_updated",order:"received_at.desc,id.desc",limit:"1"});
  const settingsResponse=await fetch(`${cloud.url}/rest/v1/style_events?${settingsParams}`,{headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!settingsResponse.ok)throw new Error("Creative preferences are temporarily unavailable.");
  const settings=await settingsResponse.json() as CreativeProfileEvent[];
  return {...creativePersonalContext([...rows.reverse().filter(r=>r.payload.subtype!=="designer_creative_profile"),...settings],owner),configured:true};
}
export async function appendCreativeEvent(type:"customer_updated"|"designer_feedback"|"operator_note",payload:Record<string,unknown>,options:{id?:string;source?:"operator"|"style-director";session?:string}={}) {
  const cloud=getSupabaseAdminConfig();
  if(!cloud)throw new Error("Creative persistence is not configured.");
  const response=await fetch(`${cloud.url}/rest/v1/style_events`,{method:"POST",headers:{...supabaseAdminHeaders(cloud),"content-type":"application/json",prefer:"return=representation"},body:JSON.stringify({id:options.id||`EV-CRAFT-${randomUUID()}`,session_id:options.session||"creative-studio",type,at:new Date().toISOString(),source:options.source||"style-director",payload}),cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(response.status===409)return {duplicate:true,receivedAt:""};
  if(!response.ok)throw new Error("Creative persistence is temporarily unavailable.");
  const rows=await response.json() as Array<{received_at:string}>;
  return {duplicate:false,receivedAt:rows[0]?.received_at||new Date().toISOString()};
}
