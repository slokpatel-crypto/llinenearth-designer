import { summarizeLaunchReadiness } from "./launch-readiness-evidence.ts";
import { summarizeProductionDeliveryEvidence } from "./production-delivery-evidence.ts";
import { evaluateFinalRenderReleaseEvidence } from "./render-release-evidence.ts";
import { evaluateFabricTruthPolicy, normalizeFabricTruthPolicy } from "./fabric-truth-policy.ts";
import { summarizeRoadmapBackendHealth } from "./roadmap-backend-health.ts";

export type RoadmapPhaseStatus="complete"|"evidence"|"open"|"later";

export type RoadmapPhaseState={
  id:string;
  phase:number;
  title:string;
  engineeringComplete:boolean;
  evidenceComplete:boolean;
  status:RoadmapPhaseStatus;
  progressPercent:number;
  metric:string;
  blocker:string;
  href:string;
};

export type RoadmapReadinessInput={
  phase1Proof?:Record<string,unknown>;
  deviceQa?:Record<string,unknown>;
  fabricAnalyzer?:Record<string,unknown>;
  fabricColor?:Record<string,unknown>;
  designerData?:Record<string,unknown>;
  fabricTruthPolicy?:Record<string,unknown>;
  previewCoverage?:Record<string,unknown>;
  noviceStudy?:Record<string,unknown>;
  measurementCalibration?:Record<string,unknown>;
  easeCalibration?:Record<string,unknown>;
  launchReadiness?:Record<string,unknown>;
  styleDirector?:Record<string,unknown>;
  renderQa?:Record<string,unknown>;
  productionEvidence?:Record<string,unknown>;
  meterageModel?:Record<string,unknown>;
  customerOutcomes?:Record<string,unknown>;
  backendHealth?:Record<string,unknown>;
};

function object(value:unknown):Record<string,unknown>{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function array(value:unknown):Array<Record<string,unknown>>{
  return Array.isArray(value)?value.filter((item)=>item&&typeof item==="object"&&!Array.isArray(item)) as Array<Record<string,unknown>>:[];
}
function number(value:unknown,fallback=0){
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}
function percent(parts:boolean[]){
  if(!parts.length) return 0;
  return Math.round(parts.filter(Boolean).length/parts.length*100);
}
function ratio(done:number,total:number){
  if(total<=0) return 0;
  return Math.max(0,Math.min(100,Math.round(done/total*100)));
}
function phase(input:Omit<RoadmapPhaseState,"status">&{status?:RoadmapPhaseStatus}):RoadmapPhaseState{
  return {
    ...input,
    status:input.status??(input.evidenceComplete?"complete":input.engineeringComplete?"evidence":"open"),
  };
}

export function summarizeRoadmapReadiness(input:RoadmapReadinessInput){
  const phase1Latest=object(object(input.phase1Proof).latest);
  const deviceLatest=object(object(input.deviceQa).latest);
  const mobileAccepted=object(deviceLatest.mobile).status==="accepted";
  const tabletAccepted=object(deviceLatest.tablet).status==="accepted";
  const desktopAccepted=object(deviceLatest.desktop).status==="accepted";
  const phase1Core=phase1Latest.coreAccepted===true;
  const phase1Complete=phase1Core&&mobileAccepted;

  const analyzerTruth=object(object(input.fabricAnalyzer).groundTruth);
  const reviewedFabrics=number(analyzerTruth.reviewedFabrics);
  const reviewedTarget=Math.max(1,number(analyzerTruth.target,50));
  const colorSummary=object(object(input.fabricColor).summary);
  const colorCount=number(colorSummary.uniqueFabrics);
  const colorTarget=Math.max(1,number(colorSummary.target,10));
  const colorComplete=colorSummary.evidenceGateComplete===true||colorCount>=colorTarget;
  const fabricCoverage=object(object(input.designerData).coverage);
  const policyRaw=object(input.fabricTruthPolicy).policy;
  let fabricTruthPolicy=null;
  try{fabricTruthPolicy=normalizeFabricTruthPolicy(policyRaw);}catch{}
  const fabricTruthEvidence=evaluateFabricTruthPolicy(fabricTruthPolicy,{
    activeCandidates:number(fabricCoverage.activeCandidates),
    physicalScale:number(fabricCoverage.physicalScale),
    gsm:number(fabricCoverage.gsm),
    drape:number(fabricCoverage.drape),
    fiber:number(fabricCoverage.fiber),
  });
  const reviewedComplete=reviewedFabrics>=reviewedTarget;
  const phase2MeasuredProgress=Math.round((
    ratio(reviewedFabrics,reviewedTarget)
    +ratio(colorCount,colorTarget)
    +fabricTruthEvidence.progressPercent
  )/3);
  const phase2Complete=reviewedComplete&&colorComplete&&fabricTruthEvidence.gateComplete;

  const previewSummary=object(object(input.previewCoverage).summary);
  const previewComplete=previewSummary.gateComplete===true;
  const noviceSummary=object(object(input.noviceStudy).summary);
  const noviceComplete=noviceSummary.gateComplete===true;
  const phase3Complete=phase1Complete&&previewComplete&&noviceComplete;

  const measurementSummary=object(object(input.measurementCalibration).summary);
  const measurementComplete=measurementSummary.complete===true;
  const easeSummary=object(object(input.easeCalibration).summary);
  const easeCoverageComplete=easeSummary.evidenceCoverageComplete===true;
  const easeModels=array(object(input.easeCalibration).models);
  const approvedEaseModel=easeModels.some((row)=>String(row.status||"")==="approved");
  const phase4Complete=measurementComplete&&easeCoverageComplete&&approvedEaseModel;

  const launchInput=object(input.launchReadiness);
  const launchSummary=summarizeLaunchReadiness(
    array(launchInput.betaAttempts) as never[],
    array(launchInput.checklistEvents) as never[],
  );
  const phase5Complete=launchSummary.betaGateComplete;

  const directorSummary=object(object(input.styleDirector).summary);
  const phase6Complete=directorSummary.validationComplete===true;

  const renderInput=object(input.renderQa);
  const renderSummary=object(renderInput.summary);
  const identitySummary=object(renderInput.identitySummary);
  const creditSummary=object(renderInput.creditCapSummary);
  const patternCoverage=object(renderInput.patternCoverageSummary);
  const manualSignoff=object(renderInput.manualReviewSignoff);
  const renderRelease=evaluateFinalRenderReleaseEvidence({
    reviewed:number(renderSummary.reviewed),
    approvalRate:renderSummary.approvalRate===null||renderSummary.approvalRate===undefined?null:number(renderSummary.approvalRate),
    identity:{
      eligibleConcepts:number(identitySummary.eligibleConcepts),
      reviewedConcepts:number(identitySummary.reviewedConcepts),
      pendingConcepts:number(identitySummary.pendingConcepts),
      passedConcepts:number(identitySummary.passedConcepts),
      failedConcepts:number(identitySummary.failedConcepts),
    },
    creditCap:{
      configured:creditSummary.configured===true,
      withinCap:creditSummary.withinCap===true?true:creditSummary.withinCap===false?false:null,
    },
    manualReviewSignoff:{
      status:manualSignoff.status==="approved"?"approved":manualSignoff.status==="review"?"review":null,
    },
    patternCoverage:{
      requiredPairs:number(patternCoverage.requiredPairs),
      passedPairs:number(patternCoverage.passedPairs),
      failedPairs:number(patternCoverage.failedPairs),
      pendingPairs:number(patternCoverage.pendingPairs),
      gateComplete:patternCoverage.gateComplete===true,
    },
  });
  const phase7Complete=renderRelease.gateComplete;

  const productionInput=object(input.productionEvidence);
  const productionSummary=summarizeProductionDeliveryEvidence(
    array(productionInput.orders) as never[],
    array(productionInput.evidence) as never[],
  );
  const meterageModels=array(object(input.meterageModel).models);
  const approvedMeterageGarments=new Set(
    meterageModels
      .filter((row)=>String(row.status||"")==="approved")
      .map((row)=>String(row.garment||"")),
  );
  const meterageComplete=approvedMeterageGarments.has("shirt")&&approvedMeterageGarments.has("trouser");
  const phase8Complete=productionSummary.gateComplete&&meterageComplete;

  const allDeviceAccepted=mobileAccepted&&tabletAccepted&&desktopAccepted;
  const backendApiSummary=object(object(input.backendHealth).summary);
  const backendHealth=summarizeRoadmapBackendHealth(object(backendApiSummary.capabilities));
  const phase9Complete=launchSummary.launchEvidenceComplete&&allDeviceAccepted&&backendHealth.gateComplete;

  const outcomeSummary=object(object(input.customerOutcomes).summary);
  const phase11Complete=outcomeSummary.gateComplete===true;

  const phases:RoadmapPhaseState[]=[
    phase({id:"phase-0",phase:0,title:"Audit / Stabilize",engineeringComplete:true,evidenceComplete:true,progressPercent:100,metric:"Engineering baseline locked",blocker:"None — merge/deploy is the release action.",href:"/operator/phase10-readiness"}),
    phase({id:"phase-1",phase:1,title:"Premium Shirt Proof",engineeringComplete:true,evidenceComplete:phase1Complete,progressPercent:percent([phase1Core,mobileAccepted]),metric:`${phase1Core?"Core proof accepted":"Core proof open"} · mobile ${mobileAccepted?"accepted":"open"}`,blocker:phase1Complete?"Evidence gate satisfied.":"Needs physical-scale/realism/boundary proof and target-mobile acceptance.",href:"/lab/proof"}),
    phase({id:"phase-2",phase:2,title:"Fabric Truth",engineeringComplete:true,evidenceComplete:phase2Complete,progressPercent:phase2MeasuredProgress,metric:`${reviewedFabrics}/${reviewedTarget} reviewed · ${colorCount}/${colorTarget} colour · physical ${fabricTruthEvidence.completedFields}/${fabricTruthEvidence.totalFields}`,blocker:phase2Complete?"Fabric Truth evidence gate satisfied.":!fabricTruthPolicy?"Owner/supplier physical-evidence thresholds are not documented yet.":"Needs the reviewed-fabric, physical-colour and approved GSM/fibre/drape/scale coverage gates to pass.",href:"/operator/fabric-truth-policy"}),
    phase({id:"phase-3",phase:3,title:"Deterministic Designer",engineeringComplete:true,evidenceComplete:phase3Complete,progressPercent:percent([phase1Complete,previewComplete,noviceComplete]),metric:`proof ${phase1Complete?"✓":"open"} · preview ${previewComplete?"✓":"open"} · novice study ${noviceComplete?"✓":"open"}`,blocker:phase3Complete?"Evidence gate satisfied.":"Requires Phase 1 evidence, all visible preview reviews and five server-timed novice completions within the documented target.",href:"/operator/preview-option-coverage"}),
    phase({id:"phase-4",phase:4,title:"Measurements / Fit",engineeringComplete:true,evidenceComplete:phase4Complete,progressPercent:percent([measurementComplete,easeCoverageComplete,approvedEaseModel]),metric:`measurement ${measurementComplete?"✓":"open"} · ease cells ${easeCoverageComplete?"✓":"open"} · approved model ${approvedEaseModel?"✓":"open"}`,blocker:phase4Complete?"Evidence gate satisfied.":"Requires real-person measurement accuracy plus complete finished-garment ease evidence and owner/tailor approval.",href:"/operator/measurement-calibration"}),
    phase({id:"phase-5",phase:5,title:"Lock / Share / Enquiry",engineeringComplete:true,evidenceComplete:phase5Complete,progressPercent:ratio(launchSummary.successfulBetaCases,launchSummary.betaTarget),metric:`${launchSummary.successfulBetaCases}/${launchSummary.betaTarget} verified customer flows`,blocker:phase5Complete?"Five-customer flow gate satisfied.":"Run five distinct real lock → verified share/enquiry flows with no blocking bug.",href:"/operator/launch-readiness"}),
    phase({id:"phase-6",phase:6,title:"Style Director",engineeringComplete:true,evidenceComplete:phase6Complete,progressPercent:directorSummary.requiredPositiveCases?ratio(number(directorSummary.positiveCases),number(directorSummary.requiredPositiveCases)):0,metric:`${number(directorSummary.positiveCases)} clean cases · target ${directorSummary.requiredPositiveCases??"not documented"}`,blocker:phase6Complete?"Validation gate satisfied.":"Needs a documented owner target, enough non-replayed clean handoff cases and human sign-off.",href:"/operator/style-director-validation"}),
    phase({id:"phase-7",phase:7,title:"Final Render / QA",engineeringComplete:true,evidenceComplete:phase7Complete,progressPercent:renderRelease.progressPercent,metric:`${renderRelease.completedGates}/${renderRelease.totalGates} render-release gates`,blocker:phase7Complete?"Render release evidence satisfied.":"Needs real approval volume/rate, cross-view identity, owner credit cap, manual-review sign-off and physical pattern calibration.",href:"/operator/render-qa"}),
    phase({id:"phase-8",phase:8,title:"Production Bridge",engineeringComplete:true,evidenceComplete:phase8Complete,progressPercent:percent([productionSummary.gateComplete,meterageComplete]),metric:`${productionSummary.zeroReentryTargetCount}/${productionSummary.target} zero-reentry deliveries · meterage ${meterageComplete?"approved":"open"}`,blocker:phase8Complete?"Production evidence gate satisfied.":"Needs approved shirt + trouser meterage models and ten provenance-backed zero-reentry deliveries.",href:"/operator/production-evidence"}),
    phase({id:"phase-9",phase:9,title:"Hardening / Launch",engineeringComplete:true,evidenceComplete:phase9Complete,progressPercent:percent([launchSummary.betaGateComplete,launchSummary.checklistGateComplete,allDeviceAccepted,backendHealth.gateComplete]),metric:`beta ${launchSummary.betaGateComplete?"✓":"open"} · sign-off ${launchSummary.checklistGateComplete?"✓":"open"} · devices ${allDeviceAccepted?"3/3":"open"} · backend ${backendHealth.readyCount}/${backendHealth.total}`,blocker:phase9Complete?"Human/device evidence and the live production backend contract are complete; production promotion still runs through CI/release readiness.":!backendHealth.gateComplete?"Production Supabase backend contract is incomplete or could not be verified.":"Needs verified beta evidence, human launch checklist and accepted mobile/tablet/desktop device QA.",href:"/operator/launch-readiness"}),
    phase({id:"phase-10",phase:10,title:"Ecommerce",engineeringComplete:false,evidenceComplete:false,status:"later",progressPercent:0,metric:"Intentionally deferred",blocker:"Starts only after Launch 3; do not pull this forward.",href:"/operator"}),
    phase({id:"phase-11",phase:11,title:"Closed Loop",engineeringComplete:true,evidenceComplete:phase11Complete,progressPercent:outcomeSummary.threshold?ratio(number(outcomeSummary.learningEligible),number(outcomeSummary.threshold)):0,metric:`${number(outcomeSummary.learningEligible)} learning-eligible outcomes · target ${outcomeSummary.threshold??"not documented"}`,blocker:phase11Complete?"Human outcome threshold satisfied.":"Needs real delivered-order outcomes plus a recorded human learning threshold/policy.",href:"/operator/customer-outcomes"}),
  ];

  const active=phases.filter((item)=>item.phase!==10);
  const engineeringComplete=active.filter((item)=>item.engineeringComplete).length;
  const evidenceComplete=active.filter((item)=>item.evidenceComplete).length;
  return {
    phases,
    engineeringComplete,
    engineeringTotal:active.length,
    evidenceComplete,
    evidenceTotal:active.length,
    allEngineeringComplete:engineeringComplete===active.length,
    allEvidenceComplete:evidenceComplete===active.length,
    backendHealthy:backendHealth.gateComplete,
    backendReadyCount:backendHealth.readyCount,
    backendTotal:backendHealth.total,
    backendMissing:backendHealth.missing,
  };
}
