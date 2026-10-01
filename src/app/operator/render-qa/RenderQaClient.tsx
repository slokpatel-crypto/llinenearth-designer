"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Outcome={
  outcome_id:string;job_id:string;concept_id:string;view:string;shirt_id:string;pant_id:string;
  credits_used:number;cached:boolean;repair:boolean;qa_status:"pass"|"review"|null;
  human_status:"pending"|"approved"|"rejected";human_note:string;generated_at:string;
};
type Calibration={calibration_id:string;outcome_id:string;garment:"shirt"|"trouser";expected_repeat_mm:number;observed_repeat_mm:number;scale_error_pct:number;axis_status:"match"|"mismatch"|"not_applicable";note:string;created_at:string};

type Summary={
  total:number;generated:number;cached:number;reviewed:number;pending:number;approved:number;rejected:number;
  qaPass:number;totalCredits:number;approvalRate:number|null;creditsPerApproved:number|null;
};
type PatternSummary={total:number;pass:number;fail:number;passRate:number|null;averageScaleErrorPct:number|null};

export default function RenderQaClient(){
  const [outcomes,setOutcomes]=useState<Outcome[]>([]);
  const [summary,setSummary]=useState<Summary|null>(null);
  const [calibrations,setCalibrations]=useState<Calibration[]>([]);
  const [patternSummary,setPatternSummary]=useState<PatternSummary|null>(null);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/render-qa",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/render-qa";return;}
    const data=await response.json();
    if(response.ok){setOutcomes(data.outcomes||[]);setSummary(data.summary||null);setCalibrations(data.calibrations||[]);setPatternSummary(data.patternSummary||null);}
  }
  useEffect(()=>{void load();},[]);

  async function review(outcomeId:string,status:"approved"|"rejected"){
    setBusy(outcomeId);setMessage("");
    const note=window.prompt(status==="approved"?"Optional approval note":"Why is this render rejected?")||"";
    try{
      const response=await fetch("/api/operator/render-qa",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({outcomeId,status,note}),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Review failed.");
      setMessage("Render review saved.");await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Review failed.");}
    finally{setBusy("");}
  }

  async function calibratePattern(outcomeId:string){
    const garmentRaw=(window.prompt("Garment to calibrate: shirt or trouser","shirt")||"").trim().toLowerCase();
    if(!["shirt","trouser"].includes(garmentRaw)) return;
    const expected=Number(window.prompt("Measured physical repeat in mm",""));
    const observed=Number(window.prompt("Observed repeat on final render in mm",""));
    if(!Number.isFinite(expected)||expected<=0||!Number.isFinite(observed)||observed<=0) return;
    const axisRaw=(window.prompt("Pattern axis: match, mismatch, or not_applicable","match")||"").trim().toLowerCase();
    if(!["match","mismatch","not_applicable"].includes(axisRaw)) return;
    const note=window.prompt("Optional calibration note","")||"";
    setBusy(outcomeId);setMessage("");
    try{
      const response=await fetch("/api/operator/render-qa",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          action:"pattern_calibration",outcomeId,
          garment:garmentRaw,expectedRepeatMm:expected,observedRepeatMm:observed,axisStatus:axisRaw,note,
        }),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Pattern calibration failed.");
      setMessage("Physical pattern calibration saved.");await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Pattern calibration failed.");}
    finally{setBusy("");}
  }


  return <main className="renderQaDesk">
    <header className="renderQaHeader">
      <div><span>LINEN EARTH / PRIVATE OPERATOR</span><h1>Final Render QA</h1><p>Track real provider credits, automated QA and human approval. This is the evidence gate for approval rate and cost per approved render.</p></div>
      <nav><Link href="/operator">Operator Desk</Link><Link href="/operator/phase10-readiness">Readiness</Link></nav>
    </header>

    <section className="renderQaStats">
      <article><small>REVIEWED</small><strong>{summary?.reviewed??0}</strong><span>{summary?.pending??0} pending</span></article>
      <article><small>APPROVAL RATE</small><strong>{summary?.approvalRate==null?"—":summary.approvalRate+"%"}</strong><span>{summary?.approved??0} approved · {summary?.rejected??0} rejected</span></article>
      <article><small>TOTAL CREDITS</small><strong>{summary?.totalCredits??0}</strong><span>generated renders only</span></article>
      <article><small>CREDITS / APPROVED</small><strong>{summary?.creditsPerApproved??"—"}</strong><span>owner cost gate can be compared here</span></article>
      <article><small>PATTERN SCALE QA</small><strong>{patternSummary?.passRate==null?"—":patternSummary.passRate+"%"}</strong><span>{patternSummary?.total??0} measured checks · avg error {patternSummary?.averageScaleErrorPct??"—"}%</span></article>
    </section>

    {message&&<p className="renderQaMessage">{message}</p>}

    <section className="renderQaList">
      {!outcomes.length&&<p>No final render outcomes recorded yet.</p>}
      {outcomes.map((item)=><article key={item.outcome_id} data-status={item.human_status}>
        <div className="renderQaRecordHead"><b>{item.view.toUpperCase()} · {item.shirt_id} + {item.pant_id}</b><small>{new Date(item.generated_at).toLocaleString("en-IN")}</small></div>
        <div className="renderQaRecordMeta">
          <span>QA <strong>{item.qa_status||"pending"}</strong></span>
          <span>Credits <strong>{Number(item.credits_used).toFixed(2)}</strong></span>
          <span>{item.repair?"REPAIR":"ORIGINAL"}</span>
          <span>{item.cached?"CACHED":"GENERATED"}</span>
        </div>
        <small>{item.job_id}</small>
        {calibrations.filter((entry)=>entry.outcome_id===item.outcome_id).slice(0,2).map((entry)=><div key={entry.calibration_id} className="renderQaCalibration">
          <span>{entry.garment.toUpperCase()} PATTERN</span>
          <b>{Number(entry.scale_error_pct).toFixed(1)}% scale error</b>
          <small>{entry.expected_repeat_mm} mm physical → {entry.observed_repeat_mm} mm render · axis {entry.axis_status.replaceAll("_"," ")}</small>
        </div>)}
        <button className="renderQaCalibrate" disabled={busy===item.outcome_id} onClick={()=>void calibratePattern(item.outcome_id)}>Add measured pattern check</button>
        <div className="renderQaReview">
          <strong>{item.human_status.toUpperCase()}</strong>
          {item.human_note&&<p>{item.human_note}</p>}
          {item.human_status==="pending"&&<div><button disabled={busy===item.outcome_id} onClick={()=>void review(item.outcome_id,"approved")}>Approve</button><button disabled={busy===item.outcome_id} onClick={()=>void review(item.outcome_id,"rejected")}>Reject</button></div>}
        </div>
      </article>)}
    </section>
  </main>;
}
