/**
 * Untrusted fashion-knowledge proposal contract.
 * AI text NEVER becomes an approved rule or a measured fabric fact here.
 * Explicit human review and catalogue evidence are separate workflows.
 */
export const KNOWLEDGE_DOMAINS = ["fabric","shirt","trouser","cross-garment","style-recipe","quality"] as const;
export type KnowledgeDomain = typeof KNOWLEDGE_DOMAINS[number];
export type KnowledgeProposal = {
  id: string;
  domain: KnowledgeDomain;
  claim: string;
  rationale: string;
  constraints: string[];
  evidenceNeeded: string[];
  provenance: "unverified-external-proposal";
  reviewStatus: "pending_human_review";
};
export type RejectedKnowledge = { index: number; id: string | null; reason: string };
export type KnowledgeIntake = {
  version: "linen-earth-knowledge-intake-v1";
  proposals: KnowledgeProposal[];
  rejected: RejectedKnowledge[];
  sourceStatus: "unverified";
};

function object(value: unknown): Record<string,unknown> | null {
  return value!==null && typeof value==="object" && !Array.isArray(value)
    ? value as Record<string,unknown> : null;
}
function cleanText(value: unknown, limit: number): string {
  if(typeof value!=="string") return "";
  return value.replace(/<[^>]*>/g,"").replace(/[\u0000-\u001f\u007f]/g," ")
    .replace(/\s+/g," ").trim().slice(0,limit);
}
function cleanList(value: unknown): string[] | null {
  if(!Array.isArray(value) || value.length>16) return null;
  const cleaned = value.map(item=>cleanText(item,220));
  return cleaned.every(Boolean) ? cleaned : null;
}

/** Process at most 150 suggestions, enforcing stable, non-executable content. */
export function intakeKnowledgeProposals(input: unknown): KnowledgeIntake {
  const root = object(input);
  if(!root || !Array.isArray(root.proposals) || root.proposals.length>150) {
    throw new Error("A proposals array with at most 150 entries is required");
  }
  const proposals: KnowledgeProposal[] = [];
  const rejected: RejectedKnowledge[] = [];
  const seen = new Set<string>();
  for(let index=0; index<root.proposals.length; index++) {
    const row=object(root.proposals[index]);
    const id=cleanText(row?.id,90);
    const reject=(reason:string)=>rejected.push({index,id:id||null,reason});
    if(!row || !/^[a-z][a-z0-9-]{2,89}$/.test(id) || seen.has(id)) { reject("invalid_or_duplicate_id"); continue; }
    seen.add(id);
    if(!KNOWLEDGE_DOMAINS.includes(row.domain as KnowledgeDomain)) { reject("unknown_domain"); continue; }
    // Fabric numbers, product stock, and approval cannot be imported from an LLM.
    const forbidden=["approved","verified","physicalMeasurements","inventory","skuAvailability","patternRepeatMm","weightGsm","fiberComposition"];
    if(forbidden.some(key=>Object.prototype.hasOwnProperty.call(row,key))) { reject("reserved_physical_or_approval_field"); continue; }
    const claim=cleanText(row.claim,420),rationale=cleanText(row.rationale,700);
    const constraints=cleanList(row.constraints),evidenceNeeded=cleanList(row.evidenceNeeded);
    if(!claim || !rationale || !constraints || !evidenceNeeded) { reject("invalid_text_or_lists"); continue; }
    proposals.push({
      id,domain:row.domain as KnowledgeDomain,claim,rationale,constraints,evidenceNeeded,
      provenance:"unverified-external-proposal",reviewStatus:"pending_human_review"
    });
  }
  return {version:"linen-earth-knowledge-intake-v1",proposals,rejected,sourceStatus:"unverified"};
}
