import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidenceSprint } from "../src/lib/designer/evidence-sprint.ts";
import { ROADMAP_BACKEND_CAPABILITIES } from "../src/lib/designer/roadmap-backend-health.ts";

function backend(){
  return {summary:{capabilities:Object.fromEntries(ROADMAP_BACKEND_CAPABILITIES.map((key)=>[key,true]))}};
}

function runtime(){
  return {summary:{
    checks:{vercel:true},
    environment:"production",
    targetEnvironment:"production",
    projectId:"prj_b3rwwOl5OI0VV3qYyKXPFOloCllT",
    deploymentId:"dpl_4sczwptRDCUDpambPp4UP87yimiH",
    deploymentUrl:"llinenearth-designer-h6xez8ye5-success-aveneu.vercel.app",
    productionUrl:"llinenearth-designer.vercel.app",
    commitSha:"d2a6d80beb3db56c700030d6c259af95523f92c3",
  }};
}

test("evidence sprint puts real physical and customer gates first",()=>{
  const sprint=buildEvidenceSprint({backendHealth:backend(),productionRuntime:runtime()});
  assert.deepEqual(sprint.next.map((item)=>item.phase),[1,2,4]);
  assert.equal(sprint.items.find((item)=>item.phase===3)?.availability,"parallel");
  assert.equal(sprint.items.find((item)=>item.phase===8)?.availability,"later");
  assert.equal(sprint.items.find((item)=>item.phase===11)?.availability,"later");
});

test("Phase 3 becomes a current sprint item once Phase 1 is actually complete",()=>{
  const sprint=buildEvidenceSprint({
    phase1Proof:{latest:{coreAccepted:true}},
    deviceQa:{latest:{mobile:{status:"accepted"}}},
    backendHealth:backend(),
    productionRuntime:runtime(),
  });
  assert.equal(sprint.items.find((item)=>item.phase===1)?.complete,true);
  assert.equal(sprint.items.find((item)=>item.phase===3)?.availability,"now");
});

test("production outcomes stay later until real Production Bridge evidence completes",()=>{
  const sprint=buildEvidenceSprint({
    backendHealth:backend(),
    productionRuntime:runtime(),
  });
  assert.equal(sprint.items.find((item)=>item.phase===11)?.availability,"later");
  assert.match(sprint.items.find((item)=>item.phase===11)?.proof||"",/delivered-order outcomes/i);
});
