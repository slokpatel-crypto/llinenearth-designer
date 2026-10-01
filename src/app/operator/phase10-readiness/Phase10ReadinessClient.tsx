"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { summarizeConstructionReviews } from "@/lib/designer/construction-review-summary";
import { summarizeLaunchReadiness } from "@/lib/designer/launch-readiness-evidence";
import { evaluateFinalRenderReleaseEvidence } from "@/lib/designer/render-release-evidence";

type DesignerDataPayload={
  coverage:{
    total:number;
    activeCandidates:number;
    priorityFabrics:number;
    availability:number;
    analyzerReviewed:number;
    physicalScale:number;
    gsm:number;
    drape:number;
    fiber:number;
    formality:number;
  };
};

type AnalyzerStatsPayload={
  database?:{
    profiles:number;
    pending_review:number;
    approved:number;
    corrected:number;
    rejected:number;
    feedback:number;
  }|null;
  groundTruth?:{
    target:number;
    reviewedFabrics:number;
    pendingFabrics:number;
    stockBoundProfiles:number;
    remaining:number;
  };
};

type ScorecardPayload={
  reportable:boolean;
  minimumTotalLabels:number;
  minimumActionableLabels:number;
  labeledCases:number;
  actionableLabels:number;
  remainingTotal?:number;
  remainingActionable?:number;
  top1?:{percent:number|null};
  top3?:{percent:number|null};
};

type AnalyzerScorecardPayload={
  reportable:boolean;
  minimumLabels:number;
  uniqueFabrics:number;
  remaining:number;
  fieldAgreementPercent:number|null;
  exactProfilePercent:number|null;
};

type ConstructionPayload={
  total:number;
  approved:number;
  pending:number;
  rejected:number;
};

type LaunchMetricsPayload={
  configured:boolean;
  counts?:Record<string,number>;
  totals?:{sessions:number;renders:number;whatsapp:number;sales:number};
};

type MeasurementCalibrationPayload={
  configured:boolean;
  summary:{
    target:number;
    total:number;
    medianChestErrorCm:number|null;
    medianSleeveErrorCm:number|null;
    chestPass:boolean;
    sleevePass:boolean;
    complete:boolean;
  };
};

type Phase1ProofPayload={
  configured:boolean;
  latest:{
    at:string;
    status:string;
    fabricId:string;
    fabricName:string;
    pattern:string;
    repeatMm:number|null;
    scaleErrorPct:number|null;
    scaleGatePass:boolean;
    realModelSamples:number;
    realModelP95Ms:number|null;
    realismRatings:number[];
    strongRatings:number;
    realismPass:boolean;
    note:string;
  }|null;
};

type DeviceQaPayload={
  configured:boolean;
  latest:Record<string,{status:string;viewport:string;p95Ms:number|null;samples:number;at:string}>;
};

type RenderCachePayload={
  database?:{
    total_entries:number;
    fresh_entries:number;
    total_hits:number;
    distinct_pairs:number;
    last_hit_at:string|null;
  }|null;
  popularPairs?:Array<unknown>;
};

type ProductionCalibrationPayload={
  configured:boolean;
  summary:{
    total:number;
    shirtCases:number;
    trouserCases:number;
    medianShirtMetres:number|null;
    medianTrouserMetres:number|null;
    readyForModel:boolean;
  };
};

type StockPayload={
  configured:boolean;
  stock:Array<{fabric_id:string;physical_metres:number;reserved_metres:number;available_metres:number}>;
};

type RenderQaPayload={
  outcomes:Array<unknown>;
  summary:{
    total:number;generated:number;cached:number;reviewed:number;pending:number;approved:number;rejected:number;
    qaPass:number;totalCredits:number;approvalRate:number|null;creditsPerApproved:number|null;
  };
  identitySummary:{
    eligibleConcepts:number;reviewedConcepts:number;pendingConcepts:number;
    passedConcepts:number;failedConcepts:number;passRate:number|null;
  };
  creditCapSummary:{
    configured:boolean;withinCap:boolean|null;ownerCap:number|null;
  };
};

type ProductionPayload={
  configured:boolean;
  quotes:Array<{quote_id:string;status:string;revision_id:string}>;
  orders:Array<{order_id:string;status:string;revision_id:string}>;
};

type LaunchReadinessPayload={
  configured:boolean;
  betaAttempts:Array<{case_id:string;device_class:string;core_flow_completed:boolean;design_locked?:boolean;share_or_enquiry_completed?:boolean;blocking_bug:boolean;created_at:string}>;
  checklistEvents:Array<{item_id:string;status:string;created_at:string}>;
};

type FabricColorCalibrationPayload={
  configured:boolean;
  summary:{
    target:number;
    uniqueFabrics:number;
    remaining:number;
    evidenceGateComplete:boolean;
    averageDeltaE:number|null;
    medianDeltaE:number|null;
  };
};

type StyleDirectorValidationPayload={
  configured:boolean;
  summary:{
    uniqueCases:number;
    positiveCases:number;
    blockingCases:number;
    understandableCases:number;
    distinctCases:number;
    handoffCases:number;
    deviceCoverage:string[];
    latestSignoffStatus:string;
    evidenceRecorded:boolean;
    validationComplete:boolean;
  };
};

type EaseCalibrationPayload={
  configured:boolean;
  models:Array<{model_id:string;version:string;status:string;approved_by:string}>;
  summary:{
    requiredCells:number;
    coveredCells:number;
    uncoveredCells:string[];
    evidenceCoverageComplete:boolean;
    uniqueCases:number;
  };
};

type PreviewCoveragePayload={
  configured:boolean;
  summary:{
    total:number;
    previewApproved:number;
    previewRejected:number;
    previewPending:number;
    noPreviewSupport:number;
    constructionBlocked:number;
    constructionPending:number;
    fullyCleared:number;
    coveragePercent:number;
    gateComplete:boolean;
  };
};

type NoviceDesignerStudyPayload={
  configured:boolean;
  summary:{
    uniqueCases:number;
    noviceCases:number;
    likedDesignCases:number;
    blockingCases:number;
    medianLikedDesignSeconds:number|null;
    targetSeconds:number|null;
    withinTargetCases:number;
    latestDecisionStatus:string;
    evidenceReady:boolean;
    gateComplete:boolean;
  };
};

type LoadState={
  phase1Proof:Phase1ProofPayload|null;
  measurementCalibration:MeasurementCalibrationPayload|null;
  launchMetrics:LaunchMetricsPayload|null;
  designerData:DesignerDataPayload|null;
  analyzer:AnalyzerStatsPayload|null;
  analyzerScorecard:AnalyzerScorecardPayload|null;
  scorecard:ScorecardPayload|null;
  construction:ConstructionPayload|null;
  device:DeviceQaPayload|null;
  renderCache:RenderCachePayload|null;
  productionCalibration:ProductionCalibrationPayload|null;
  stock:StockPayload|null;
  production:ProductionPayload|null;
  renderQa:RenderQaPayload|null;
  launchReadiness:LaunchReadinessPayload|null;
  fabricColorCalibration:FabricColorCalibrationPayload|null;
  styleDirectorValidation:StyleDirectorValidationPayload|null;
  easeCalibration:EaseCalibrationPayload|null;
  previewCoverage:PreviewCoveragePayload|null;
  noviceDesignerStudy:NoviceDesignerStudyPayload|null;
};

type RowStatus="done"|"progress"|"blocked"|"optional";

type ReadinessRow={
  id:string;
  title:string;
  detail:string;
  status:RowStatus;
  progress:number;
  metric:string;
  href:string;
  action:string;
  ownerDependent:boolean;
};

function clamp(value:number){return Math.max(0,Math.min(100,Math.round(value)));}
function ratio(value:number,total:number){return total>0?clamp(value/total*100):0;}

export default function Phase10ReadinessClient(){
  const [data,setData]=useState<LoadState>({
    phase1Proof:null,measurementCalibration:null,launchMetrics:null,designerData:null,analyzer:null,analyzerScorecard:null,scorecard:null,construction:null,device:null,renderCache:null,productionCalibration:null,stock:null,production:null,renderQa:null,launchReadiness:null,fabricColorCalibration:null,styleDirectorValidation:null,easeCalibration:null,previewCoverage:null,noviceDesignerStudy:null,
  });
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");

  async function read<T>(url:string):Promise<T|null>{
    const response=await fetch(url,{cache:"no-store"});
    if(response.status===401){
      window.location.href="/operator/login?next=/operator/phase10-readiness";
      return null;
    }
    if(!response.ok) return null;
    return await response.json() as T;
  }

  async function load(){
    setLoading(true);setMessage("");
    try{
      const [phase1Proof,measurementCalibration,launchMetrics,designerData,analyzer,analyzerScorecard,scorecard,construction,device,renderCache,productionCalibration,stock,production,renderQa,launchReadiness,fabricColorCalibration,styleDirectorValidation,easeCalibration,previewCoverage,noviceDesignerStudy]=await Promise.all([
        read<Phase1ProofPayload>("/api/operator/phase1-proof"),
        read<MeasurementCalibrationPayload>("/api/operator/measurement-calibration"),
        read<LaunchMetricsPayload>("/api/operator/cloud-summary?days=60"),
        read<DesignerDataPayload>("/api/operator/designer-data"),
        read<AnalyzerStatsPayload>("/api/operator/fabric-analyzer/stats"),
        read<AnalyzerScorecardPayload>("/api/operator/fabric-ground-truth/scorecard"),
        read<ScorecardPayload>("/api/operator/designer-evaluation/scorecard"),
        read<ConstructionPayload>("/api/operator/construction-approval"),
        read<DeviceQaPayload>("/api/operator/device-qa"),
        read<RenderCachePayload>("/api/operator/designer-render-cache/stats"),
        read<ProductionCalibrationPayload>("/api/operator/production-calibration"),
        read<StockPayload>("/api/operator/stock"),
        read<ProductionPayload>("/api/operator/production"),
        read<RenderQaPayload>("/api/operator/render-qa"),
        read<LaunchReadinessPayload>("/api/operator/launch-readiness"),
        read<FabricColorCalibrationPayload>("/api/operator/fabric-color-calibration"),
        read<StyleDirectorValidationPayload>("/api/operator/style-director-validation"),
        read<EaseCalibrationPayload>("/api/operator/ease-calibration"),
        read<PreviewCoveragePayload>("/api/operator/preview-option-coverage"),
        read<NoviceDesignerStudyPayload>("/api/operator/novice-designer-study"),
      ]);
      setData({phase1Proof,measurementCalibration,launchMetrics,designerData,analyzer,analyzerScorecard,scorecard,construction,device,renderCache,productionCalibration,stock,production,renderQa,launchReadiness,fabricColorCalibration,styleDirectorValidation,easeCalibration,previewCoverage,noviceDesignerStudy});
    }catch(error){
      setMessage(error instanceof Error?error.message:"Readiness data could not be loaded.");
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{void load();},[]);

  const rows=useMemo<ReadinessRow[]>(()=>{
    const launchCounts=data.launchMetrics?.counts||{};
    const launchLocked=Math.max(0,Number(launchCounts.design_locked)||0);
    const launchEnquiries=Math.max(0,Number(launchCounts.whatsapp_clicked)||0);
    const launchDesignProgress=ratio(launchLocked,100);
    const launchEnquiryProgress=ratio(launchEnquiries,20);
    const launch1Progress=Math.round((launchDesignProgress+launchEnquiryProgress)/2);
    const launch1Done=launchLocked>=100&&launchEnquiries>=20;

    const measurement=data.measurementCalibration?.summary;
    const measurementCountProgress=ratio(measurement?.total||0,measurement?.target||10);
    const measurementAccuracySignals=[measurement?.chestPass===true,measurement?.sleevePass===true].filter(Boolean).length;
    const measurementProgress=Math.round((measurementCountProgress+ratio(measurementAccuracySignals,2))/2);
    const measurementDone=measurement?.complete===true;

    const previewCoverage=data.previewCoverage?.summary;
    const previewCoverageDone=previewCoverage?.gateComplete===true;

    const noviceStudy=data.noviceDesignerStudy?.summary;
    const noviceProgress=noviceStudy?.targetSeconds
      ? ratio(noviceStudy.withinTargetCases,5)
      : ratio(noviceStudy?.likedDesignCases||0,5);
    const noviceDone=noviceStudy?.gateComplete===true;

    const easeCalibration=data.easeCalibration?.summary;
    const approvedEaseModel=data.easeCalibration?.models?.find((item)=>item.status==="approved")||null;
    const easeCoverageProgress=ratio(easeCalibration?.coveredCells||0,easeCalibration?.requiredCells||35);
    const easeProgress=Math.round((easeCoverageProgress+(approvedEaseModel?100:0))/2);
    const easeDone=Boolean(easeCalibration?.evidenceCoverageComplete&&approvedEaseModel);

    const proof=data.phase1Proof?.latest||null;
    const proofScale=proof?.scaleGatePass===true;
    const proofLatency=Boolean(proof && proof.realModelSamples>=12 && proof.realModelP95Ms!==null && proof.realModelP95Ms<300);
    const proofRealism=proof?.realismPass===true;
    const proofProgress=ratio([proofScale,proofLatency,proofRealism].filter(Boolean).length,3);
    const proofDone=Boolean(proof?.status==="accepted" && proofScale && proofLatency && proofRealism);

    const coverage=data.designerData?.coverage;
    const active=coverage?.activeCandidates||0;
    const evidenceSignals=coverage
      ? [coverage.availability,coverage.analyzerReviewed,coverage.physicalScale,coverage.gsm,coverage.drape,coverage.fiber,coverage.formality]
      : [];
    const evidenceProgress=active&&evidenceSignals.length
      ? Math.round(evidenceSignals.reduce((sum,value)=>sum+ratio(value,active),0)/evidenceSignals.length)
      : 0;
    const evidenceDone=Boolean(active && evidenceSignals.every((value)=>value>=active));

    const groundTruth=data.analyzer?.groundTruth;
    const analyzerScore=data.analyzerScorecard;
    const reviewed=groundTruth?.reviewedFabrics||0;
    const analyzerTarget=groundTruth?.target||50;
    const analyzerLabelTarget=analyzerScore?.minimumLabels||40;
    const analyzerProgress=Math.min(
      ratio(reviewed,analyzerTarget),
      ratio(analyzerScore?.uniqueFabrics||0,analyzerLabelTarget),
    );
    const analyzerDone=Boolean(reviewed>=analyzerTarget && analyzerScore?.reportable);

    const colorCalibration=data.fabricColorCalibration?.summary;
    const colorCalibrationProgress=ratio(colorCalibration?.uniqueFabrics||0,colorCalibration?.target||10);
    const colorCalibrationDone=colorCalibration?.evidenceGateComplete===true;

    const styleValidation=data.styleDirectorValidation?.summary;
    const styleValidationProgress=styleValidation
      ? Math.round((ratio(styleValidation.positiveCases,Math.max(1,styleValidation.uniqueCases))+(styleValidation.latestSignoffStatus==="approved"?100:0))/2)
      : 0;
    const styleValidationDone=styleValidation?.validationComplete===true;

    const score=data.scorecard;
    const totalLabelTarget=score?.minimumTotalLabels||40;
    const actionTarget=score?.minimumActionableLabels||32;
    const benchmarkProgress=score
      ? Math.min(ratio(score.labeledCases,totalLabelTarget),ratio(score.actionableLabels,actionTarget))
      : 0;

    const construction=data.construction;
    const constructionSummary=summarizeConstructionReviews(construction||{total:0,approved:0,rejected:0,pending:0});
    const constructionProgress=constructionSummary.completionPercent;
    const constructionDone=Boolean(constructionSummary.total && constructionSummary.pending===0);

    const latest=data.device?.latest||{};
    const acceptedDevices=["mobile","tablet","desktop"].filter((kind)=>latest[kind]?.status==="accepted").length;
    const deviceProgress=ratio(acceptedDevices,3);

    const launchEvidence=data.launchReadiness
      ? summarizeLaunchReadiness(data.launchReadiness.betaAttempts,data.launchReadiness.checklistEvents)
      : null;
    const launchEvidenceProgress=launchEvidence
      ? Math.round((ratio(launchEvidence.successfulBetaCases,launchEvidence.betaTarget)+ratio(launchEvidence.checklistApproved,launchEvidence.checklistTotal))/2)
      : 0;

    const productionCalibration=data.productionCalibration?.summary;
    const productionUsageProgress=Math.round((
      ratio(productionCalibration?.shirtCases||0,20)+ratio(productionCalibration?.trouserCases||0,20)
    )/2);
    const productionUsageDone=productionCalibration?.readyForModel===true;

    const stockRows=data.stock?.stock||[];
    const positiveStock=stockRows.filter((item)=>Number(item.physical_metres)>0).length;
    const stockProgress=positiveStock>0?100:0;
    const stockDone=Boolean(data.stock?.configured&&positiveStock>0);

    const renderSummary=data.renderQa?.summary;
    const renderRelease=renderSummary&&data.renderQa?.identitySummary&&data.renderQa?.creditCapSummary
      ? evaluateFinalRenderReleaseEvidence({
          reviewed:renderSummary.reviewed,
          approvalRate:renderSummary.approvalRate,
          identity:data.renderQa.identitySummary,
          creditCap:data.renderQa.creditCapSummary,
        })
      : null;
    const renderReleaseProgress=renderRelease?.progressPercent||0;
    const renderReleaseDone=renderRelease?.gateComplete===true;

    const productionOrders=data.production?.orders||[];
    const deliveredOrders=productionOrders.filter((item)=>item.status==="delivered").length;
    const productionOrderProgress=ratio(deliveredOrders,10);
    const productionOrderDone=deliveredOrders>=10;

    const cache=data.renderCache?.database;
    const cacheProgress=cache?.distinct_pairs ? clamp(Math.min(100,cache.distinct_pairs*10)) : 0;

    return [
      {
        id:"premium-shirt-proof",
        title:"Roadmap v2 premium shirt proof",
        detail:proofDone
          ? `${proof?.fabricName||"Selected fabric"} passed physical scale, real-model latency and 8-viewer realism evidence.`
          : proof
            ? `Latest proof is ${proof.status}. Scale ${proofScale?"passes":"needs evidence"}, real-model latency ${proofLatency?"passes":"needs evidence"}, realism ${proofRealism?"passes":"needs evidence"}.`
            : "No operator-recorded Premium Shirt Proof evidence yet.",
        status:proofDone?"done":data.phase1Proof?"progress":"blocked",
        progress:proofProgress,
        metric:proof
          ? `${proof.fabricName||proof.fabricId} · scale ${proof.scaleErrorPct??"—"}% · p95 ${proof.realModelP95Ms??"—"} ms · ${proof.strongRatings}/${proof.realismRatings.length} strong realism ratings`
          : "No recorded proof",
        href:"/lab/proof",
        action:"Open Premium Shirt Proof",
        ownerDependent:true,
      },
      {
        id:"launch1-traction",
        title:"Launch 1 usage evidence",
        detail:launch1Done
          ? "The current evidence window has reached the roadmap usage targets for locked designs and WhatsApp enquiries."
          : `${Math.max(0,100-launchLocked)} more locked designs and ${Math.max(0,20-launchEnquiries)} more WhatsApp enquiries remain against the current Launch 1 targets.`,
        status:launch1Done?"done":data.launchMetrics?.configured?"progress":"blocked",
        progress:launch1Progress,
        metric:`${launchLocked}/100 locked designs · ${launchEnquiries}/20 enquiries`,
        href:"/operator",
        action:"Open conversion funnel",
        ownerDependent:true,
      },
      {
        id:"measurement-calibration",
        title:"Measurement accuracy calibration",
        detail:measurementDone
          ? `10+ real self-vs-tailor cases meet the chest and sleeve median-error targets.`
          : measurement
            ? `${Math.max(0,(measurement.target||10)-measurement.total)} more unique cases remain. Median chest ${measurement.medianChestErrorCm??"—"} cm; sleeve ${measurement.medianSleeveErrorCm??"—"} cm.`
            : "No measurement calibration evidence is available yet.",
        status:measurementDone?"done":data.measurementCalibration?"progress":"blocked",
        progress:measurementProgress,
        metric:measurement?`${measurement.total}/${measurement.target} cases · chest ${measurement.chestPass?"pass":"review"} · sleeve ${measurement.sleevePass?"pass":"review"}`:"No evidence",
        href:"/operator/measurement-calibration",
        action:"Record measurement cases",
        ownerDependent:true,
      },
      {
        id:"customer-preview-coverage",
        title:"Customer-visible construction / preview coverage",
        detail:previewCoverageDone
          ? "Every style choice currently exposed by Designer is preview-approved and construction-cleared where required."
          : previewCoverage
            ? `${Math.max(0,previewCoverage.total-previewCoverage.fullyCleared)} of ${previewCoverage.total} customer-visible choices still need preview/construction clearance. ${previewCoverage.noPreviewSupport} have no instant-preview support and ${previewCoverage.constructionBlocked} are construction-rejected.`
            : "Customer-visible preview coverage has not been audited yet.",
        status:previewCoverageDone?"done":data.previewCoverage?.configured?"progress":"blocked",
        progress:previewCoverage?.coveragePercent||0,
        metric:previewCoverage?`${previewCoverage.fullyCleared}/${previewCoverage.total} cleared · ${previewCoverage.previewPending} preview pending · ${previewCoverage.constructionPending} construction pending`:"No coverage evidence",
        href:"/operator/preview-option-coverage",
        action:"Audit customer preview choices",
        ownerDependent:true,
      },
      {
        id:"novice-designer-study",
        title:"Five-novice Designer completion study",
        detail:noviceDone
          ? `Five latest unique novice cases completed a liked design within the documented target of ${noviceStudy?.targetSeconds||0} seconds, with explicit human approval.`
          : noviceStudy
            ? noviceStudy.targetSeconds
              ? `${Math.max(0,5-noviceStudy.withinTargetCases)} more qualifying novice cases are needed within the documented target. Latest human decision: ${noviceStudy.latestDecisionStatus}.`
              : `${noviceStudy.likedDesignCases}/5 clean liked-design completions are recorded, but no documented target time has been entered yet.`
            : "No novice Designer completion evidence is available yet.",
        status:noviceDone?"done":data.noviceDesignerStudy?.configured?"progress":"blocked",
        progress:noviceProgress,
        metric:noviceStudy
          ? `${noviceStudy.withinTargetCases}/5 within target · median ${noviceStudy.medianLikedDesignSeconds??"—"} sec · target ${noviceStudy.targetSeconds??"not set"} sec`
          : "No novice evidence",
        href:"/operator/novice-designer-study",
        action:"Run novice completion study",
        ownerDependent:true,
      },
      {
        id:"house-ease-calibration",
        title:"Finished-garment house-ease calibration",
        detail:easeDone
          ? `All ${easeCalibration?.requiredCells||35} current ease-table cells have real finished-garment evidence and ${approvedEaseModel?.version} has explicit owner/tailor approval in the registry.`
          : easeCalibration
            ? `${Math.max(0,easeCalibration.requiredCells-easeCalibration.coveredCells)} table cells still need real finished-garment evidence. ${approvedEaseModel?"An approved registry version exists.":"No replacement table is approved yet."}`
            : "No finished-garment house-ease calibration evidence is available yet.",
        status:easeDone?"done":data.easeCalibration?.configured?"progress":"blocked",
        progress:easeProgress,
        metric:easeCalibration?`${easeCalibration.coveredCells}/${easeCalibration.requiredCells} cells · ${easeCalibration.uniqueCases} real cases · ${approvedEaseModel?.version||"no approved version"}`:"No ease evidence",
        href:"/operator/ease-calibration",
        action:"Open house ease calibration",
        ownerDependent:true,
      },
      {
        id:"fabric-evidence",
        title:"Fabric evidence coverage",
        detail:evidenceDone
          ? "All active fabrics have the core verified Designer evidence fields."
          : `${coverage?.priorityFabrics||0} fabrics still have high-priority evidence gaps across availability, Analyzer review, true pattern scale, GSM, drape, fibre or formality.`,
        status:evidenceDone?"done":coverage?"progress":"blocked",
        progress:evidenceProgress,
        metric:`${evidenceProgress}% evidence coverage`,
        href:"/operator/designer-data",
        action:"Open evidence queue",
        ownerDependent:true,
      },
      {
        id:"analyzer-ground-truth",
        title:"Fabric Analyzer ground truth",
        detail:analyzerDone
          ? `Reviewed-fabric target and owner-labelled agreement benchmark are both ready${analyzerScore?.fieldAgreementPercent!=null?` · field agreement ${analyzerScore.fieldAgreementPercent}%`:""}.`
          : `${Math.max(0,analyzerTarget-reviewed)} reviewed-fabric slots and ${Math.max(0,analyzerLabelTarget-(analyzerScore?.uniqueFabrics||0))} scorecard labels remain before Analyzer agreement is reportable.`,
        status:analyzerDone?"done":groundTruth||analyzerScore?"progress":"blocked",
        progress:analyzerProgress,
        metric:`${reviewed}/${analyzerTarget} reviewed · ${analyzerScore?.uniqueFabrics||0}/${analyzerLabelTarget} labelled`,
        href:"/operator/fabric-ground-truth",
        action:"Review fabrics",
        ownerDependent:true,
      },
      {
        id:"fabric-physical-colour",
        title:"Controlled physical colour checks",
        detail:colorCalibrationDone
          ? "The roadmap count gate has 10 unique controlled physical fabric colour checks recorded. ΔE remains descriptive until Linen Earth chooses a commercial tolerance."
          : colorCalibration
            ? `${colorCalibration.remaining} unique controlled colour checks remain. Current median ΔE is ${colorCalibration.medianDeltaE??"—"} (descriptive only).`
            : "No physical colour-calibration evidence is available yet.",
        status:colorCalibrationDone?"done":data.fabricColorCalibration?.configured?"progress":"blocked",
        progress:colorCalibrationProgress,
        metric:colorCalibration?`${colorCalibration.uniqueFabrics}/${colorCalibration.target} unique fabrics · median ΔE ${colorCalibration.medianDeltaE??"—"}`:"No colour evidence",
        href:"/operator/fabric-color-calibration",
        action:"Record physical colour checks",
        ownerDependent:true,
      },
      {
        id:"designer-ground-truth",
        title:"Designer preference benchmark",
        detail:score?.reportable
          ? `Agreement scorecard can now report against owner-labelled choices${score.top1?.percent!=null?` · top-1 ${score.top1.percent}%`:""}.`
          : `Need at least ${totalLabelTarget} total benchmark labels and ${actionTarget} selected-direction labels before reporting agreement.`,
        status:score?.reportable?"done":score?"progress":"blocked",
        progress:benchmarkProgress,
        metric:score?`${score.labeledCases}/${totalLabelTarget} total · ${score.actionableLabels}/${actionTarget} actionable`:"Unavailable",
        href:"/operator/designer-evaluation",
        action:"Label Designer cases",
        ownerDependent:true,
      },
      {
        id:"style-director-user-validation",
        title:"Style Director real-user validation",
        detail:styleValidationDone
          ? "Real-user evidence exists and the owner/reviewer has explicitly approved the Style Director validation."
          : styleValidation
            ? `${styleValidation.uniqueCases} real-user case(s) recorded · ${styleValidation.positiveCases} with all three checks clean · latest human decision ${styleValidation.latestSignoffStatus}.`
            : "No real-user Style Director validation evidence is available yet.",
        status:styleValidationDone?"done":data.styleDirectorValidation?.configured?"progress":"blocked",
        progress:styleValidationProgress,
        metric:styleValidation?`${styleValidation.uniqueCases} cases · ${styleValidation.blockingCases} blocking · ${styleValidation.latestSignoffStatus} sign-off`:"No user-test evidence",
        href:"/operator/style-director-validation",
        action:"Run Style Director validation",
        ownerDependent:true,
      },
      {
        id:"construction",
        title:"Construction option approval",
        detail:constructionDone
          ? "Every owner-provided construction option has an explicit approve/reject decision."
          : `${construction?.pending??"—"} owner-provided cuts still need an explicit owner/tailor decision.`,
        status:constructionDone?"done":construction?"progress":"blocked",
        progress:constructionProgress,
        metric:construction?`${construction.approved} approved · ${construction.rejected} rejected · ${construction.pending} pending`:"Unavailable",
        href:"/operator/construction-approval",
        action:"Review construction",
        ownerDependent:true,
      },
      {
        id:"device-qa",
        title:"Real-device visual + latency QA",
        detail:acceptedDevices===3
          ? "Mobile, tablet and desktop all have recorded accepted sessions."
          : `${3-acceptedDevices} device class${3-acceptedDevices===1?"":"es"} still need a real-browser accepted session.`,
        status:acceptedDevices===3?"done":data.device?"progress":"blocked",
        progress:deviceProgress,
        metric:`${acceptedDevices}/3 device classes accepted`,
        href:"/operator/device-qa",
        action:"Run device QA",
        ownerDependent:true,
      },
      {
        id:"private-beta-launch-signoff",
        title:"Five-customer lock flow + human launch sign-off",
        detail:launchEvidence?.launchEvidenceComplete
          ? "Five successful unique lock → share/enquiry cases and every human launch checklist item are evidenced."
          : launchEvidence
            ? `${Math.max(0,launchEvidence.betaTarget-launchEvidence.successfulBetaCases)} successful lock → share/enquiry cases and ${Math.max(0,launchEvidence.checklistTotal-launchEvidence.checklistApproved)} human sign-offs remain.`
            : "No private-beta / human launch-signoff evidence is available yet.",
        status:launchEvidence?.launchEvidenceComplete?"done":data.launchReadiness?.configured?"progress":"blocked",
        progress:launchEvidenceProgress,
        metric:launchEvidence?`${launchEvidence.successfulBetaCases}/${launchEvidence.betaTarget} beta · ${launchEvidence.checklistApproved}/${launchEvidence.checklistTotal} sign-offs`:"No launch evidence",
        href:"/operator/launch-readiness",
        action:"Open launch evidence",
        ownerDependent:true,
      },
      {
        id:"final-render-qa",
        title:"Final render release evidence",
        detail:renderReleaseDone
          ? "Approval-rate evidence, cross-view identity review and the owner-approved credit boundary all pass."
          : renderRelease
            ? `${renderRelease.completedGates}/3 release evidence gates pass. Complete real render reviews, cross-view identity checks and the owner-approved cost boundary before promotion.`
            : "No final-render release evidence is available yet.",
        status:renderReleaseDone?"done":renderSummary?"progress":"blocked",
        progress:renderReleaseProgress,
        metric:renderSummary&&data.renderQa
          ? `${renderSummary.reviewed}/20 reviewed · ${renderSummary.approvalRate??"—"}% approved · identity ${data.renderQa.identitySummary.passedConcepts}/${data.renderQa.identitySummary.eligibleConcepts} pass · cap ${data.renderQa.creditCapSummary.withinCap===true?"pass":data.renderQa.creditCapSummary.withinCap===false?"over":"open"}`
          : "No render outcome evidence",
        href:"/operator/render-qa",
        action:"Complete final render evidence",
        ownerDependent:true,
      },
      {
        id:"production-calibration",
        title:"Real cloth-usage calibration",
        detail:productionUsageDone
          ? "The first evidence threshold is ready to analyse for both shirt and trouser meterage."
          : `${Math.max(0,20-(productionCalibration?.shirtCases||0))} shirt cuts and ${Math.max(0,20-(productionCalibration?.trouserCases||0))} trouser cuts remain before the first estimator may be analysed.`,
        status:productionUsageDone?"done":data.productionCalibration?.configured?"progress":"blocked",
        progress:productionUsageProgress,
        metric:productionCalibration?`${productionCalibration.shirtCases}/20 shirt · ${productionCalibration.trouserCases}/20 trouser`:"No production evidence",
        href:"/operator/production-calibration",
        action:"Record real cloth usage",
        ownerDependent:true,
      },
      {
        id:"stock-ledger",
        title:"Physical stock ledger",
        detail:stockDone
          ? `${positiveStock} fabrics have physically entered stock. Reservations can now use measured metres instead of catalogue assumptions.`
          : "No positive physical stock balance has been entered yet. Opening stock must come from real measured inventory.",
        status:stockDone?"done":data.stock?.configured?"progress":"blocked",
        progress:stockProgress,
        metric:`${positiveStock} fabrics with physical metres`,
        href:"/operator/stock",
        action:"Open stock ledger",
        ownerDependent:true,
      },
      {
        id:"production-orders",
        title:"Zero-reentry production validation",
        detail:productionOrderDone
          ? "At least 10 production orders are recorded as delivered from locked design revisions."
          : `${Math.max(0,10-deliveredOrders)} delivered production orders remain before the roadmap production-flow gate is met.`,
        status:productionOrderDone?"done":data.production?.configured?"progress":"blocked",
        progress:productionOrderProgress,
        metric:`${deliveredOrders}/10 delivered orders · ${data.production?.quotes?.length||0} quotes recorded`,
        href:"/operator/production",
        action:"Open production desk",
        ownerDependent:true,
      },
      {
        id:"render-cache",
        title:"Final-render cache learning",
        detail:cache?.total_entries
          ? `${cache.fresh_entries} fresh render entries across ${cache.distinct_pairs} cloth pairs, with ${cache.total_hits} recorded cache hits.`
          : "No durable final-render cache evidence yet. This is useful for cost/speed optimization but is not a release blocker.",
        status:cache?.total_entries?"done":"optional",
        progress:cacheProgress,
        metric:cache?`${cache.total_entries} cached renders · ${cache.total_hits} hits`:"No cache data",
        href:"/api/operator/designer-render-cache/plan?limit=12",
        action:"View prewarm plan",
        ownerDependent:false,
      },
    ];
  },[data]);

  const required=rows.filter((row)=>row.status!=="optional");
  const overall=required.length?Math.round(required.reduce((sum,row)=>sum+row.progress,0)/required.length):0;
  const done=required.filter((row)=>row.status==="done").length;
  const next=required.filter((row)=>row.status!=="done").sort((a,b)=>a.progress-b.progress)[0]||null;

  return <main className="phaseReadiness">
    <header className="phaseReadinessHeader">
      <div><span>LINEN EARTH / PRIVATE OPERATOR</span><h1>Phase 10 Readiness</h1><p>One place to see what code has already solved and what still needs real owner, tailor, fabric or device evidence. No missing fact is marked complete by assumption.</p></div>
      <nav><button type="button" onClick={()=>void load()} disabled={loading}>{loading?"Refreshing…":"Refresh evidence"}</button><Link href="/operator">Operator Desk</Link></nav>
    </header>

    <section className="phaseReadinessHero">
      <div className="phaseReadinessScore"><small>REQUIRED WORKFLOW READINESS</small><strong>{overall}%</strong><span>{done}/{required.length} required evidence gates complete</span></div>
      <div className="phaseReadinessBar"><i style={{width:`${overall}%`}}/></div>
      <div className="phaseReadinessNext"><small>NEXT BEST ACTION</small><strong>{next?.title||"All required evidence gates complete"}</strong>{next&&<Link href={next.href}>{next.action} →</Link>}</div>
    </section>

    <section className="phaseReadinessGrid">
      {rows.map((row)=><article key={row.id} data-status={row.status}>
        <div className="phaseReadinessCardHead"><span>{row.ownerDependent?"REAL-WORLD EVIDENCE":"SYSTEM OPTIMIZATION"}</span><b>{row.status==="done"?"COMPLETE":row.status==="optional"?"OPTIONAL":row.status==="blocked"?"UNAVAILABLE":"IN PROGRESS"}</b></div>
        <h2>{row.title}</h2>
        <p>{row.detail}</p>
        <div className="phaseReadinessProgress"><i style={{width:`${row.progress}%`}}/></div>
        <small>{row.metric}</small>
        <Link href={row.href}>{row.action} →</Link>
      </article>)}
    </section>

    <section className="phaseReadinessRules">
      <div><span>WHAT THIS DASHBOARD WILL NOT DO</span><h2>No fake completion.</h2></div>
      <p>It will not invent GSM, fibre, drape, pattern millimetres, tailoring approval, owner preferences, or target-device performance. Those gates only advance from the evidence desks that already store auditable records.</p>
    </section>

    {message&&<button className="phaseReadinessToast" onClick={()=>setMessage("")}>{message}<b>×</b></button>}
  </main>;
}
