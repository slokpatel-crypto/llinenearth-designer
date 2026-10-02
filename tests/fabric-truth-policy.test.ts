import assert from "node:assert/strict";
import test from "node:test";
import { evaluateFabricTruthPolicy, normalizeFabricTruthPolicy } from "../src/lib/designer/fabric-truth-policy.ts";

test("Fabric Truth policy requires a named human decision and explicit thresholds",()=>{
  assert.throws(()=>normalizeFabricTruthPolicy({
    status:"approved",physicalScalePercent:100,gsmPercent:80,drapePercent:80,fiberPercent:90,signedBy:"",note:"Owner policy",
  }),/Named owner/);
  assert.throws(()=>normalizeFabricTruthPolicy({
    status:"approved",physicalScalePercent:101,gsmPercent:80,drapePercent:80,fiberPercent:90,signedBy:"SP",note:"Owner policy",
  }),/between 1% and 100%/);
});

test("Fabric Truth policy converts percentages to current active-fabric counts",()=>{
  const policy=normalizeFabricTruthPolicy({
    status:"approved",physicalScalePercent:100,gsmPercent:80,drapePercent:75,fiberPercent:90,
    signedBy:"Owner",note:"Use supplier documents and physical roll checks.",
  });
  const summary=evaluateFabricTruthPolicy(policy,{
    activeCandidates:20,physicalScale:20,gsm:16,drape:15,fiber:18,
  });
  assert.equal(summary.detail.gsm.requiredCount,16);
  assert.equal(summary.detail.drape.requiredCount,15);
  assert.equal(summary.detail.fiber.requiredCount,18);
  assert.equal(summary.gateComplete,true);
});

test("review status cannot complete Phase 2 physical evidence even when counts pass",()=>{
  const policy=normalizeFabricTruthPolicy({
    status:"review",physicalScalePercent:50,gsmPercent:50,drapePercent:50,fiberPercent:50,
    signedBy:"Owner",note:"Thresholds are still being reviewed.",
  });
  const summary=evaluateFabricTruthPolicy(policy,{
    activeCandidates:10,physicalScale:10,gsm:10,drape:10,fiber:10,
  });
  assert.equal(summary.approved,false);
  assert.equal(summary.gateComplete,false);
});

test("missing active catalogue evidence never passes",()=>{
  const policy=normalizeFabricTruthPolicy({
    status:"approved",physicalScalePercent:50,gsmPercent:50,drapePercent:50,fiberPercent:50,
    signedBy:"Owner",note:"Approved physical evidence policy.",
  });
  assert.equal(evaluateFabricTruthPolicy(policy,{activeCandidates:0}).gateComplete,false);
});
