import "server-only";

import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import {
  FABRIC_GROUND_TRUTH_FIELDS,
  FABRIC_GROUND_TRUTH_VERSION,
  type FabricGroundTruthLabel,
  type FabricGroundTruthState,
} from "@/lib/fabric-ground-truth-scorecard";

type Row={at:string;payload?:Record<string,unknown>};

function clean(value:unknown,limit=180){
  return String(value??"").trim().slice(0,limit);
}

function state(value:unknown):FabricGroundTruthState|null{
  if(!value || typeof value!=="object" || Array.isArray(value)) return null;
  const raw=value as Record<string,unknown>;
  const out={} as FabricGroundTruthState;
  for(const field of FABRIC_GROUND_TRUTH_FIELDS) out[field]=clean(raw[field],80);
  return out;
}

export async function loadFabricGroundTruthLabels(){
  const cloud=getSupabaseAdminConfig();
  if(!cloud) return {configured:false,labels:new Map<string,FabricGroundTruthLabel>()};

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
    if(!response.ok) return {configured:true,labels:new Map<string,FabricGroundTruthLabel>()};
    const rows=await response.json() as Row[];
    const labels=new Map<string,FabricGroundTruthLabel>();
    for(const row of rows){
      const payload=row.payload||{};
      if(clean(payload.subtype,80)!=="fabric_ground_truth_label") continue;
      if(clean(payload.version,80)!==FABRIC_GROUND_TRUTH_VERSION) continue;
      const fabricId=clean(payload.fabricId,160);
      const profileId=clean(payload.profileId,160);
      const original=state(payload.original);
      const final=state(payload.final);
      if(!fabricId || !profileId || !original || !final || labels.has(fabricId)) continue;
      labels.set(fabricId,{
        fabricId,
        profileId,
        analyzerVersion:clean(payload.analyzerVersion,80),
        original,
        final,
        note:clean(payload.note,600),
        at:row.at,
      });
    }
    return {configured:true,labels};
  }catch{
    return {configured:true,labels:new Map<string,FabricGroundTruthLabel>()};
  }
}
