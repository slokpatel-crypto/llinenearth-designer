import assert from "node:assert/strict";
import test from "node:test";
import { intakeKnowledgeProposals, KNOWLEDGE_DOMAINS } from "../src/lib/designer/intelligence/proposal-contract.ts";

const valid = {
  id:"shirt-open-cuff",
  domain:"shirt",
  claim:"Short sleeves need a suitable open hem rather than a wrist cuff.",
  rationale:"The constructions terminate at different points on the arm.",
  constraints:["Short sleeve only"],
  evidenceNeeded:["Confirm selected sleeve in exact garment specification"]
};

test("all intended knowledge domains are recognized",()=>{
  assert.deepEqual([...KNOWLEDGE_DOMAINS],["fabric","shirt","trouser","cross-garment","style-recipe","quality"]);
});
test("valid proposals remain quarantined even if root advertises approval",()=>{
  const result=intakeKnowledgeProposals({approved:true,proposals:[valid]});
  assert.equal(result.proposals.length,1);
  assert.equal(result.proposals[0].reviewStatus,"pending_human_review");
  assert.equal(result.proposals[0].provenance,"unverified-external-proposal");
  assert.equal(result.sourceStatus,"unverified");
});
test("claimed physical fabric measurements or stock cannot be imported",()=>{
  const result=intakeKnowledgeProposals({proposals:[
    {...valid,id:"fabric-gsm",domain:"fabric",weightGsm:140},
    {...valid,id:"fabric-repeat",domain:"fabric",patternRepeatMm:3},
    {...valid,id:"fabric-approved",approved:true},
    {...valid,id:"fabric-available",inventory:100}
  ]});
  assert.equal(result.proposals.length,0);
  assert.deepEqual(result.rejected.map(x=>x.reason),new Array(4).fill("reserved_physical_or_approval_field"));
});
test("reject malformed, duplicate, oversized and unknown rows",()=>{
  const result=intakeKnowledgeProposals({proposals:[
    valid,
    valid,
    {...valid,id:"not-known-category",domain:"something-else"},
    {...valid,id:"invalid-lists",constraints:["a",42]},
    {...valid,id:"bad-html",claim:"<b>Normal</b> text"}
  ]});
  assert.equal(result.proposals.length,2);
  assert.equal(result.proposals[1].claim,"Normal text");
  assert.deepEqual(result.rejected.map(x=>x.reason),[
    "invalid_or_duplicate_id","unknown_domain","invalid_text_or_lists"
  ]);
  assert.throws(()=>intakeKnowledgeProposals({proposals:new Array(151).fill(valid)}));
  assert.throws(()=>intakeKnowledgeProposals({proposals:"not-an-array"}));
});
