"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildCrossViewIdentityStates } from "@/lib/designer/render-release-evidence";
import { deriveObservedRepeatMmFromFixture } from "@/lib/designer/render-outcome-metrics";

type Outcome={
  outcome_id:string;job_id:string;concept_id:string;view:string;shirt_id:string;pant_id:string;
  credits_used:number;cached:boolean;repair:boolean;qa_status:"pass"|"review"|null;
  human_status:"pending"|"approved"|"rejected";human_note:string;generated_at:string;created_at:string;
};
type Calibration={
  calibration_id:string;outcome_id:string;garment:"shirt"|"trouser";expected_repeat_mm:number;
  observed_repeat_mm:number;scale_error_pct:number;axis_status:"match"|"mismatch"|"not_applicable";
  note:string;measurement_method:"legacy_direct_mm"|"pixel_fixture_v2";
  reference_mm:number|null;reference_px:number|null;observed_repeat_px:number|null;created_at:string;
};
type IdentityReview={
  review_id:string;concept_id:string;status:"pass"|"fail";reviewed_views:string[];
  reviewer:string;note:string;created_at:string;
};
type ManualReviewSignoff={signoff_id:string;status:"approved"|"review";reviewer:string;note:string;created_at:string};
type CreditCap={
  event_id:string;credits_per_approved_cap:number;reviewer:string;note:string;created_at:string;
};
type Summary={
  total:number;generated:number;cached:number;reviewed:number;pending:number;approved:number;rejected:number;
  qaPass:number;totalCredits:number;approvalRate:number|null;creditsPerApproved:number|null;
};
type PatternSummary={total:number;pass:number;fail:number;passRate:number|null;averageScaleErrorPct:number|null};
type PatternCoverageSummary={requiredPairs:number;calibratedPairs:number;passedPairs:number;failedPairs:number;pendingPairs:number;missingTruthPairs:number;staleCalibrationPairs:number;legacyCalibrationPairs:number;gateComplete:boolean};
type PatternEvidence={patternType:string;patterned:boolean;verified:boolean;repeatMm:number|null};
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
  const [patternCoverageSummary,setPatternCoverageSummary]=useState<PatternCoverageSummary|null>(null);
  const [patternEvidenceByFabric,setPatternEvidenceByFabric]=useState<Record<string,PatternEvidence>>({});
  const [identityReviews,setIdentityReviews]=useState<IdentityReview[]>([]);
  const [identitySummary,setIdentitySummary]=useState<IdentitySummary|null>(null);
  const [creditCap,setCreditCap]=useState<CreditCap|null>(null);
  const [manualReviewSignoff,setManualReviewSignoff]=useState<ManualReviewSignoff|null>(null);
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
    setPatternCoverageSummary(data.patternCoverageSummary||null);
    setPatternEvidenceByFabric(data.patternEvidenceByFabric&&typeof data.patternEvidenceByFabric==="object"?data.patternEvidenceByFabric:{});
    setIdentityReviews(Array.isArray(data.identityReviews)?data.identityReviews:[]);
    setIdentitySummary(data.identitySummary||null);
    setCreditCap(data.creditCap||null);setManualReviewSignoff(data.manualReviewSignoff||null);
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

  async function calibratePattern(outcome:Outcome){
    const garmentRaw=(window.prompt("Garment to calibrate: shirt or trouser","shirt")||"").trim().toLowerCase();
    if(!["shirt","trouser"].includes(garmentRaw)) return;
    const fabricId=garmentRaw==="shirt"?outcome.shirt_id:outcome.pant_id;
    const evidence=patternEvidenceByFabric[fabricId];
    if(!evidence?.patterned){
      setMessage("The selected garment uses a solid fabric and does not require repeat calibration.");
      return;
    }
    if(!evidence.verified||!evidence.repeatMm){
      setMessage("Reviewed physical repeat evidence is missing for "+fabricId+". Approve it in Fabric Analyzer before final-render pattern QA.");
      return;
    }

    const referenceMm=Number(window.prompt(
      `Reviewed fabric repeat: ${evidence.repeatMm} mm. Enter a known physical reference length visible in this render (mm).`,
      "",
    ));
    if(!Number.isFinite(referenceMm)||referenceMm<=0) return;
    const referencePx=Number(window.prompt("Measure that same reference in the final render (pixels).",""));
    if(!Number.isFinite(referencePx)||referencePx<=0) return;
    const observedRepeatPx=Number(window.prompt("Measure one visible fabric repeat in the final render (pixels).",""));
    if(!Number.isFinite(observedRepeatPx)||observedRepeatPx<=0) return;

    const observedRepeatMm=deriveObservedRepeatMmFromFixture(referenceMm,referencePx,observedRepeatPx);
    const axisRaw=(window.prompt("Pattern axis: match, mismatch, or not_applicable","match")||"").trim().toLowerCase();
    if(!["match","mismatch","not_applicable"].includes(axisRaw)) return;
    const note=window.prompt(
      `Computed final-render repeat: ${observedRepeatMm.toFixed(2)} mm from raw pixel fixture evidence. Optional note:`,
      "",
    )||"";
    await post({
      action:"pattern_calibration",outcomeId:outcome.outcome_id,
      garment:garmentRaw,referenceMm,referencePx,observedRepeatPx,axisStatus:axisRaw,note,
    },`Pixel-fixture pattern calibration saved against reviewed ${evidence.repeatMm} mm fabric truth.`,outcome.outcome_id);
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

  async function saveManualReviewSignoff(status:"approved"|"review"){
    if(reviewer.trim().length<2){
      setMessage("Enter the named owner/reviewer before signing off the manual review workflow.");
      return;
    }
    if(status==="review"&&releaseNote.trim().length<3){
      setMessage("Add a short note explaining what remains before manual review can be approved.");
      return;
    }
    await post({
      action:"manual_review_signoff",status,reviewer:reviewer.trim(),note:releaseNote.trim(),
    },status==="approved"?"Manual final-render review workflow signed off.":"Manual review workflow kept open for follow-up.","manual-review-signoff");
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
      <article data-pass={patternCoverageSummary?.gateComplete===true}><small>PATTERN RELEASE COVERAGE</small><strong>{patternCoverageSummary?.requiredPairs?Math.round((patternCoverageSummary.passedPairs/patternCoverageSummary.requiredPairs)*100)+"%":"—"}</strong><span>{patternCoverageSummary?.passedPairs??0}/{patternCoverageSummary?.requiredPairs??0} approved patterned garment checks pass · {patternCoverageSummary?.pendingPairs??0} pending · {patternCoverageSummary?.missingTruthPairs??0} missing truth · {patternCoverageSummary?.staleCalibrationPairs??0} stale · {patternCoverageSummary?.legacyCalibrationPairs??0} legacy</span></article>
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
      <div className="renderQaIdentityTitle"><span>MANUAL REVIEW WORKFLOW</span><b>{manualReviewSignoff?.status==="approved"?"SIGNED OFF":manualReviewSignoff?.status==="review"?"REVIEW OPEN":"NOT SIGNED OFF"}</b></div>
      <p>Confirm that uncertain final renders will continue to receive human review before production release.</p>
      <div className="renderQaReleaseForm">
        <button disabled={busy==="manual-review-signoff"||reviewer.trim().length<2} onClick={()=>void saveManualReviewSignoff("approved")}>Approve manual review workflow</button>
        <button disabled={busy==="manual-review-signoff"||reviewer.trim().length<2} onClick={()=>void saveManualReviewSignoff("review")}>Keep workflow under review</button>
      </div>
      {manualReviewSignoff&&<small className="renderQaCapHistory">Latest workflow sign-off: {manualReviewSignoff.status} · {manualReviewSignoff.reviewer} · {new Date(manualReviewSignoff.created_at).toLocaleString("en-IN")}</small>}

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
          <small>{entry.expected_repeat_mm} mm physical → {entry.observed_repeat_mm} mm render · axis {entry.axis_status.replaceAll("_"," ")} · {entry.measurement_method==="pixel_fixture_v2"&&entry.reference_mm&&entry.reference_px&&entry.observed_repeat_px
            ? `fixture ${entry.reference_mm} mm/${entry.reference_px} px · repeat ${entry.observed_repeat_px} px`
            : "legacy direct-mm evidence"}</small>
        </div>)}
        <div className="renderQaPatternTruth">
          <small>SHIRT: {patternEvidenceByFabric[item.shirt_id]?.patterned
            ? patternEvidenceByFabric[item.shirt_id]?.verified
              ? `reviewed repeat ${patternEvidenceByFabric[item.shirt_id]?.repeatMm} mm`
              : "patterned · physical repeat not reviewed"
            : "solid / no repeat gate"}</small>
          <small>TROUSER: {patternEvidenceByFabric[item.pant_id]?.patterned
            ? patternEvidenceByFabric[item.pant_id]?.verified
              ? `reviewed repeat ${patternEvidenceByFabric[item.pant_id]?.repeatMm} mm`
              : "patterned · physical repeat not reviewed"
            : "solid / no repeat gate"}</small>
        </div>
        <button className="renderQaCalibrate" disabled={busy===item.outcome_id} onClick={()=>void calibratePattern(item)}>Add measured pattern check</button>
        <div className="renderQaReview">
          <strong>{item.human_status.toUpperCase()}</strong>
          {item.human_note&&<p>{item.human_note}</p>}
          {item.human_status==="pending"&&<div><button disabled={busy===item.outcome_id} onClick={()=>void review(item.outcome_id,"approved")}>Approve</button><button disabled={busy===item.outcome_id} onClick={()=>void review(item.outcome_id,"rejected")}>Reject</button></div>}
        </div>
      </article>)}
    </section>
  </main>;
}
