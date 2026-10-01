"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  LAUNCH_BETA_TARGET,
  LAUNCH_CHECKLIST_ITEMS,
  summarizeLaunchReadiness,
  type LaunchChecklistItemId,
  type LaunchDeviceClass,
} from "@/lib/designer/launch-readiness-evidence";

type BetaAttempt={
  attempt_id:string;case_id:string;device_class:string;core_flow_completed:boolean;
  design_locked:boolean;share_or_enquiry_completed:boolean;
  blocking_bug:boolean;note:string;revision_id?:string|null;recipe_hash?:string|null;evidence_kind?:string|null;share_audit_confirmed?:boolean;enquiry_audit_confirmed?:boolean;created_at:string;
};
type ChecklistEvent={
  event_id:string;item_id:string;status:"approved"|"review";signed_by:string;note:string;created_at:string;
};

export default function LaunchReadinessClient(){
  const [betaAttempts,setBetaAttempts]=useState<BetaAttempt[]>([]);
  const [checklistEvents,setChecklistEvents]=useState<ChecklistEvent[]>([]);
  const [configured,setConfigured]=useState(true);
  const [caseId,setCaseId]=useState("");
  const [deviceClass,setDeviceClass]=useState<LaunchDeviceClass>("mobile");
  const [revisionId,setRevisionId]=useState("");
  const [evidenceKind,setEvidenceKind]=useState<"share"|"enquiry">("share");
  const [blockingBug,setBlockingBug]=useState(false);
  const [betaNote,setBetaNote]=useState("");
  const [signedBy,setSignedBy]=useState("");
  const [checklistNotes,setChecklistNotes]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/launch-readiness",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/launch-readiness";return;}
    const data=await response.json();
    if(!response.ok){setMessage(data.error||"Launch readiness could not be loaded.");return;}
    setConfigured(data.configured!==false);
    setBetaAttempts(Array.isArray(data.betaAttempts)?data.betaAttempts:[]);
    setChecklistEvents(Array.isArray(data.checklistEvents)?data.checklistEvents:[]);
  }
  useEffect(()=>{void load();},[]);

  const summary=useMemo(()=>summarizeLaunchReadiness(betaAttempts,checklistEvents),[betaAttempts,checklistEvents]);
  const latestBeta=useMemo(()=>{
    const map=new Map<string,BetaAttempt>();
    for(const row of betaAttempts){
      if(!map.has(row.case_id)) map.set(row.case_id,row);
    }
    return [...map.values()];
  },[betaAttempts]);
  const latestChecklist=useMemo(()=>{
    const map=new Map<string,ChecklistEvent>();
    for(const row of checklistEvents){
      if(!map.has(row.item_id)) map.set(row.item_id,row);
    }
    return map;
  },[checklistEvents]);

  async function post(body:Record<string,unknown>,success:string){
    if(busy) return false;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/operator/launch-readiness",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Launch-readiness evidence could not be saved.");
      setMessage(success);await load();return true;
    }catch(error){
      setMessage(error instanceof Error?error.message:"Launch-readiness evidence could not be saved.");
      return false;
    }finally{setBusy(false);}
  }

  async function recordBeta(){
    const saved=await post({
      action:"record_verified_beta",caseId,deviceClass,revisionId,evidenceKind,blockingBug,note:betaNote,
    },`Verified lock → ${evidenceKind} customer-flow attempt recorded.`);
    if(saved){setCaseId("");setRevisionId("");setBlockingBug(false);setBetaNote("");}
  }

  async function recordChecklist(itemId:LaunchChecklistItemId,status:"approved"|"review"){
    await post({
      action:"checklist",itemId,status,signedBy,note:checklistNotes[itemId]||"",
    },status==="approved"?"Human sign-off recorded.":"Checklist item kept in review.");
  }

  const betaValid=/^[A-Za-z0-9._-]{3,80}$/.test(caseId.trim())&&revisionId.trim().length>=3&&(!blockingBug||betaNote.trim().length>=3);

  return <main className="launchReady">
    <header className="launchReadyHeader">
      <div>
        <span>LINEN EARTH / ROADMAP V2 / PHASE 9</span>
        <h1>Launch Evidence</h1>
        <p>Record real lock → share/enquiry customer-flow outcomes and human launch sign-offs. A beta case only qualifies when the server can find a verified share or enquiry audit created after the locked recipe passed integrity verification.</p>
      </div>
      <nav><Link href="/operator/device-qa">Device QA</Link><Link href="/operator/phase10-readiness">Readiness</Link><Link href="/operator">Operator Desk</Link></nav>
    </header>

    {!configured&&<section className="launchReadyNotice">Launch-readiness migration is not installed yet.</section>}
    {message&&<section className="launchReadyNotice">{message}</section>}

    <section className="launchReadyScore">
      <article data-pass={summary.betaGateComplete}><span>LOCK → VERIFIED SHARE/ENQUIRY</span><strong>{summary.successfulBetaCases}/{LAUNCH_BETA_TARGET}</strong><small>latest case has a verified server flow audit and no blocking bug</small></article>
      <article data-alert={summary.blockingBetaCases>0}><span>BLOCKING CASES</span><strong>{summary.blockingBetaCases}</strong><small>latest beta outcomes still blocked</small></article>
      <article><span>DEVICE COVERAGE</span><strong>{summary.deviceCoverage.length}/3</strong><small>{summary.deviceCoverage.join(" · ")||"no successful beta devices yet"}</small></article>
      <article data-pass={summary.checklistGateComplete}><span>HUMAN SIGN-OFF</span><strong>{summary.checklistApproved}/{summary.checklistTotal}</strong><small>privacy / commercial / operational launch checks</small></article>
      <article data-pass={summary.launchEvidenceComplete}><span>EVIDENCE GATE</span><strong>{summary.launchEvidenceComplete?"PROVED":"OPEN"}</strong><small>deployment readiness is still a separate gate</small></article>
    </section>

    <section className="launchReadyGrid">
      <article className="launchReadyPanel">
        <span>01 / PRIVATE BETA</span><h2>Record a verified lock → share/enquiry attempt.</h2>
        <p className="launchReadyRule">Use an anonymous case ID only. In Designer, lock the exact recipe and either create its private share link or open the locked-look WhatsApp enquiry. Paste that locked revision ID here; the server rejects the beta record unless the matching verified audit exists.</p>
        <div className="launchReadyPair">
          <label>Anonymous case ID<input value={caseId} onChange={(event)=>setCaseId(event.target.value.slice(0,80))} placeholder="BETA-001"/></label>
          <label>Device<select value={deviceClass} onChange={(event)=>setDeviceClass(event.target.value as LaunchDeviceClass)}><option value="mobile">Mobile</option><option value="tablet">Tablet</option><option value="desktop">Desktop</option></select></label>
          <label>Verified action<select value={evidenceKind} onChange={(event)=>setEvidenceKind(event.target.value as "share"|"enquiry")}><option value="share">Private share link</option><option value="enquiry">Locked-look WhatsApp enquiry</option></select></label>
        </div>
        <label>Locked revision ID<input value={revisionId} onChange={(event)=>setRevisionId(event.target.value.slice(0,180))} placeholder="REV-…"/></label>
        <p className="launchReadyRule">Only a share or locked-look enquiry created by the verified locked-design APIs can satisfy this evidence gate. Old checkbox-only beta records stay historical and do not count.</p>
        <label className="launchReadyCheck danger"><input type="checkbox" checked={blockingBug} onChange={(event)=>setBlockingBug(event.target.checked)}/> Blocking bug occurred</label>
        <label>Observed note<textarea rows={4} value={betaNote} onChange={(event)=>setBetaNote(event.target.value.slice(0,1200))} placeholder="What blocked or what was verified on the real flow?"/></label>
        <button disabled={!configured||busy||!betaValid} onClick={()=>void recordBeta()}>{busy?"Saving…":"Record beta attempt"}</button>

        <div className="launchBetaHistory">
          <div><span>LATEST UNIQUE CASES</span><b>{latestBeta.length}</b></div>
          {!latestBeta.length&&<p>No private-beta evidence recorded yet.</p>}
          {latestBeta.slice(0,12).map((row)=>{const verifiedFlow=row.share_audit_confirmed||row.enquiry_audit_confirmed;return <section key={row.case_id} data-pass={row.core_flow_completed&&row.design_locked&&row.share_or_enquiry_completed&&verifiedFlow&&!row.blocking_bug}>
            <div><b>{row.case_id}</b><em>{row.core_flow_completed&&row.design_locked&&row.share_or_enquiry_completed&&verifiedFlow&&!row.blocking_bug?"PASS":"REVIEW"}</em></div>
            <small>{row.device_class} · verified {verifiedFlow?(row.evidence_kind||"flow"):"legacy/manual"} · {row.revision_id||"no revision evidence"} · {new Date(row.created_at).toLocaleString("en-IN")}</small>
            {row.note&&<p>{row.note}</p>}
          </section>})}
        </div>
      </article>

      <article className="launchReadyPanel">
        <span>02 / HUMAN LAUNCH CHECKLIST</span><h2>Sign off what code cannot decide.</h2>
        <label>Signer / reviewer<input value={signedBy} onChange={(event)=>setSignedBy(event.target.value.slice(0,120))} placeholder="Owner / reviewer"/></label>
        <div className="launchChecklist">
          {LAUNCH_CHECKLIST_ITEMS.map((item)=>{
            const latest=latestChecklist.get(item.id);
            return <section key={item.id} data-status={latest?.status||"pending"}>
              <div><b>{item.label}</b><em>{latest?.status||"pending"}</em></div>
              <p>{item.detail}</p>
              {latest&&<small>Latest: {latest.signed_by} · {new Date(latest.created_at).toLocaleString("en-IN")}</small>}
              <textarea rows={2} value={checklistNotes[item.id]||""} onChange={(event)=>setChecklistNotes((current)=>({...current,[item.id]:event.target.value.slice(0,1200)}))} placeholder="Review note / issue if still open"/>
              <div>
                <button className="review" disabled={busy||signedBy.trim().length<2||(checklistNotes[item.id]||"").trim().length<3} onClick={()=>void recordChecklist(item.id,"review")}>Keep in review</button>
                <button disabled={busy||signedBy.trim().length<2} onClick={()=>void recordChecklist(item.id,"approved")}>Record approved</button>
              </div>
            </section>;
          })}
        </div>
        <p className="launchReadyRule">This is an operational checklist, not legal advice. Human review remains required before public launch.</p>
      </article>
    </section>
  </main>;
}
