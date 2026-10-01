"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildCrossViewIdentityStates } from "@/lib/designer/render-release-evidence";

type Outcome={
  outcome_id:string;job_id:string;concept_id:string;view:string;shirt_id:string;pant_id:string;
  credits_used:number;cached:boolean;repair:boolean;qa_status:"pass"|"review"|null;
  human_status:"pending"|"approved"|"rejected";human_note:string;generated_at:string;created_at:string;
};
type Calibration={
  calibration_id:string;outcome_id:string;garment:"shirt"|"trouser";expected_repeat_mm:number;
  observed_repeat_mm:number;scale_error_pct:number;axis_status:"match"|"mismatch"|"not_applicable";
  note:string;created_at:string;
};
type IdentityReview={
  review_id:string;concept_id:string;status:"pass"|"fail";reviewed_views:string[];
  reviewer:string;note:string;created_at:string;
};
type CreditCap={
  event_id:string;credits_per_approved_cap:number;reviewer:string;note:string;created_at:string;
};
type Summary={
  total:number;generated:number;cached:number;reviewed:number;pending:number;approved:number;rejected:number;
  qaPass:number;totalCredits:number;approvalRate:number|null;creditsPerApproved:number|null;
};
type PatternSummary={total:number;pass:number;fail:number;passRate:number|null;averageScaleErrorPct:number|null};
type IdentitySummary={
  eligibleConcepts:number;reviewedConcepts:number;pendingConcepts:number;
  passedConcepts:number;failedConcepts:number;passRate:number|null;
};
type CreditCapSummary={configured:boolean;withinCap:boolean|null;ownerCap:number|null};


export default function RenderQaClient(){
  const [outcomes,setOutcomes]=useState<Outcome[]>([]);
  const [summary,setSummary]=useState<Summary|null>(null);
  const [calibrations,setCalibrations]=useState<Calibration[]>([]);
  const [patternSummary,setPatternSummary]=useState<PatternSummary|null>(null);
  const [identityReviews,setIdentityReviews]=useState<IdentityReview[]>([]);
  const [identitySummary,setIdentitySummary]=useState<IdentitySummary|null>(null);
  const [creditCap,setCreditCap]=useState<CreditCap|null>(null);
  const [creditCapSummary,setCreditCapSummary]=useState<CreditCapSummary|null>(null);
  const [reviewer,setReviewer]=useState("");
  const [creditCapInput,setCreditCapInput]=useState("");
  const [releaseNote,setReleaseNote]=useState("");
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/render-qa",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/render-qa";return;}
    const data=await response.json();
    if(!response.ok){setMessage(data.error||"Render QA could not be loaded.");return;}
    setOutcomes(Array.isArray(data.outcomes)?data.outcomes:[]);
    setSummary(data.summary||null);
    setCalibrations(Array.isArray(data.calibrations)?data.calibrations:[]);
    setPatternSummary(data.patternSummary||null);
    setIdentityReviews(Array.isArray(data.identityReviews)?data.identityReviews:[]);
    setIdentitySummary(data.identitySummary||null);
    setCreditCap(data.creditCap||null);
    setCreditCapSummary(data.creditCapSummary||null);
  }
  useEffect(()=>{void load();},[]);

  const identityStates=useMemo(
    ()=>buildCrossViewIdentityStates(outcomes,identityReviews),
    [outcomes,identityReviews],
  );

  async function post(body:Record<string,unknown>,success:string,busyKey:string){
    setBusy(busyKey);setMessage("");
    try{
      const response=await fetch("/api/operator/render-qa",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Render QA update failed.");
      setMessage(success);await load();return true;
    }catch(error){
      setMessage(error instanceof Error?error.message:"Render QA update failed.");
      return false;
    }finally{setBusy("");}
  }

  async function review(outcomeId:string,status:"approved"|"rejected"){
    const note=window.prompt(status==="approved"?"Optional approval note":"Why is this render rejected?")||"";
    await post({action:"review",outcomeId,status,note},"Render review saved.",outcomeId);
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
    await post({
      action:"pattern_calibration",outcomeId,
      garment:garmentRaw,expectedRepeatMm:expected,observedRepeatMm:observed,axisStatus:axisRaw,note,
    },"Physical pattern calibration saved.",outcomeId);
  }

  async function reviewIdentity(conceptId:string,status:"pass"|"fail"){
    if(reviewer.trim().length<2){
      setMessage("Enter the named owner/reviewer before recording cross-view identity evidence.");
      return;
    }
    await post({
      action:"identity_review",conceptId,status,reviewer:reviewer.trim(),note:releaseNote.trim(),
    },status==="pass"?"Cross-view identity pass recorded.":"Cross-view identity failure recorded.","identity:"+conceptId);
  }

  async function saveCreditCap(){
    const cap=Number(creditCapInput);
    if(!Number.isFinite(cap)||cap<=0){
      setMessage("Enter the owner-approved maximum credits per approved render.");
      return;
    }
    if(reviewer.trim().length<2){
      setMessage("Enter the named owner/reviewer before recording the commercial cap.");
      return;
    }
    const saved=await post({
      action:"credit_cap",cap,reviewer:reviewer.trim(),note:releaseNote.trim(),
    },"Owner-approved render credit cap recorded.","credit-cap");
    if(saved) setCreditCapInput("");
  }

  const capState=creditCapSummary?.withinCap===true
    ? "WITHIN CAP"
    : creditCapSummary?.withinCap===false
      ? "OVER CAP"
      : creditCapSummary?.configured
        ? "WAITING FOR APPROVAL EVIDENCE"
        : "CAP NOT SET";

  return <main className="renderQaDesk">
    <header className="renderQaHeader">
      <div>
        <span>LINEN EARTH / PRIVATE OPERATOR</span>
        <h1>Final Render QA</h1>
        <p>Track real provider credits, automated QA, physical pattern checks and human release evidence without changing the locked customer design.</p>
      </div>
      <nav><Link href="/operator">Operator Desk</Link><Link href="/operator/phase10-readiness">Readiness</Link></nav>
    </header>

    <section className="renderQaStats">
      <article><small>REVIEWED</small><strong>{summary?.reviewed??0}</strong><span>{summary?.pending??0} pending</span></article>
      <article><small>APPROVAL RATE</small><strong>{summary?.approvalRate==null?"—":summary.approvalRate+"%"}</strong><span>{summary?.approved??0} approved · {summary?.rejected??0} rejected</span></article>
      <article><small>TOTAL CREDITS</small><strong>{summary?.totalCredits??0}</strong><span>generated renders only</span></article>
      <article><small>CREDITS / APPROVED</small><strong>{summary?.creditsPerApproved??"—"}</strong><span>{capState.toLowerCase()}</span></article>
      <article><small>PATTERN SCALE QA</small><strong>{patternSummary?.passRate==null?"—":patternSummary.passRate+"%"}</strong><span>{patternSummary?.total??0} measured checks · avg error {patternSummary?.averageScaleErrorPct??"—"}%</span></article>
      <article><small>CROSS-VIEW IDENTITY</small><strong>{identitySummary?.passRate==null?"—":identitySummary.passRate+"%"}</strong><span>{identitySummary?.reviewedConcepts??0}/{identitySummary?.eligibleConcepts??0} eligible concepts reviewed</span></article>
      <article data-pass={creditCapSummary?.withinCap===true}><small>OWNER CREDIT CAP</small><strong>{creditCapSummary?.ownerCap??"—"}</strong><span>{capState.toLowerCase()}</span></article>
    </section>

    {message&&<p className="renderQaMessage">{message}</p>}

    <section className="renderQaRelease">
      <div className="renderQaReleaseHead">
        <div><span>RELEASE EVIDENCE</span><h2>Confirm identity and the owner-approved commercial boundary.</h2></div>
        <strong data-state={creditCapSummary?.withinCap===true?"pass":creditCapSummary?.withinCap===false?"fail":"open"}>{capState}</strong>
      </div>
      <p>Only real observations belong here. The system does not invent a cost cap or claim that two rendered views match until a named reviewer records it.</p>
      <div className="renderQaReleaseForm">
        <label>Named owner / reviewer<input value={reviewer} onChange={(event)=>setReviewer(event.target.value.slice(0,120))} placeholder="Owner / reviewer"/></label>
        <label>Max credits per approved render<input inputMode="decimal" value={creditCapInput} onChange={(event)=>setCreditCapInput(event.target.value.slice(0,20))} placeholder={creditCap?String(creditCap.credits_per_approved_cap):"Owner-approved cap"}/></label>
        <label className="wide">Evidence note<textarea rows={2} value={releaseNote} onChange={(event)=>setReleaseNote(event.target.value.slice(0,1000))} placeholder="Optional fixture, device, reviewer or decision note"/></label>
        <button disabled={busy==="credit-cap"} onClick={()=>void saveCreditCap()}>{busy==="credit-cap"?"Saving…":"Record owner-approved credit cap"}</button>
      </div>
      {creditCap&&<small className="renderQaCapHistory">Latest cap: {Number(creditCap.credits_per_approved_cap).toFixed(2)} credits/approved · {creditCap.reviewer} · {new Date(creditCap.created_at).toLocaleString("en-IN")}</small>}

      <div className="renderQaIdentityList">
        <div className="renderQaIdentityTitle"><span>CROSS-VIEW IDENTITY</span><b>{identitySummary?.passedConcepts??0} pass · {identitySummary?.failedConcepts??0} fail · {identitySummary?.pendingConcepts??0} pending</b></div>
        {!identityStates.length&&<p>No concept has two or more final-render views yet.</p>}
        {identityStates.map((state)=>{
          const staleLabel=state.staleReason==="render_changed"
            ? "New render recorded after the last identity review."
            : state.staleReason==="view_set_changed"
              ? "A new view needs identity review."
              : state.staleReason==="missing_review"
                ? "Identity review has not been recorded."
                : "";
          return <article key={state.conceptId} data-status={state.status}>
            <div>
              <b>{state.conceptId}</b>
              <small>{state.views.join(" · ")}</small>
              {staleLabel&&<small className="renderQaIdentityStale">{staleLabel}</small>}
            </div>
            <div className="renderQaIdentityDecision">
              <em>{state.status.toUpperCase()}</em>
              {state.review&&<small>{state.review.reviewer||"Reviewer"} · {new Date(state.review.created_at).toLocaleString("en-IN")}</small>}
              <div>
                <button disabled={busy==="identity:"+state.conceptId||reviewer.trim().length<2} onClick={()=>void reviewIdentity(state.conceptId,"pass")}>Identity matches</button>
                <button className="fail" disabled={busy==="identity:"+state.conceptId||reviewer.trim().length<2} onClick={()=>void reviewIdentity(state.conceptId,"fail")}>Identity mismatch</button>
              </div>
            </div>
          </article>;
        })}
      </div>
    </section>

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
