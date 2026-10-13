import test from "node:test";
import assert from "node:assert/strict";
import {auditedKnowledgeIndex,auditedKnowledgeForOperator} from "../src/lib/designer/intelligence/audited-archive.ts";
import {KNOWLEDGE_DOMAINS,intakeKnowledgeProposals} from "../src/lib/designer/intelligence/proposal-contract.ts";
import manifest from "../data/anthropic-audited/2026-10-13/manifest.json" with { type:"json" };
test("offline Claude audit archive is present and never self-approves",()=>{
 const index=auditedKnowledgeIndex();
 assert.deepEqual(index.map(x=>x.domain),[...KNOWLEDGE_DOMAINS]);
 assert.equal(index.reduce((total,x)=>total+x.proposalCount,0),44);
 assert.equal(manifest.auditedProposals,44);
 assert.equal(manifest.humanApproved,false);
 assert.equal(manifest.automaticallyApplicable,false);
 assert.ok(index.every(x=>!x.canAutomaticallyAffectLiveDesign&&!x.physicalSupplierFactsCertified));
});
test("AI-audited style and fabric recommendations are constrained and review-gated",()=>{
 for(const domain of auditedKnowledgeForOperator()){
  assert.ok(domain.proposals.length>0);
  assert.equal(domain.proposals.length,new Set(domain.proposals.map(p=>p.id)).size);
  for(const proposal of domain.proposals){
   assert.equal(proposal.domain,domain.domain);
   assert.equal(proposal.reviewStatus,"pending_human_review");
   assert.equal(proposal.provenance,"ai-reviewed-unverified");
   assert.ok(proposal.claim&&proposal.rationale);
   assert.ok(Array.isArray(proposal.constraints)&&Array.isArray(proposal.evidenceNeeded));
  }
  const parsed=intakeKnowledgeProposals({proposals:domain.proposals});
  assert.equal(parsed.proposals.length,domain.proposals.length);
  assert.equal(parsed.rejected.length,0);
 }
});
