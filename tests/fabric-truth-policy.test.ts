import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
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

test("fabric truth policy cannot be approved using coerced thresholds or reviewer text",()=>{
  const valid={
    status:"approved",physicalScalePercent:100,gsmPercent:80,drapePercent:75,fiberPercent:90,
    signedBy:"Owner",note:"Supplier and owner verified the physical facts.",
  };
  for(const malformed of [true,"100",[100],null,{}]){
    assert.throws(()=>normalizeFabricTruthPolicy({...valid,physicalScalePercent:malformed}),/between 1% and 100%/);
  }
  for(const signedBy of [["Owner"],{toString:()=>"Owner"},true]){
    assert.throws(()=>normalizeFabricTruthPolicy({...valid,signedBy}),/Named owner/);
  }
  for(const note of [["Supplier physical evidence"],{toString:()=>"Supplier physical evidence"}]){
    assert.throws(()=>normalizeFabricTruthPolicy({...valid,note}),/rationale/);
  }
  assert.throws(()=>normalizeFabricTruthPolicy({...valid,status:["approved"]}),/status must/);
});

test("contradictory and coerced fabric coverage counts fail closed",()=>{
  const policy=normalizeFabricTruthPolicy({
    status:"approved",physicalScalePercent:100,gsmPercent:80,drapePercent:75,fiberPercent:90,
    signedBy:"Owner",note:"Supplier and owner verified the physical facts.",
  });
  const valid={activeCandidates:20,physicalScale:20,gsm:16,drape:15,fiber:18};
  assert.equal(evaluateFabricTruthPolicy(policy,valid).gateComplete,true);
  for(const field of ["physicalScale","gsm","drape","fiber"] as const){
    const over={...valid,[field]:21};
    const result=evaluateFabricTruthPolicy(policy,over);
    assert.equal(result.gateComplete,false);
    assert.equal(result.detail[field].pass,false);
  }
  for(const activeCandidates of ["20",true,20.5,Number.POSITIVE_INFINITY]){
    assert.equal(evaluateFabricTruthPolicy(policy,{...valid,activeCandidates:activeCandidates as number}).gateComplete,false);
  }
  for(const bad of ["20",true,20.5,Number.POSITIVE_INFINITY]){
    assert.equal(evaluateFabricTruthPolicy(policy,{...valid,physicalScale:bad as number}).gateComplete,false);
  }
});

test("fabric truth approval never silently truncates signer or rationale",()=>{
  const valid={status:"approved",physicalScalePercent:100,gsmPercent:80,drapePercent:75,fiberPercent:90,
    signedBy:"Owner",note:"Supplier and owner reviewed physical roll evidence."};
  assert.equal(normalizeFabricTruthPolicy(valid).status,"approved");
  assert.throws(()=>normalizeFabricTruthPolicy({...valid,signedBy:"x".repeat(121)}),/too long/i);
  assert.throws(()=>normalizeFabricTruthPolicy({...valid,note:"x".repeat(1201)}),/too long/i);
  assert.throws(()=>normalizeFabricTruthPolicy({...valid,status:["approved"]}),/status must/i);
});

test("fabric truth operator POST requires bounded JSON and matching persisted ledger event",()=>{
  const source=readFileSync("src/app/api/operator/fabric-truth-policy/route.ts","utf8");
  assert.match(source,/secureJsonRequestError\(request,16384\)/);
  assert.match(source,/readSecureJsonObject\(request,16384\)/);
  assert.match(source,/return=representation/);
  assert.match(source,/saved\.id!==event\.id/);
  assert.doesNotMatch(source,/request\.json\(\)/);
  assert.doesNotMatch(source,/return=minimal/);
});
