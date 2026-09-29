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
    order:"received_at.asc",
    limit:"3000",
  });
  const feedbackParams=new URLSearchParams({
    select:"type,source,payload",
    source:"eq.style-director",
    type:"eq.designer_feedback",
    order:"received_at.asc",
    limit:"3000",
  });

  try {
    const [operatorResponse,feedbackResponse]=await Promise.all([
      fetch(`${cloud.url}/rest/v1/style_events?${operatorParams.toString()}`,{
        headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
        cache:"no-store",
      }),
      fetch(`${cloud.url}/rest/v1/style_events?${feedbackParams.toString()}`,{
        headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
        cache:"no-store",
      }),
    ]);

    if(!operatorResponse.ok || !feedbackResponse.ok) {
      const failed=!operatorResponse.ok?operatorResponse:feedbackResponse;
      console.error("[designer/creative-context]",failed.status,(await failed.text()).slice(0,300));
      return {
        learning:aggregateCreativeLearning([]),
        research:aggregateCreativeResearch([]),
      };
    }

    const operatorRows=await operatorResponse.json() as CreativeContextRow[];
    const feedbackRows=await feedbackResponse.json() as CreativeContextRow[];
    const events=[...operatorRows,...feedbackRows].map((row)=>({
      type:row.type,
      source:row.source,
      payload:row.payload || {},
    }));

    return {
      learning:aggregateCreativeLearning(events),
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
