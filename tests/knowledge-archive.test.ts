import test from "node:test";
import assert from "node:assert/strict";
import {ARCHIVED_KNOWLEDGE, archivedKnowledgeForOperator, archivedKnowledgeIndex} from "../src/lib/designer/intelligence/archive.ts";
import {intakeKnowledgeProposals,KNOWLEDGE_DOMAINS} from "../src/lib/designer/intelligence/proposal-contract.ts";

test("all six Claude archives are shipped offline with provenance and no automatic approval",()=>{
  const index=archivedKnowledgeIndex();
  assert.deepEqual(index.map(r=>r.domain),[...KNOWLEDGE_DOMAINS]);
  assert.equal(index.reduce((n,r)=>n+r.proposalCount,0),52);
  assert.ok(index.every(r=>!r.automaticallyApplicable&&!r.supplierMeasurementsVerified&&!r.tailorApproved));
  const archives=archivedKnowledgeForOperator();
  assert.equal(archives.length,6);
  for(const archive of archives){
    const ids=archive.proposals.map(p=>p.id);
    assert.equal(ids.length,new Set(ids).size);
    assert.ok(archive.proposals.every(p=>p.reviewStatus==="pending_human_review"));
    assert.ok(archive.proposals.every(p=>p.provenance==="unverified-external-proposal"));
  }
});

test("archived model suggestions pass only through the quarantined validation contract",()=>{
  for(const archive of ARCHIVED_KNOWLEDGE){
    const result=intakeKnowledgeProposals({proposals:archive.proposals});
    assert.equal(result.proposals.length,archive.proposals.length);
    assert.equal(result.rejected.length,0);
    assert.equal(result.sourceStatus,"unverified");
  }
});
