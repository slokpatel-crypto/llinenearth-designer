"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { summarizeConstructionReviews } from "@/lib/designer/construction-review-summary";

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

type LoadState={
  phase1Proof:Phase1ProofPayload|null;
  designerData:DesignerDataPayload|null;
  analyzer:AnalyzerStatsPayload|null;
  analyzerScorecard:AnalyzerScorecardPayload|null;
  scorecard:ScorecardPayload|null;
  construction:ConstructionPayload|null;
  device:DeviceQaPayload|null;
  renderCache:RenderCachePayload|null;
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
    phase1Proof:null,designerData:null,analyzer:null,analyzerScorecard:null,scorecard:null,construction:null,device:null,renderCache:null,
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
      const [phase1Proof,designerData,analyzer,analyzerScorecard,scorecard,construction,device,renderCache]=await Promise.all([
        read<Phase1ProofPayload>("/api/operator/phase1-proof"),
        read<DesignerDataPayload>("/api/operator/designer-data"),
        read<AnalyzerStatsPayload>("/api/operator/fabric-analyzer/stats"),
        read<AnalyzerScorecardPayload>("/api/operator/fabric-ground-truth/scorecard"),
        read<ScorecardPayload>("/api/operator/designer-evaluation/scorecard"),
        read<ConstructionPayload>("/api/operator/construction-approval"),
        read<DeviceQaPayload>("/api/operator/device-qa"),
        read<RenderCachePayload>("/api/operator/designer-render-cache/stats"),
      ]);
      setData({phase1Proof,designerData,analyzer,analyzerScorecard,scorecard,construction,device,renderCache});
    }catch(error){
      setMessage(error instanceof Error?error.message:"Readiness data could not be loaded.");
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{void load();},[]);

  const rows=useMemo<ReadinessRow[]>(()=>{
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
