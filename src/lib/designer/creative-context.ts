import "server-only";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { aggregateCreativeLearning, type CreativeLearningBook } from "@/lib/designer/creative-learning";
import { aggregateCreativeResearch, type CreativeResearchLibrary } from "@/lib/designer/creative-research";

type CreativeContextRow = {
  type:string;
  source:string;
  payload:Record<string,unknown>;
};

export type DesignerCreativeContext = {
  learning:CreativeLearningBook;
  research:CreativeResearchLibrary;
};

export async function loadDesignerCreativeContext():Promise<DesignerCreativeContext> {
  const cloud=getSupabaseAdminConfig();
  if(!cloud) {
    return {
      learning:aggregateCreativeLearning([]),
      research:aggregateCreativeResearch([]),
    };
  }

  const operatorParams=new URLSearchParams({
    select:"type,source,payload",
    source:"eq.operator",
    type:"eq.operator_note",
    order:"received_at.desc,id.desc",
    limit:"3000",
  });

  try {
    const operatorResponse=await fetch(`${cloud.url}/rest/v1/style_events?${operatorParams.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(8000),
    });
    if(!operatorResponse.ok)throw new Error("Reviewed research is temporarily unavailable.");
    const operatorRows=await operatorResponse.json() as CreativeContextRow[];
    const events=operatorRows.reverse();

    return {
      learning:aggregateCreativeLearning([]),
      research:aggregateCreativeResearch(events),
    };
  } catch(error) {
    console.error("[designer/creative-context]",error);
    return {
      learning:aggregateCreativeLearning([]),
      research:aggregateCreativeResearch([]),
    };
  }
}
