"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Outcome={
  outcome_id:string;job_id:string;concept_id:string;view:string;shirt_id:string;pant_id:string;
  credits_used:number;cached:boolean;repair:boolean;qa_status:"pass"|"review"|null;
  human_status:"pending"|"approved"|"rejected";human_note:string;generated_at:string;
};
type Calibration={calibration_id:string;outcome_id:string;garment:"shirt"|"trouser";expected_repeat_mm:number;observed_repeat_mm:number;scale_error_pct:number;axis_status:"match"|"mismatch"|"not_applicable";note:string;created_at:string};
type IdentityReview={review_id:string;concept_id:string;status:"pass"|"fail";reviewed_views:string[];reviewer:string;note:string;created_at:string};
type CreditCap={event_id:string;credits_per_approved_cap:number;reviewer:string;note:string;created_at:string}|null;

type Summary={
  total:number;generated:number;cached:number;reviewed:number;pending:number;approved:number;rejected:number;
  qaPass:number;totalCredits:number;approvalRate:number|null;creditsPerApproved:number|null;
};
type PatternSummary={total:number;pass:number;fail:number;passRate:number|null;averageScaleErrorPct:number|null};
type IdentitySummary={eligibleConcepts:number;reviewedConcepts:number;pendingConcepts:number;passedConcepts:number;failedConcepts:number;passRate:number|null};
type CreditCapSummary={configured:boolean;withinCap:boolean|null;ownerCap:number|null};

export default function RenderQaClient(){
  const [outcomes,setOutcomes]=useState<Outcome[]>([]);
  const [summary,setSummary]=useState<Summary|null>(null);
  const [calibrations,setCalibrations]=useState<Calibration[]>([]);
  const [patternSummary,setPatternSummary]=useState<PatternSummary|null>(null);
  const [identityReviews,setIdentityReviews]=useState<IdentityReview[]>([]);
  const [identitySummary,setIdentitySummary]=useState<IdentitySummary|null>(null);
  const [creditCap,setCreditCap]=useState<CreditCap>(null);
  const [creditCapSummary,setCreditCapSummary]=useState<CreditCapSummary|null>(null);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/render-qa",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/render-qa";return;}
    const data=await response.json();
    if(response.ok){
      setOutcomes(data.outcomes||[]);
      setSummary(data.summary||null);
      setCalibrations(data.calibrations||[]);
      setPatternSummary(data.patternSummary||null);
      setIdentityReviews(data.identityReviews||[]);
      setIdentitySummary(data.identitySummary||null);
      setCreditCap(data.creditCap||null);
      setCreditCapSummary(data.creditCapSummary||null);
    }
  }
  useEffect(()=>{void load();},[]);

  const conceptGroups=useMemo(()=>{
    const groups=new Map<string,Outcome[]>();
    for(const item of outcomes){
      const list=groups.get(item.concept_id)||[];
      list.push(item);groups.set(item.concept_id,list);
    }
    return [...groups.entries()]
      .map(([conceptId,items])=>({conceptId,items,views:[...new Set(items.map(item=>item.view))]}))
      .filter(group=>group.views.length>=2);
  },[outcomes]);

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

  async function reviewIdentity(conceptId:string,status:"pass"|"fail"){
    const reviewer=(window.prompt("Reviewer / approver initials or name","")||"").trim();
    if(!reviewer) return;
    const note=window.prompt(status==="pass"?"Optional cross-view identity note":"Describe the identity mismatch","")||"";
    setBusy("identity:"+conceptId);setMessage("");
    try{
      const response=await fetch("/api/operator/render-qa",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"identity_review",conceptId,status,reviewer,note}),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Identity review failed.");
      setMessage("Cross-view identity evidence saved.");await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Identity review failed.");}
    finally{setBusy("");}
  }

  async function setOwnerCreditCap(){
    const raw=window.prompt("Owner-approved maximum provider credits per approved render",creditCap?String(creditCap.credits_per_approved_cap):"");
    if(raw===null) return;
    const cap=Number(raw);
    if(!Number.isFinite(cap)||cap<=0) return;
    const reviewer=(window.prompt("Owner / reviewer name or initials","")||"").trim();
    if(!reviewer) return;
    const note=window.prompt("Optional commercial cap note","")||"";
    setBusy("credit-cap");setMessage("");
    try{
      const response=await fetch("/api/operator/render-qa",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"credit_cap",cap,reviewer,note}),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Credit cap could not be saved.");
      setMessage("Owner-approved render credit cap saved.");await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Credit cap could not be saved.");}
    finally{setBusy("");}
  }

  return <main className="renderQaDesk">
    <header className="renderQaHeader">
      <div><span>LINEN EARTH / PRIVATE OPERATOR</span><h1>Final Render QA</h1><p>Track real provider credits, automated QA, human approval, physical pattern checks and cross-view identity evidence.</p></div>
      <nav><Link href="/operator">Operator Desk</Link><Link href="/operator/phase10-readiness">Readiness</Link></nav>
    </header>

    <section className="renderQaStats">
      <article><small>REVIEWED</small><strong>{summary?.reviewed??0}</strong><span>{summary?.pending??0} pending</span></article>
      <article><small>APPROVAL RATE</small><strong>{summary?.approvalRate==null?"—":summary.approvalRate+"%"}</strong><span>{summary?.approved??0} approved · {summary?.rejected??0} rejected</span></article>
      <article><small>TOTAL CREDITS</small><strong>{summary?.totalCredits??0}</strong><span>generated renders only</span></article>
      <article><small>CREDITS / APPROVED</small><strong>{summary?.creditsPerApproved??"—"}</strong><span>{creditCapSummary?.configured?(creditCapSummary.withinCap===null?"owner cap set · awaiting evidence":creditCapSummary.withinCap?"within owner cap":"above owner cap"):"owner cap not entered"}</span></article>
      <article><small>PATTERN SCALE QA</small><strong>{patternSummary?.passRate==null?"—":patternSummary.passRate+"%"}</strong><span>{patternSummary?.total??0} measured checks · avg error {patternSummary?.averageScaleErrorPct??"—"}%</span></article>
      <article><small>CROSS-VIEW IDENTITY</small><strong>{identitySummary?.passRate==null?"—":identitySummary.passRate+"%"}</strong><span>{identitySummary?.reviewedConcepts??0}/{identitySummary?.eligibleConcepts??0} multi-view concepts reviewed</span></article>
    </section>

    <section className="renderQaList">
      <article>
        <div className="renderQaRecordHead"><b>OWNER COMMERCIAL CAP</b><small>{creditCap?new Date(creditCap.created_at).toLocaleString("en-IN"):"not configured"}</small></div>
        <div className="renderQaRecordMeta">
          <span>Cap <strong>{creditCap?Number(creditCap.credits_per_approved_cap).toFixed(4):"—"}</strong></span>
          <span>Current <strong>{summary?.creditsPerApproved??"—"}</strong></span>
          <span>{creditCapSummary?.withinCap===true?"WITHIN CAP":creditCapSummary?.withinCap===false?"ABOVE CAP":"NOT YET DECIDABLE"}</span>
        </div>
        {creditCap?.reviewer&&<small>Approved by {creditCap.reviewer}</small>}
        <button className="renderQaCalibrate" disabled={busy==="credit-cap"} onClick={()=>void setOwnerCreditCap()}>Record owner-approved credit cap</button>
      </article>
    </section>

    <section className="renderQaList">
      <h2>Cross-view identity evidence</h2>
      {!conceptGroups.length&&<p>No concept has at least two final-render views yet.</p>}
      {conceptGroups.map(group=>{
        const latest=identityReviews.find(review=>review.concept_id===group.conceptId);
        return <article key={group.conceptId} data-status={latest?.status==="pass"?"approved":latest?.status==="fail"?"rejected":"pending"}>
          <div className="renderQaRecordHead"><b>{group.conceptId}</b><small>{group.views.join(" · ")}</small></div>
          <div className="renderQaRecordMeta">
            <span>Views <strong>{group.views.length}</strong></span>
            <span>Identity <strong>{latest?.status?.toUpperCase()||"PENDING"}</strong></span>
            {latest?.reviewer&&<span>Reviewer <strong>{latest.reviewer}</strong></span>}
          </div>
          {latest?.note&&<p>{latest.note}</p>}
          <div className="renderQaReview"><div>
            <button disabled={busy==="identity:"+group.conceptId} onClick={()=>void reviewIdentity(group.conceptId,"pass")}>Identity matches</button>
            <button disabled={busy==="identity:"+group.conceptId} onClick={()=>void reviewIdentity(group.conceptId,"fail")}>Identity mismatch</button>
          </div></div>
        </article>;
      })}
    </section>

    {message&&<p className="renderQaMessage">{message}</p>}

    <section className="renderQaList">
      <h2>Individual render evidence</h2>
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
