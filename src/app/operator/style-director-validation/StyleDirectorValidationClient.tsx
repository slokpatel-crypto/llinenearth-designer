"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  summarizeStyleDirectorValidation,
  type StyleDirectorValidationDevice,
} from "@/lib/designer/style-director-validation";

type TestRow={
  attempt_id:string;case_id:string;device_class:string;
  directions_understandable:boolean;directions_distinct:boolean;
  stock_handoff_worked:boolean;handoff_audit_id?:string|null;blocking_issue:boolean;note:string;created_at:string;
};
type SignoffRow={event_id:string;status:string;required_positive_cases?:number|null;signed_by:string;note:string;created_at:string};

const panel:React.CSSProperties={background:"#fff",border:"1px solid #ddd7cc",borderRadius:18,padding:20};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"11px 12px",border:"1px solid #cbc3b7",borderRadius:9,fontSize:14,background:"#fff"};
const button:React.CSSProperties={border:0,borderRadius:10,padding:"11px 15px",background:"#1a1a1a",color:"#fff",fontWeight:700,cursor:"pointer"};

export default function StyleDirectorValidationClient(){
  const [tests,setTests]=useState<TestRow[]>([]);
  const [signoffs,setSignoffs]=useState<SignoffRow[]>([]);
  const [configured,setConfigured]=useState(true);
  const [caseId,setCaseId]=useState("");
  const [deviceClass,setDeviceClass]=useState<StyleDirectorValidationDevice>("mobile");
  const [understandable,setUnderstandable]=useState(false);
  const [distinct,setDistinct]=useState(false);
  const [handoff,setHandoff]=useState(false);
  const [handoffAuditId,setHandoffAuditId]=useState("");
  const [blocking,setBlocking]=useState(false);
  const [note,setNote]=useState("");
  const [signedBy,setSignedBy]=useState("");
  const [requiredPositiveCases,setRequiredPositiveCases]=useState("");
  const [signoffNote,setSignoffNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/style-director-validation",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/style-director-validation";return;}
    const data=await response.json();
    if(!response.ok){setMessage(data.error||"Validation evidence could not be loaded.");return;}
    setConfigured(data.configured!==false);
    setTests(Array.isArray(data.tests)?data.tests:[]);
    setSignoffs(Array.isArray(data.signoffs)?data.signoffs:[]);
  }
  useEffect(()=>{void load();},[]);

  const summary=useMemo(()=>summarizeStyleDirectorValidation(tests,signoffs),[tests,signoffs]);
  const latestTests=useMemo(()=>{
    const map=new Map<string,TestRow>();
    for(const row of tests) if(!map.has(row.case_id)) map.set(row.case_id,row);
    return [...map.values()];
  },[tests]);

  async function post(body:Record<string,unknown>,success:string){
    if(busy) return false;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/operator/style-director-validation",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Validation evidence could not be saved.");
      setMessage(success);await load();return true;
    }catch(error){
      setMessage(error instanceof Error?error.message:"Validation evidence could not be saved.");
      return false;
    }finally{setBusy(false);}
  }

  async function recordTest(){
    const saved=await post({
      action:"record_test",caseId,deviceClass,
      directionsUnderstandable:understandable,
      directionsDistinct:distinct,
      stockHandoffWorked:handoff,
      handoffAuditId,
      blockingIssue:blocking,
      note,
    },"Style Director real-user test recorded.");
    if(saved){
      setCaseId("");setUnderstandable(false);setDistinct(false);setHandoff(false);setHandoffAuditId("");setBlocking(false);setNote("");
    }
  }

  async function signoff(status:"approved"|"review"){
    await post({
      action:"signoff",status,requiredPositiveCases:Number(requiredPositiveCases)||summary.requiredPositiveCases||0,signedBy,note:signoffNote,
    },status==="approved"?"Style Director validation signed off.":"Style Director validation kept in review.");
  }

  const validCase=/^[A-Za-z0-9._-]{3,80}$/.test(caseId.trim())&&(!handoff||/^[0-9a-f-]{36}$/i.test(handoffAuditId.trim()))&&(!blocking||note.trim().length>=3);

  return <main style={{minHeight:"100vh",background:"#f8f6f0",padding:"34px 18px",color:"#1a1a1a"}}>
    <div style={{maxWidth:1050,margin:"0 auto",display:"grid",gap:18}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:20,flexWrap:"wrap"}}>
        <div>
          <p style={{fontSize:12,letterSpacing:2,margin:"0 0 8px"}}>LINEN EARTH / ROADMAP V2 / PHASE 6</p>
          <h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(34px,5vw,56px)",lineHeight:1,margin:"0 0 10px"}}>Style Director Validation</h1>
          <p style={{maxWidth:720,lineHeight:1.6,opacity:.72}}>Record whether real users understand the three directions, see meaningful differences, and reach the exact stock-backed Designer handoff. Human sign-off stays separate from the evidence.</p>
        </div>
        <nav style={{display:"flex",gap:12,flexWrap:"wrap"}}><Link href="/style-director">Open Style Director</Link><Link href="/operator/designer-evaluation">Owner Benchmark</Link><Link href="/operator">Operator Desk</Link></nav>
      </header>

      {!configured&&<section style={{...panel,background:"#fff4df"}}>Style Director validation migration is not installed yet.</section>}
      {message&&<section style={{...panel,background:"#ece8df"}}>{message}</section>}

      <section style={{...panel,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
        <article><small>REAL USER CASES</small><div style={{fontSize:34,fontWeight:800}}>{summary.uniqueCases}</div></article>
        <article><small>DISTINCT CLEAN HANDOFFS</small><div style={{fontSize:34,fontWeight:800}}>{summary.positiveCases}</div><span style={{fontSize:12,opacity:.6}}>{summary.verifiedHandoffCases} verified case rows</span></article>
        <article><small>BLOCKING CASES</small><div style={{fontSize:34,fontWeight:800}}>{summary.blockingCases}</div></article>
        <article><small>DEVICE COVERAGE</small><div style={{fontSize:27,fontWeight:800}}>{summary.deviceCoverage.length}/3</div><span style={{fontSize:12,opacity:.6}}>{summary.deviceCoverage.join(" · ")||"none yet"}</span></article>
        <article><small>DOCUMENTED CLEAN TARGET</small><div style={{fontSize:27,fontWeight:800}}>{summary.requiredPositiveCases??"—"}</div><span style={{fontSize:12,opacity:.6}}>{summary.thresholdMet?"met":"not yet met"}</span></article>
        <article><small>HUMAN SIGN-OFF</small><div style={{fontSize:24,fontWeight:800,textTransform:"uppercase"}}>{summary.latestSignoffStatus}</div></article>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(330px,1fr))",gap:18}}>
        <article style={panel}>
          <h2 style={{marginTop:0}}>Record a real-user test</h2>
          <p style={{fontSize:13,opacity:.65}}>Use an anonymous case ID only. Do not enter a customer name, phone, email or measurements.</p>
          <div style={{display:"grid",gap:12}}>
            <label><span>Anonymous case ID</span><input style={input} value={caseId} onChange={(e)=>setCaseId(e.target.value.slice(0,80))} placeholder="SD-USER-001"/></label>
            <label><span>Device</span><select style={input} value={deviceClass} onChange={(e)=>setDeviceClass(e.target.value as StyleDirectorValidationDevice)}><option value="mobile">Mobile</option><option value="tablet">Tablet</option><option value="desktop">Desktop</option></select></label>
            <label><input type="checkbox" checked={understandable} onChange={(e)=>setUnderstandable(e.target.checked)}/> Three directions were understandable</label>
            <label><input type="checkbox" checked={distinct} onChange={(e)=>setDistinct(e.target.checked)}/> Directions felt materially distinct</label>
            <label><input type="checkbox" checked={handoff} onChange={(e)=>setHandoff(e.target.checked)}/> Exact stock/style handoff opened correctly</label>
            {handoff&&<label><span>Verified handoff audit ID</span><input style={input} value={handoffAuditId} onChange={(e)=>setHandoffAuditId(e.target.value.slice(0,80))} placeholder="Copy from the Designer handoff banner"/><small style={{display:"block",opacity:.6,marginTop:4}}>The clean-case gate accepts handoff success only when this server audit exists.</small></label>}
            <label><input type="checkbox" checked={blocking} onChange={(e)=>setBlocking(e.target.checked)}/> Blocking issue occurred</label>
            <label><span>Observation note</span><textarea style={{...input,minHeight:90}} value={note} onChange={(e)=>setNote(e.target.value.slice(0,1200))} placeholder="What confused the user, what felt repetitive, or what was confirmed?"/></label>
            <button style={button} disabled={!configured||busy||!validCase} onClick={()=>void recordTest()}>{busy?"Saving…":"Record user-test evidence"}</button>
          </div>
        </article>

        <article style={panel}>
          <h2 style={{marginTop:0}}>Owner/reviewer decision</h2>
          <p style={{fontSize:13,opacity:.65}}>There is deliberately no auto-generated pass percentage. Review the real evidence and record the human decision.</p>
          <div style={{display:"grid",gap:12}}>
            <label><span>Documented clean-case target</span><input style={input} type="number" min="1" max="50" value={requiredPositiveCases} onChange={(e)=>setRequiredPositiveCases(e.target.value)} placeholder={summary.requiredPositiveCases?String(summary.requiredPositiveCases):"Enter approved target"}/><small style={{display:"block",opacity:.6,marginTop:4}}>No default is invented. Enter the minimum clean real-user cases required by the owner/reviewer.</small></label>
            <label><span>Signer</span><input style={input} value={signedBy} onChange={(e)=>setSignedBy(e.target.value.slice(0,120))} placeholder="Owner / reviewer"/></label>
            <label><span>Decision note</span><textarea style={{...input,minHeight:100}} value={signoffNote} onChange={(e)=>setSignoffNote(e.target.value.slice(0,1200))} placeholder="Why this clean-case target is appropriate and what the real-user evidence shows."/></label>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button style={{...button,background:"#6b7a63"}} disabled={busy||(!Number(requiredPositiveCases)&&!summary.requiredPositiveCases)||signedBy.trim().length<2||signoffNote.trim().length<3} onClick={()=>void signoff("review")}>Keep in review</button>
              <button style={button} disabled={busy||(!Number(requiredPositiveCases)&&!summary.requiredPositiveCases)||signedBy.trim().length<2||!summary.evidenceRecorded} onClick={()=>void signoff("approved")}>Record approved</button>
            </div>
          </div>
          <div style={{marginTop:18,paddingTop:14,borderTop:"1px solid #ece6dc"}}>
            <strong>Current phase evidence</strong>
            <p style={{opacity:.68,fontSize:13,lineHeight:1.55}}>Distinct clean handoffs: {summary.positiveCases}{summary.requiredPositiveCases?" / "+summary.requiredPositiveCases:" · target not documented"} · latest sign-off: {summary.latestSignoffStatus}. Reusing one handoff audit under multiple case IDs does not increase the evidence count.</p>
          </div>
        </article>
      </section>

      <section style={panel}>
        <h2 style={{marginTop:0}}>Latest unique user cases</h2>
        <div style={{display:"grid",gap:10}}>
          {!latestTests.length&&<p style={{opacity:.65}}>No Style Director user-test evidence recorded yet.</p>}
          {latestTests.slice(0,20).map((row)=>{
            const clean=row.directions_understandable&&row.directions_distinct&&row.stock_handoff_worked&&Boolean(row.handoff_audit_id)&&!row.blocking_issue;
            return <div key={row.case_id} style={{borderTop:"1px solid #ece6dc",paddingTop:10}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><strong>{row.case_id}</strong><b>{clean?"ALL CHECKS CLEAN":"REVIEW"}</b></div>
              <div style={{fontSize:12,opacity:.62,marginTop:4}}>{row.device_class} · {new Date(row.created_at).toLocaleString("en-IN")}</div>
              <div style={{fontSize:13,marginTop:6}}>Understandable {row.directions_understandable?"✓":"×"} · Distinct {row.directions_distinct?"✓":"×"} · Handoff {row.stock_handoff_worked?(row.handoff_audit_id?"verified ✓":"unverified"):"×"} · Blocking issue {row.blocking_issue?"yes":"no"}</div>
              {row.note&&<p style={{fontSize:13,opacity:.7,marginBottom:0}}>{row.note}</p>}
            </div>;
          })}
        </div>
      </section>
    </div>
  </main>;
}
