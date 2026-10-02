"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { summarizeRoadmapReadiness, type RoadmapReadinessInput } from "@/lib/designer/roadmap-readiness";

const ENDPOINTS={
  phase1Proof:"/api/operator/phase1-proof",
  deviceQa:"/api/operator/device-qa",
  fabricAnalyzer:"/api/operator/fabric-analyzer/stats",
  fabricColor:"/api/operator/fabric-color-calibration",
  designerData:"/api/operator/designer-data",
  fabricTruthPolicy:"/api/operator/fabric-truth-policy",
  previewCoverage:"/api/operator/preview-option-coverage",
  noviceStudy:"/api/operator/novice-designer-study",
  measurementCalibration:"/api/operator/measurement-calibration",
  easeCalibration:"/api/operator/ease-calibration",
  launchReadiness:"/api/operator/launch-readiness",
  styleDirector:"/api/operator/style-director-validation",
  renderQa:"/api/operator/render-qa",
  productionEvidence:"/api/operator/production-evidence",
  meterageModel:"/api/operator/meterage-model",
  customerOutcomes:"/api/operator/customer-outcomes",
  backendHealth:"/api/operator/roadmap-backend-health",
  productionRuntime:"/api/operator/production-runtime-health",
} as const;

type SourceKey=keyof typeof ENDPOINTS;

export default function RoadmapReadinessClient(){
  const [sources,setSources]=useState<RoadmapReadinessInput>({});
  const [loading,setLoading]=useState(true);
  const [errors,setErrors]=useState<string[]>([]);

  async function load(){
    setLoading(true);
    const entries=Object.entries(ENDPOINTS) as Array<[SourceKey,string]>;
    const next:RoadmapReadinessInput={};
    const failures:string[]=[];
    let unauthorized=false;

    await Promise.all(entries.map(async ([key,url])=>{
      try{
        const response=await fetch(url,{cache:"no-store"});
        if(response.status===401){unauthorized=true;return;}
        const data=await response.json();
        if(!response.ok){
          failures.push(key);
          return;
        }
        next[key]=data;
      }catch{
        failures.push(key);
      }
    }));

    if(unauthorized){
      window.location.href="/operator/login?next=/operator/roadmap-readiness";
      return;
    }
    setSources(next);
    setErrors(failures);
    setLoading(false);
  }

  useEffect(()=>{void load();},[]);
  const summary=useMemo(()=>summarizeRoadmapReadiness(sources),[sources]);

  return <main className="roadmapReadiness">
    <header className="roadmapReadinessHero">
      <div>
        <span>LINEN EARTH / DEEP ENGINE / ROADMAP V2</span>
        <h1>Readiness Control Tower</h1>
        <p>One truthful view of the whole build. Engineering completion and real-world evidence are deliberately separated, so a missing physical or human proof can never be mistaken for missing code.</p>
      </div>
      <nav>
        <Link href="/operator">Operator Desk</Link>
        <Link href="/operator/evidence-sprint">Evidence Sprint</Link>
        <Link href="/designer-studio">Customer Designer</Link>
        <button type="button" onClick={()=>void load()} disabled={loading}>{loading?"Refreshing…":"Refresh evidence"}</button>
      </nav>
    </header>

    {errors.length>0&&<section className="roadmapReadinessNotice">
      <strong>Partial evidence view.</strong> {errors.length} source{errors.length===1?"":"s"} could not be loaded: {errors.join(", ")}. No phase is promoted from missing data.
    </section>}

    <section className="roadmapReadinessScore">
      <article data-pass={summary.allEngineeringComplete}><span>ENGINEERING</span><strong>{summary.engineeringComplete}/{summary.engineeringTotal}</strong><small>{summary.allEngineeringComplete?"all active roadmap engineering implemented":"engineering work still open"}</small></article>
      <article data-pass={summary.backendHealthy}><span>PRODUCTION BACKEND</span><strong>{summary.backendReadyCount}/{summary.backendTotal}</strong><small>{summary.backendHealthy?"live Supabase evidence contract verified":"production RPC contract incomplete or unavailable"}</small></article>
      <article data-pass={summary.productionRuntimeHealthy}><span>PRODUCTION RUNTIME</span><strong>{summary.productionRuntimeHealthy?"LIVE":"OPEN"}</strong><small>{summary.productionRuntimeHealthy?(summary.productionRuntimeCommit?.slice(0,8)+" · primary Vercel deployment"):"primary production deployment identity unavailable"}</small></article>
      <article data-pass={summary.allEvidenceComplete}><span>REAL EVIDENCE</span><strong>{summary.evidenceComplete}/{summary.evidenceTotal}</strong><small>physical, user, tailor, render and production proof</small></article>
      <article><span>PRODUCTION RULE</span><strong>{summary.allEvidenceComplete&&summary.backendHealthy&&summary.productionRuntimeHealthy?"REVIEW":"HOLD"}</strong><small>no customer claim is upgraded before its evidence, backend and production-runtime gates pass</small></article>
    </section>

    <section className="roadmapReadinessLegend">
      <span><i className="complete"/> Evidence complete</span>
      <span><i className="evidence"/> Engineering complete · evidence open</span>
      <span><i className="open"/> Engineering open</span>
      <span><i className="later"/> Intentionally later</span>
    </section>

    <section className="roadmapPhaseGrid" aria-live="polite">
      {summary.phases.map((item)=><article key={item.id} className="roadmapPhaseCard" data-status={item.status}>
        <div className="roadmapPhaseTop">
          <span>PHASE {item.phase}</span>
          <b>{item.status==="complete"?"COMPLETE":item.status==="evidence"?"EVIDENCE OPEN":item.status==="later"?"LATER":"OPEN"}</b>
        </div>
        <h2>{item.title}</h2>
        <div className="roadmapProgress" aria-label={`${item.progressPercent}% evidence progress`}><i style={{width:`${item.progressPercent}%`}}/></div>
        <p className="roadmapMetric">{item.metric}</p>
        <p className="roadmapBlocker">{item.blocker}</p>
        <footer>
          <span>{item.engineeringComplete?"ENGINEERING ✓":"ENGINEERING OPEN"}</span>
          <Link href={item.href}>Open gate ↗</Link>
        </footer>
      </article>)}
    </section>

    <section className="roadmapReadinessRule">
      <strong>What “complete” means here</strong>
      <p>A phase turns complete only when its engineering contract and documented evidence gate are satisfied. Phase 9 also requires the live production Supabase evidence contract and the primary Vercel production runtime to be verified. Phase 2 uses the owner/supplier physical-evidence policy instead of a software-invented threshold. Phase 10 remains deferred by roadmap design.</p>
    </section>
  </main>;
}
