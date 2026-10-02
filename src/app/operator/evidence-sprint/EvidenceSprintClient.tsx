"use client";

import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { buildEvidenceSprint } from "@/lib/designer/evidence-sprint";
import type { RoadmapReadinessInput } from "@/lib/designer/roadmap-readiness";

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

function TrackLabel({track}:{track:string}){
  const label=track==="physical"?"PHYSICAL PROOF":track==="customer"?"CUSTOMER VALIDATION":track==="render"?"RENDER QA":track==="production"?"PRODUCTION":track==="learning"?"CLOSED LOOP":track.toUpperCase();
  return <span className="evidenceSprintTrack">{label}</span>;
}

export default function EvidenceSprintClient(){
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
        if(response.ok) next[key]=data;
        else failures.push(key);
      }catch{failures.push(key);}
    }));
    if(unauthorized){
      window.location.href="/operator/login?next=/operator/evidence-sprint";
      return;
    }
    setSources(next);
    setErrors(failures);
    setLoading(false);
  }

  useEffect(()=>{void load();},[]);
  const sprint=useMemo(()=>buildEvidenceSprint(sources),[sources]);

  return <main className="evidenceSprint">
    <header className="evidenceSprintHero">
      <div>
        <span>LINEN EARTH / ROADMAP V2 / REAL EVIDENCE</span>
        <h1>Evidence Sprint</h1>
        <p>The remaining work is no longer “more code.” This desk turns the open roadmap gates into a concrete collection sequence without inventing cloth, customer, tailor or production evidence.</p>
      </div>
      <nav>
        <Link href="/operator/roadmap-readiness">Readiness Control Tower</Link>
        <Link href="/operator">Operator Desk</Link>
        <button type="button" onClick={()=>void load()} disabled={loading}>{loading?"Refreshing…":"Refresh"}</button>
      </nav>
    </header>

    {errors.length>0&&<section className="evidenceSprintNotice">
      <strong>Partial evidence view.</strong> {errors.length} source{errors.length===1?"":"s"} could not be loaded: {errors.join(", ")}. Missing data never marks a task complete.
    </section>}

    <section className="evidenceSprintScore">
      <article><span>REAL-EVIDENCE WORKFLOWS</span><strong>{sprint.completeCount}/{sprint.total}</strong><small>completed against current server evidence</small></article>
      <article><span>DO NOW</span><strong>{sprint.now.length}</strong><small>independent gates that can be worked immediately</small></article>
      <article><span>PARALLEL</span><strong>{sprint.parallel.length}</strong><small>work can continue, but promotion waits on a dependency</small></article>
      <article><span>LATER</span><strong>{sprint.later.length}</strong><small>requires earlier customer / production evidence first</small></article>
    </section>

    <section className="evidenceSprintNext">
      <div className="evidenceSprintSectionHead">
        <span>NEXT THREE</span>
        <h2>Highest-leverage evidence to collect</h2>
      </div>
      <div className="evidenceSprintNextGrid">
        {sprint.next.map((item,index)=><article key={item.id}>
          <div className="evidenceSprintIndex">0{index+1}</div>
          <TrackLabel track={item.track}/>
          <h3>Phase {item.phase} · {item.title}</h3>
          <p>{item.action}</p>
          <small>{item.proof}</small>
          <Link href={item.href}>Open evidence workflow ↗</Link>
        </article>)}
        {!loading&&sprint.next.length===0&&<article className="evidenceSprintClear"><h3>No immediate evidence task is open.</h3><p>Review the later queue or Roadmap Readiness for remaining post-order work.</p></article>}
      </div>
    </section>

    <section className="evidenceSprintQueue">
      <div className="evidenceSprintSectionHead">
        <span>FULL QUEUE</span>
        <h2>Roadmap evidence sequence</h2>
      </div>
      <div className="evidenceSprintList">
        {sprint.items.map((item)=><article key={item.id} data-state={item.complete?"complete":item.availability}>
          <div className="evidenceSprintPhase">P{item.phase}</div>
          <div className="evidenceSprintCopy">
            <div><TrackLabel track={item.track}/><b>{item.complete?"COMPLETE":item.availability==="now"?"DO NOW":item.availability==="parallel"?"PARALLEL":"LATER"}</b></div>
            <h3>{item.title}</h3>
            <p>{item.action}</p>
            <small>{item.proof}</small>
          </div>
          <div className="evidenceSprintProgress">
            <strong>{item.progressPercent}%</strong>
            <div><i style={{width:item.progressPercent+"%"}}/></div>
            <Link href={item.href}>{item.complete?"Review evidence":"Open workflow"} ↗</Link>
          </div>
        </article>)}
      </div>
    </section>

    <section className="evidenceSprintRule">
      <strong>Evidence boundary</strong>
      <p>This page only sequences existing Roadmap v2 gates. It never converts model inference, operator convenience clicks, duplicate customer cases or provenance-free rows into verified evidence.</p>
    </section>
  </main>;
}
