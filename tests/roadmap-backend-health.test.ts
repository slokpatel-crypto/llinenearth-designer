import assert from "node:assert/strict";
import test from "node:test";
import { ROADMAP_BACKEND_CAPABILITIES, summarizeRoadmapBackendHealth } from "../src/lib/designer/roadmap-backend-health.ts";

test("live backend health passes only when every hardened Roadmap capability exists",()=>{
  const all=Object.fromEntries(ROADMAP_BACKEND_CAPABILITIES.map((key)=>[key,true]));
  const summary=summarizeRoadmapBackendHealth(all);
  assert.equal(summary.gateComplete,true);
  assert.equal(summary.readyCount,summary.total);
  assert.deepEqual(summary.missing,[]);
});

test("one missing production RPC keeps backend readiness open",()=>{
  const all=Object.fromEntries(ROADMAP_BACKEND_CAPABILITIES.map((key)=>[key,true]));
  all.productionCutEvidence=false;
  const summary=summarizeRoadmapBackendHealth(all);
  assert.equal(summary.gateComplete,false);
  assert.deepEqual(summary.missing,["productionCutEvidence"]);
});


test("private-schema client access keeps backend readiness open",()=>{
  const all=Object.fromEntries(ROADMAP_BACKEND_CAPABILITIES.map((key)=>[key,true]));
  all.privateSchemaDenyByDefault=false;
  const summary=summarizeRoadmapBackendHealth(all);
  assert.equal(summary.gateComplete,false);
  assert.deepEqual(summary.missing,["privateSchemaDenyByDefault"]);
});
