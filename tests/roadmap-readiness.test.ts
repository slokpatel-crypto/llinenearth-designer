import assert from "node:assert/strict";
import test from "node:test";
import { summarizeRoadmapReadiness } from "../src/lib/designer/roadmap-readiness.ts";
import { ROADMAP_BACKEND_CAPABILITIES } from "../src/lib/designer/roadmap-backend-health.ts";


function healthyBackend(){
  return {summary:{capabilities:Object.fromEntries(ROADMAP_BACKEND_CAPABILITIES.map((key)=>[key,true]))}};
}

function healthyProductionRuntime(){
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

function launchEvidence(){
  const betaAttempts=Array.from({length:5},(_,index)=>({
    case_id:`BETA-${index+1}`,
    device_class:index===0?"mobile":index===1?"tablet":"desktop",
    core_flow_completed:true,
    design_locked:true,
    share_or_enquiry_completed:true,
    blocking_bug:false,
    revision_id:`REV-${index+1}`,
    share_audit_confirmed:true,
    created_at:`2026-10-0${index+1}T10:00:00Z`,
  }));
  const checklistEvents=[
    "privacy_notice","terms_refunds","measurement_handling","third_party_processing","operator_access","incident_contact",
  ].map((item_id,index)=>({item_id,status:"approved",created_at:`2026-10-01T10:0${index}:00Z`}));
  return {betaAttempts,checklistEvents};
}

test("roadmap control tower keeps human and physical evidence separate from engineering",()=>{
  const summary=summarizeRoadmapReadiness({
    phase1Proof:{latest:{coreAccepted:true}},
    deviceQa:{latest:{mobile:{status:"accepted"},tablet:{status:"accepted"},desktop:{status:"accepted"}}},
    fabricAnalyzer:{groundTruth:{reviewedFabrics:50,target:50}},
    fabricColor:{summary:{uniqueFabrics:10,target:10,evidenceGateComplete:true}},
    previewCoverage:{summary:{gateComplete:true}},
    noviceStudy:{summary:{gateComplete:true}},
    measurementCalibration:{summary:{complete:true}},
    easeCalibration:{summary:{evidenceCoverageComplete:true},models:[{status:"approved"}]},
    launchReadiness:launchEvidence(),
    styleDirector:{summary:{validationComplete:true,positiveCases:5,requiredPositiveCases:5}},
    renderQa:{
      summary:{reviewed:20,approvalRate:80},
      identitySummary:{eligibleConcepts:1,reviewedConcepts:1,pendingConcepts:0,passedConcepts:1,failedConcepts:0},
      creditCapSummary:{configured:true,withinCap:true},
      patternCoverageSummary:{requiredPairs:1,passedPairs:1,failedPairs:0,pendingPairs:0,gateComplete:true},
      manualReviewSignoff:{status:"approved"},
    },
    productionEvidence:{
      orders:Array.from({length:10},(_,index)=>({order_id:`order-${index}`,status:"delivered",created_at:`2026-09-${String(index+1).padStart(2,"0")}T10:00:00Z`})),
      evidence:Array.from({length:10},(_,index)=>({order_id:`order-${index}`,manual_design_reentry:false,operator:"RK",evidence_reference:`CUT-${index}`,created_at:"2026-10-01T10:00:00Z"})),
    },
    meterageModel:{models:[{garment:"shirt",status:"approved"},{garment:"trouser",status:"approved"}]},
    customerOutcomes:{summary:{gateComplete:true,learningEligible:10,threshold:10}},
    backendHealth:healthyBackend(),
    productionRuntime:healthyProductionRuntime(),
  });

  const byPhase=new Map(summary.phases.map((item)=>[item.phase,item]));
  assert.equal(byPhase.get(1)?.evidenceComplete,true);
  assert.equal(byPhase.get(3)?.evidenceComplete,true);
  assert.equal(byPhase.get(4)?.evidenceComplete,true);
  assert.equal(byPhase.get(5)?.evidenceComplete,true);
  assert.equal(byPhase.get(6)?.evidenceComplete,true);
  assert.equal(byPhase.get(7)?.evidenceComplete,true);
  assert.equal(byPhase.get(8)?.evidenceComplete,true);
  assert.equal(byPhase.get(9)?.evidenceComplete,true);
  assert.equal(byPhase.get(11)?.evidenceComplete,true);
  assert.equal(byPhase.get(2)?.evidenceComplete,false);
  assert.match(byPhase.get(2)?.blocker||"",/threshold|policy/i);
  assert.equal(byPhase.get(10)?.status,"later");
  assert.equal(summary.allEngineeringComplete,true);
  assert.equal(summary.allEvidenceComplete,false);
});

test("Phase 3 cannot pass before the Phase 1 proof and target-mobile gate",()=>{
  const summary=summarizeRoadmapReadiness({
    phase1Proof:{latest:{coreAccepted:false}},
    deviceQa:{latest:{mobile:{status:"review"}}},
    previewCoverage:{summary:{gateComplete:true}},
    noviceStudy:{summary:{gateComplete:true}},
  });
  const phase3=summary.phases.find((item)=>item.phase===3);
  assert.equal(phase3?.evidenceComplete,false);
  assert.equal(phase3?.progressPercent,67);
});

test("Phase 8 requires both approved meterage garments and ten provenance-backed zero-reentry deliveries",()=>{
  const orders=Array.from({length:10},(_,index)=>({order_id:`order-${index}`,status:"delivered",created_at:`2026-09-${String(index+1).padStart(2,"0")}T10:00:00Z`}));
  const evidence=Array.from({length:10},(_,index)=>({order_id:`order-${index}`,manual_design_reentry:false,operator:"RK",evidence_reference:`CUT-${index}`,created_at:"2026-10-01T10:00:00Z"}));
  const summary=summarizeRoadmapReadiness({
    productionEvidence:{orders,evidence},
    meterageModel:{models:[{garment:"shirt",status:"approved"}]},
  });
  assert.equal(summary.phases.find((item)=>item.phase===8)?.evidenceComplete,false);
});


test("Phase 2 completes only after an approved human policy and all Fabric Truth evidence gates pass",()=>{
  const summary=summarizeRoadmapReadiness({
    fabricAnalyzer:{groundTruth:{reviewedFabrics:50,target:50}},
    fabricColor:{summary:{uniqueFabrics:10,target:10,evidenceGateComplete:true}},
    designerData:{coverage:{activeCandidates:20,physicalScale:20,gsm:16,drape:15,fiber:18}},
    fabricTruthPolicy:{policy:{
      version:"fabric-truth-policy-v1",
      status:"approved",
      physicalScalePercent:100,
      gsmPercent:80,
      drapePercent:75,
      fiberPercent:90,
      signedBy:"Owner",
      note:"Approved supplier and physical roll evidence coverage policy.",
    }},
  });
  const phase2=summary.phases.find((item)=>item.phase===2);
  assert.equal(phase2?.evidenceComplete,true);
  assert.equal(phase2?.progressPercent,100);
});

test("Phase 2 remains open when the same thresholds are only in review",()=>{
  const summary=summarizeRoadmapReadiness({
    fabricAnalyzer:{groundTruth:{reviewedFabrics:50,target:50}},
    fabricColor:{summary:{uniqueFabrics:10,target:10,evidenceGateComplete:true}},
    designerData:{coverage:{activeCandidates:20,physicalScale:20,gsm:20,drape:20,fiber:20}},
    fabricTruthPolicy:{policy:{
      version:"fabric-truth-policy-v1",
      status:"review",
      physicalScalePercent:50,
      gsmPercent:50,
      drapePercent:50,
      fiberPercent:50,
      signedBy:"Owner",
      note:"Thresholds still need final owner approval.",
    }},
  });
  assert.equal(summary.phases.find((item)=>item.phase===2)?.evidenceComplete,false);
});


test("Phase 9 cannot pass when the live production backend contract is incomplete",()=>{
  const capabilities=Object.fromEntries(ROADMAP_BACKEND_CAPABILITIES.map((key)=>[key,true])) as Record<string,boolean>;
  capabilities.productionCutEvidence=false;
  const summary=summarizeRoadmapReadiness({
    deviceQa:{latest:{mobile:{status:"accepted"},tablet:{status:"accepted"},desktop:{status:"accepted"}}},
    launchReadiness:launchEvidence(),
    backendHealth:{summary:{capabilities}},
    productionRuntime:healthyProductionRuntime(),
  });
  const phase9=summary.phases.find((item)=>item.phase===9);
  assert.equal(phase9?.evidenceComplete,false);
  assert.match(phase9?.blocker||"",/production supabase backend contract/i);
  assert.equal(summary.backendHealthy,false);
  assert.deepEqual(summary.backendMissing,["productionCutEvidence"]);
});


test("Phase 9 cannot pass on a preview or duplicate Vercel runtime",()=>{
  const summary=summarizeRoadmapReadiness({
    deviceQa:{latest:{mobile:{status:"accepted"},tablet:{status:"accepted"},desktop:{status:"accepted"}}},
    launchReadiness:launchEvidence(),
    backendHealth:healthyBackend(),
    productionRuntime:{summary:{
      checks:{vercel:true},
      environment:"preview",
      targetEnvironment:"preview",
      projectId:"prj_duplicate",
      deploymentId:"dpl_preview",
      deploymentUrl:"preview.vercel.app",
      productionUrl:"llinenearth-designer.vercel.app",
      commitSha:"d2a6d80beb3db56c700030d6c259af95523f92c3",
    }},
  });
  const phase9=summary.phases.find((item)=>item.phase===9);
  assert.equal(phase9?.evidenceComplete,false);
  assert.match(phase9?.blocker||"",/primary vercel production runtime/i);
  assert.equal(summary.productionRuntimeHealthy,false);
});
