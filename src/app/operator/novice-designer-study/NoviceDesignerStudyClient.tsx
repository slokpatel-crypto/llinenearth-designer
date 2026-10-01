"use client";

import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import {
  summarizeNoviceDesignerStudy,
  type NoviceDesignerDevice,
  type NoviceDesignerAttemptRow,
  type NoviceDesignerDecisionRow,
} from "@/lib/designer/novice-designer-study";

const panel:React.CSSProperties={background:"#fff",border:"1px solid #ddd7cc",borderRadius:18,padding:20};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"11px 12px",border:"1px solid #cbc3b7",borderRadius:9,fontSize:14,background:"#fff"};
const button:React.CSSProperties={border:0,borderRadius:10,padding:"11px 15px",background:"#1a1a1a",color:"#fff",fontWeight:700,cursor:"pointer"};

function durationLabel(seconds:number|null){
  if(seconds===null||!Number.isFinite(seconds)) return "—";
  const minutes=Math.floor(seconds/60);
  const remainder=Math.round(seconds%60);
  return minutes?`${minutes}m ${remainder}s`:`${remainder}s`;
}

export default function NoviceDesignerStudyClient(){
  const [configured,setConfigured]=useState(true);
  const [attempts,setAttempts]=useState<NoviceDesignerAttemptRow[]>([]);
  const [decisions,setDecisions]=useState<NoviceDesignerDecisionRow[]>([]);
  const [caseId,setCaseId]=useState("");
  const [deviceClass,setDeviceClass]=useState<NoviceDesignerDevice>("mobile");
  const [minutes,setMinutes]=useState("");
  const [seconds,setSeconds]=useState("");
  const [noviceConfirmed,setNoviceConfirmed]=useState(true);
  const [likedDesignCompleted,setLikedDesignCompleted]=useState(false);
  const [blockingIssue,setBlockingIssue]=useState(false);
  const [note,setNote]=useState("");
  const [targetMinutes,setTargetMinutes]=useState("");
  const [targetSecondsRemainder,setTargetSecondsRemainder]=useState("");
  const [signedBy,setSignedBy]=useState("");
  const [decisionNote,setDecisionNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/novice-designer-study",{cache:"no-store"});
    if(response.status===401){
      window.location.href="/operator/login?next=/operator/novice-designer-study";
      return;
    }
    const data=await response.json();
    if(!response.ok){setMessage(data.error||"Novice study could not be loaded.");return;}
    setConfigured(data.configured!==false);
    setAttempts(Array.isArray(data.attempts)?data.attempts:[]);
    setDecisions(Array.isArray(data.decisions)?data.decisions:[]);
  }
  useEffect(()=>{void load();},[]);

  const summary=useMemo(()=>summarizeNoviceDesignerStudy(attempts,decisions),[attempts,decisions]);
  const latestAttempts=useMemo(()=>{
    const map=new Map<string,NoviceDesignerAttemptRow>();
    for(const row of [...attempts].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))){
      if(!map.has(row.case_id)) map.set(row.case_id,row);
    }
    return [...map.values()];
  },[attempts]);

  const observedSeconds=(Math.max(0,Number(minutes)||0)*60)+Math.max(0,Number(seconds)||0);
  const enteredTargetSeconds=(Math.max(0,Number(targetMinutes)||0)*60)+Math.max(0,Number(targetSecondsRemainder)||0);
  const decisionTargetSeconds=enteredTargetSeconds||summary.targetSeconds||0;

  async function post(body:Record<string,unknown>,success:string){
    if(busy) return false;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/operator/novice-designer-study",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Novice study evidence could not be saved.");
      setMessage(success);
      await load();
      return true;
    }catch(error){
      setMessage(error instanceof Error?error.message:"Novice study evidence could not be saved.");
      return false;
    }finally{setBusy(false);}
  }

  async function recordAttempt(){
    const saved=await post({
      action:"record_attempt",
      caseId,deviceClass,durationSeconds:observedSeconds,
      noviceConfirmed,likedDesignCompleted,blockingIssue,note,
    },"Observed novice Designer attempt recorded.");
    if(saved){
      setCaseId("");setMinutes("");setSeconds("");
      setLikedDesignCompleted(false);setBlockingIssue(false);setNote("");
    }
  }

  async function recordDecision(status:"approved"|"review"){
    await post({
      action:"record_decision",
      status,targetSeconds:decisionTargetSeconds,signedBy,note:decisionNote,
    },status==="approved"
      ?"Five-novice completion study approved against the documented target."
      :"Novice completion study kept in review.");
  }

  return <main style={{minHeight:"100vh",background:"#f8f6f0",color:"#1a1a1a",padding:"34px 18px"}}>
    <div style={{maxWidth:1080,margin:"0 auto",display:"grid",gap:18}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:20,flexWrap:"wrap"}}>
        <div>
          <p style={{fontSize:12,letterSpacing:2,margin:"0 0 8px"}}>LINEN EARTH / ROADMAP V2 / PHASE 3</p>
          <h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(34px,5vw,56px)",lineHeight:1,margin:"0 0 10px"}}>Novice Designer Completion Study</h1>
          <p style={{maxWidth:760,lineHeight:1.6,opacity:.72}}>Observe real first-time users making a design they like. Record actual elapsed time; enter the roadmap target from the approved planning document rather than guessing one in software.</p>
        </div>
        <nav style={{display:"flex",gap:12,flexWrap:"wrap"}}><Link href="/designer-studio">Open customer Designer</Link><Link href="/operator/preview-option-coverage">Preview Coverage</Link><Link href="/operator/phase10-readiness">Readiness</Link></nav>
      </header>

      {!configured&&<section style={{...panel,background:"#fff4df"}}>Novice-study migration is not installed yet.</section>}
      {message&&<section style={{...panel,background:"#ece8df"}}>{message}</section>}

      <section style={{...panel,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
        <article><small>UNIQUE CASES</small><div style={{fontSize:34,fontWeight:800}}>{summary.uniqueCases}</div></article>
        <article><small>LIKED DESIGN / CLEAN</small><div style={{fontSize:34,fontWeight:800}}>{summary.likedDesignCases}</div></article>
        <article><small>WITHIN TARGET</small><div style={{fontSize:34,fontWeight:800}}>{summary.targetSeconds?summary.withinTargetCases:"—"}<span style={{fontSize:16,opacity:.45}}>{summary.targetSeconds?" / 5":""}</span></div></article>
        <article><small>MEDIAN LIKED TIME</small><div style={{fontSize:27,fontWeight:800}}>{durationLabel(summary.medianLikedDesignSeconds)}</div></article>
        <article><small>DOCUMENTED TARGET</small><div style={{fontSize:27,fontWeight:800}}>{durationLabel(summary.targetSeconds)}</div></article>
        <article><small>GATE</small><div style={{fontSize:24,fontWeight:800}}>{summary.gateComplete?"COMPLETE":"OPEN"}</div></article>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(350px,1fr))",gap:18}}>
        <article style={panel}>
          <h2 style={{marginTop:0}}>1. Record an observed novice attempt</h2>
          <p style={{fontSize:13,opacity:.65,lineHeight:1.55}}>Use an anonymous ID only. Do not enter the tester’s name, email, phone number, measurements or other identifying information.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:11}}>
            <label><span>Anonymous case ID</span><input style={input} value={caseId} onChange={(e)=>setCaseId(e.target.value.slice(0,80))} placeholder="NOVICE-001"/></label>
            <label><span>Device</span><select style={input} value={deviceClass} onChange={(e)=>setDeviceClass(e.target.value as NoviceDesignerDevice)}><option value="mobile">Mobile</option><option value="tablet">Tablet</option><option value="desktop">Desktop</option></select></label>
            <label><span>Observed minutes</span><input style={input} type="number" min="0" max="120" value={minutes} onChange={(e)=>setMinutes(e.target.value)}/></label>
            <label><span>Extra seconds</span><input style={input} type="number" min="0" max="59" value={seconds} onChange={(e)=>setSeconds(e.target.value)}/></label>
            <label style={{gridColumn:"1/-1"}}><input type="checkbox" checked={noviceConfirmed} onChange={(e)=>setNoviceConfirmed(e.target.checked)}/> Tester was genuinely new to this Designer flow</label>
            <label style={{gridColumn:"1/-1"}}><input type="checkbox" checked={likedDesignCompleted} onChange={(e)=>setLikedDesignCompleted(e.target.checked)}/> Tester completed a design they said they liked</label>
            <label style={{gridColumn:"1/-1"}}><input type="checkbox" checked={blockingIssue} onChange={(e)=>setBlockingIssue(e.target.checked)}/> Blocking issue occurred</label>
            <label style={{gridColumn:"1/-1"}}><span>Observation note</span><textarea style={{...input,minHeight:90}} value={note} onChange={(e)=>setNote(e.target.value.slice(0,1200))} placeholder="Where they hesitated, what was confusing, or what worked smoothly."/></label>
          </div>
          <div style={{margin:"14px 0",padding:12,borderRadius:10,background:"#f3f0ea"}}>Observed completion time: <strong>{durationLabel(observedSeconds||null)}</strong></div>
          <button style={button} disabled={busy||caseId.trim().length<3||observedSeconds<1||observedSeconds>7200||(!note.trim()&&blockingIssue)} onClick={()=>void recordAttempt()}>{busy?"Saving…":"Record observed attempt"}</button>
        </article>

        <article style={panel}>
          <h2 style={{marginTop:0}}>2. Apply the documented roadmap target</h2>
          <p style={{fontSize:13,opacity:.65,lineHeight:1.55}}>The software deliberately has no default target. Enter the time specified in the approved roadmap or owner decision, then review the observed cases against it.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:11}}>
            <label><span>Target minutes</span><input style={input} type="number" min="0" max="120" value={targetMinutes} onChange={(e)=>setTargetMinutes(e.target.value)}/></label>
            <label><span>Extra seconds</span><input style={input} type="number" min="0" max="59" value={targetSecondsRemainder} onChange={(e)=>setTargetSecondsRemainder(e.target.value)}/></label>
            <label style={{gridColumn:"1/-1"}}><span>Owner / reviewer</span><input style={input} value={signedBy} onChange={(e)=>setSignedBy(e.target.value.slice(0,120))} placeholder="Named reviewer"/></label>
            <label style={{gridColumn:"1/-1"}}><span>Decision / target source note</span><textarea style={{...input,minHeight:100}} value={decisionNote} onChange={(e)=>setDecisionNote(e.target.value.slice(0,1200))} placeholder="Where the target comes from and what the observed tests show."/></label>
          </div>
          <div style={{margin:"14px 0",padding:12,borderRadius:10,background:"#f3f0ea"}}>Target used for this decision: <strong>{durationLabel(decisionTargetSeconds||null)}</strong>{summary.targetSeconds&&!enteredTargetSeconds&&<small style={{display:"block",opacity:.6,marginTop:4}}>Using latest recorded study target.</small>}</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button style={{...button,background:"#6b7a63"}} disabled={busy||decisionTargetSeconds<1||signedBy.trim().length<2||decisionNote.trim().length<3} onClick={()=>void recordDecision("review")}>Keep in review</button>
            <button style={button} disabled={busy||decisionTargetSeconds<1||signedBy.trim().length<2} onClick={()=>void recordDecision("approved")}>Approve five-case gate</button>
          </div>
          <p style={{fontSize:12,opacity:.62,lineHeight:1.55,marginTop:14}}>The database refuses approval unless five latest unique cases are confirmed novices, completed a liked design, had no blocking issue, and finished within this target.</p>
        </article>
      </section>

      <section style={panel}>
        <h2 style={{marginTop:0}}>Latest attempt per anonymous case</h2>
        <div style={{display:"grid",gap:10}}>
          {!latestAttempts.length&&<p style={{opacity:.65}}>No novice Designer observations recorded yet.</p>}
          {latestAttempts.slice(0,25).map((row)=>{
            const eligible=row.novice_confirmed&&row.liked_design_completed&&!row.blocking_issue;
            const within=Boolean(summary.targetSeconds&&eligible&&row.duration_seconds<=summary.targetSeconds);
            return <article key={row.case_id} style={{borderTop:"1px solid #ece6dc",paddingTop:10}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><strong>{row.case_id}</strong><b>{summary.targetSeconds?(within?"WITHIN TARGET":"REVIEW"):(eligible?"LIKED DESIGN":"REVIEW")}</b></div>
              <div style={{fontSize:12,opacity:.62,marginTop:4}}>{row.device_class} · {durationLabel(row.duration_seconds)} · {new Date(row.created_at).toLocaleString("en-IN")}</div>
              <div style={{fontSize:13,marginTop:6}}>Novice {row.novice_confirmed?"✓":"×"} · liked design {row.liked_design_completed?"✓":"×"} · blocking issue {row.blocking_issue?"yes":"no"}</div>
            </article>;
          })}
        </div>
      </section>
    </div>
  </main>;
}
