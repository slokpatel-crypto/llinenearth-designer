import "server-only";

import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { FABRIC_STOCK } from "@/lib/fabric-stock";
import { loadFabricAnalyzerGroundTruthHistory } from "@/lib/fabric-analyzer-store";
import {
  FABRIC_GROUND_TRUTH_VERSION,
  isStockBoundFabricGroundTruthId,
  normalizeExplicitFabricGroundTruthState,
  fabricGroundTruthStateFromProfile,
  reconstructOriginalFabricGroundTruthState,
  type FabricGroundTruthLabel,
} from "@/lib/fabric-ground-truth-scorecard";

type Row={at:string;payload?:Record<string,unknown>};

function clean(value:unknown,limit=180){
  // An identifier or signed receipt supplied through JSON must be literal and
  // bounded before normalization; arrays/objects are not owner-labelled facts.
  return typeof value==="string" && value.length<=limit ? value.trim() : "";
}

export async function loadFabricGroundTruthLabels(){
  const cloud=getSupabaseAdminConfig();
  if(!cloud) return {configured:false,labels:new Map<string,FabricGroundTruthLabel>(),explicitLabels:0,backfilledLabels:0};

  const labels=new Map<string,FabricGroundTruthLabel>();
  let explicitLabels=0;
  let backfilledLabels=0;
  // Owner-labelled benchmark counts physical stock units, not arbitrary
  // operator-note IDs or historic catalogue rows that are no longer active.
  const eligibleStockIds=new Set(FABRIC_STOCK.filter((fabric)=>fabric.inStock).map((fabric)=>fabric.id));

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
    if(response.ok){
      const rows=await response.json() as Row[];
      for(const row of rows){
        const payload=row.payload||{};
        if(clean(payload.subtype,80)!=="fabric_ground_truth_label") continue;
        if(clean(payload.version,80)!==FABRIC_GROUND_TRUTH_VERSION) continue;
        // Exact stock identity must be checked on the raw JSON literal.
        // Trimming here could silently turn "stock-id " into "stock-id".
        const fabricId=payload.fabricId;
        const profileId=clean(payload.profileId,160);
        const original=normalizeExplicitFabricGroundTruthState(payload.original);
        const final=normalizeExplicitFabricGroundTruthState(payload.final);
        if(!isStockBoundFabricGroundTruthId(fabricId,eligibleStockIds)
          || !profileId || !original || !final || labels.has(fabricId)) continue;
        labels.set(fabricId,{
          fabricId,
          profileId,
          analyzerVersion:clean(payload.analyzerVersion,80),
          original,
          final,
          note:clean(payload.note,600),
          at:row.at,
        });
        explicitLabels+=1;
      }
    }
  }catch{
    // Historical reviewed-profile fallback below can still populate labels.
  }

  try{
    const history=await loadFabricAnalyzerGroundTruthHistory([...eligibleStockIds]);
    for(const row of history){
      if(!isStockBoundFabricGroundTruthId(row.fabric_id,eligibleStockIds)
        || labels.has(row.fabric_id)) continue;
      const final=fabricGroundTruthStateFromProfile(row.profile);
      const original=row.review_status==="corrected"
        ? reconstructOriginalFabricGroundTruthState(final,(row.feedback||[]).map((item)=>({
          fieldPath:item.fieldPath,
          previousValue:item.previousValue,
        })))
        : {...final};
      labels.set(row.fabric_id,{
        fabricId:row.fabric_id,
        profileId:row.profile_id,
        analyzerVersion:row.analyzer_version,
        original,
        final,
        note:row.review_status==="corrected"
          ? "Backfilled from reviewed Analyzer correction history."
          : "Backfilled from an approved Analyzer profile.",
        at:row.reviewed_at,
        // Approved backfills compare a profile to itself; corrected history
        // captures only edited fields and assumes the rest are perfect. Neither
        // is an independent owner-labelled accuracy denominator.
        eligibleForAccuracy:false,
      });
      backfilledLabels+=1;
    }
  }catch{
    // Explicit operator labels remain valid even if historical backfill fails.
  }

  return {configured:true,labels,explicitLabels,backfilledLabels};
}

