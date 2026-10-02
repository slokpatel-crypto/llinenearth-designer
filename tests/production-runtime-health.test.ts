import assert from "node:assert/strict";
import test from "node:test";
import { PRIMARY_VERCEL_PROJECT_ID, summarizeProductionRuntimeHealth } from "../src/lib/designer/production-runtime-health.ts";

const good={
  vercel:"1",
  environment:"production",
  targetEnvironment:"production",
  projectId:PRIMARY_VERCEL_PROJECT_ID,
  deploymentId:"dpl_4sczwptRDCUDpambPp4UP87yimiH",
  deploymentUrl:"llinenearth-designer-h6xez8ye5-success-aveneu.vercel.app",
  productionUrl:"llinenearth-designer.vercel.app",
  commitSha:"d2a6d80beb3db56c700030d6c259af95523f92c3",
};

test("production runtime health accepts only a traceable primary production deployment",()=>{
  const summary=summarizeProductionRuntimeHealth(good);
  assert.equal(summary.gateComplete,true);
  assert.deepEqual(summary.missing,[]);
});

test("preview environments cannot satisfy the production runtime gate",()=>{
  const summary=summarizeProductionRuntimeHealth({...good,environment:"preview",targetEnvironment:"preview"});
  assert.equal(summary.gateComplete,false);
  assert(summary.missing.includes("productionEnvironment"));
});

test("duplicate linked Vercel projects cannot satisfy the production runtime gate",()=>{
  const summary=summarizeProductionRuntimeHealth({...good,projectId:"prj_duplicate"});
  assert.equal(summary.gateComplete,false);
  assert.deepEqual(summary.missing,["primaryProject"]);
});

test("production runtime health requires immutable deployment and Git identities",()=>{
  const summary=summarizeProductionRuntimeHealth({...good,deploymentId:"",commitSha:"not-a-sha"});
  assert.equal(summary.gateComplete,false);
  assert(summary.missing.includes("deploymentIdentity"));
  assert(summary.missing.includes("gitCommit"));
});
