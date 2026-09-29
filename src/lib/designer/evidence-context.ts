import "server-only";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { aggregateDesignerCasebook, type DesignerCasebook } from "@/lib/designer/casebook";
import { aggregateFitOutcomes, type FitOutcomeBook } from "@/lib/designer/fit-outcomes";

type EvidenceRow = {
  type:string;
  source:string;
  payload:Record<string,unknown>;
};

export type DesignerEvidenceContext = {
  casebook:DesignerCasebook;
  fitOutcomes:FitOutcomeBook;
};

export async function loadDesignerEvidenceContext():Promise<DesignerEvidenceContext> {
  const cloud=getSupabaseAdminConfig();
  if(!cloud) {
    return {
      casebook:aggregateDesignerCasebook([]),
      fitOutcomes:aggregateFitOutcomes([]),
    };
  }

  const params=new URLSearchParams({
    select:"type,source,payload",
    source:"eq.operator",
    type:"eq.operator_note",
    order:"received_at.asc",
    limit:"3000",
  });

  try {
    const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
      cache:"no-store",
    });
    if(!response.ok) {
      console.error("[designer/evidence-context]",response.status,(await response.text()).slice(0,300));
      return {
        casebook:aggregateDesignerCasebook([]),
        fitOutcomes:aggregateFitOutcomes([]),
      };
    }
    const rows=await response.json() as EvidenceRow[];
    const events=rows.map((row)=>({type:row.type,source:row.source,payload:row.payload || {}}));
    return {
      casebook:aggregateDesignerCasebook(events),
      fitOutcomes:aggregateFitOutcomes(events),
    };
  } catch(error) {
    console.error("[designer/evidence-context]",error);
    return {
      casebook:aggregateDesignerCasebook([]),
      fitOutcomes:aggregateFitOutcomes([]),
    };
  }
}
