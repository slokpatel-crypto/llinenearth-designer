/** AI-audited drafts, still requiring owner/tailor approval. No customer-facing auto activation. */
import fabric from "../../../../data/anthropic-audited/2026-10-13/fabric.json" with { type:"json" };
import shirt from "../../../../data/anthropic-audited/2026-10-13/shirt.json" with { type:"json" };
import trouser from "../../../../data/anthropic-audited/2026-10-13/trouser.json" with { type:"json" };
import crossGarment from "../../../../data/anthropic-audited/2026-10-13/cross-garment.json" with { type:"json" };
import styleRecipe from "../../../../data/anthropic-audited/2026-10-13/style-recipe.json" with { type:"json" };
import quality from "../../../../data/anthropic-audited/2026-10-13/quality.json" with { type:"json" };
export const AI_AUDITED_KNOWLEDGE=[fabric,shirt,trouser,crossGarment,styleRecipe,quality] as const;
export function auditedKnowledgeIndex(){
  return AI_AUDITED_KNOWLEDGE.map(entry=>({
    domain:entry.domain,proposalCount:entry.proposals.length,model:entry.model,
    status:"ai_audited_requires_human_review" as const,
    canAutomaticallyAffectLiveDesign:false,physicalSupplierFactsCertified:false
  }));
}
export function auditedKnowledgeForOperator(){
  return AI_AUDITED_KNOWLEDGE.map(entry=>({
    domain:entry.domain,model:entry.model,reviewNotes:entry.reviewNotes,
    proposals:entry.proposals.map(p=>({
      ...p,provenance:"ai-reviewed-unverified" as const,reviewStatus:"pending_human_review" as const
    }))
  }));
}
