/** Archived external knowledge. NEVER import these directly into customer-facing rule evaluation. */
import fabric from "../../../../data/anthropic-unverified/2026-10-13/fabric.json" with { type:"json" };
import shirt from "../../../../data/anthropic-unverified/2026-10-13/shirt.json" with { type:"json" };
import trouser from "../../../../data/anthropic-unverified/2026-10-13/trouser.json" with { type:"json" };
import crossGarment from "../../../../data/anthropic-unverified/2026-10-13/cross-garment.json" with { type:"json" };
import styleRecipe from "../../../../data/anthropic-unverified/2026-10-13/style-recipe.json" with { type:"json" };
import quality from "../../../../data/anthropic-unverified/2026-10-13/quality.json" with { type:"json" };

export const ARCHIVED_KNOWLEDGE_DATE="2026-10-13";
export const ARCHIVED_KNOWLEDGE=[fabric,shirt,trouser,crossGarment,styleRecipe,quality] as const;

export function archivedKnowledgeIndex(){
  return ARCHIVED_KNOWLEDGE.map(item=>({
    domain:item.domain,sourceModel:item.model,proposalCount:item.proposals.length,
    reviewStatus:"unverified" as const,automaticallyApplicable:false,
    supplierMeasurementsVerified:false,tailorApproved:false
  }));
}
export function archivedKnowledgeForOperator(){
  return ARCHIVED_KNOWLEDGE.map(item=>({
    domain:item.domain,source:item.model,status:"unverified" as const,
    proposals:item.proposals.map(proposal=>({
      ...proposal,reviewStatus:"pending_human_review" as const,provenance:"unverified-external-proposal" as const
    }))
  }));
}
