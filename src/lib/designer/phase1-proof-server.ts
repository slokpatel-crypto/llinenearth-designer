import "server-only";

import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { evaluateRecordedPhase1ProofEvidence } from "@/lib/designer/proof-scale";

export type LatestPhase1ProofRecord={
  at:string;
  payload:Record<string,unknown>;
  evidence:ReturnType<typeof evaluateRecordedPhase1ProofEvidence>;
};

type StyleEventRow={at:string;payload?:Record<string,unknown>};

export async function loadLatestPhase1ProofRecord():Promise<LatestPhase1ProofRecord|null>{
  const cloud=getSupabaseAdminConfig();
  if(!cloud) return null;

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
    if(!response.ok) return null;
    const rows=await response.json() as StyleEventRow[];
    for(const row of rows){
      const payload=row.payload||{};
      if(String(payload.subtype||"")!=="roadmap_phase1_proof") continue;
      return {
        at:row.at,
        payload,
        evidence:evaluateRecordedPhase1ProofEvidence(payload),
      };
    }
    return null;
  }catch{
    return null;
  }
}
