"use client";

import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import {
  summarizeCustomerOutcomeLearning,
  type CustomerOutcomeEvidenceRow,
  type CustomerOutcomePolicyRow,
  type CustomerOutcomeReviewDecision,
  type CustomerOutcomeReviewRow,
} from "@/lib/designer/customer-outcome-learning";

const panel:React.CSSProperties={background:"#fff",border:"1px solid #ddd7cc",borderRadius:18,padding:20};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"11px 12px",border:"1px solid #cbc3b7",borderRadius:9,fontSize:14,background:"#fff"};
const button:React.CSSProperties={border:0,borderRadius:10,padding:"10px 14px",background:"#1a1a1a",color:"#fff",fontWeight:700,cursor:"pointer"};

function label(value:string){return value.replaceAll("_"," ");}

export default function CustomerOutcomesClient(){
  const [configured,setConfigured]=useState(true);
  const [outcomes,setOutcomes]=useState<CustomerOutcomeEvidenceRow[]>([]);
  const [reviews,setReviews]=useState<CustomerOutcomeReviewRow[]>([]);
  const [policies,setPolicies]=useState<CustomerOutcomePolicyRow[]>([]);
  const [reviewer,setReviewer]=useState("");
  const [reviewNote,setReviewNote]=useState("");
  const [threshold,setThreshold]=useState("");
  const [approvedBy,setApprovedBy]=useState("");
  const [policyNote,setPolicyNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/customer-outcomes",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/customer-outcomes";return;}
    const data=await response.json();
    if(!response.ok){setMessage(data.error||"Customer outcomes could not be loaded.");return;}
    setConfigured(data.configured!==false);
    setOutcomes(Array.isArray(data.outcomes)?data.outcomes:[]);
    setReviews(Array.isArray(data.reviews)?data.reviews:[]);
    setPolicies(Array.isArray(data.policies)?data.policies:[]);
  }
  useEffect(()=>{void load();},[]);

  const summary=useMemo(()=>summarizeCustomerOutcomeLearning(outcomes,reviews,policies),[outcomes,reviews,policies]);
  const latestReviewByOutcome=useMemo(()=>{
    const map=new Map<string,CustomerOutcomeReviewRow>();
    for(const row of [...reviews].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))){
      if(!map.has(row.outcome_id)) map.set(row.outcome_id,row);
    }
    return map;
  },[reviews]);

  async function post(body:Record<string,unknown>,success:string){
    if(busy) return false;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/operator/customer-outcomes",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Customer outcome evidence could not be saved.");
      setMessage(success);await load();return true;
    }catch(error){
      setMessage(error instanceof Error?error.message:"Customer outcome evidence could not be saved.");
      return false;
    }finally{setBusy(false);}
  }

  async function review(outcomeId:string,decision:CustomerOutcomeReviewDecision){
    const saved=await post({
      action:"review",outcomeId,decision,reviewer,note:reviewNote,
    },decision==="approved"?"Outcome approved as usable evidence.":"Outcome rejected from learning evidence.");
    if(saved) setReviewNote("");
  }

  async function savePolicy(){
    const saved=await post({
      action:"policy",
      minimumApprovedCases:Number(threshold),
      approvedBy,
      note:policyNote,
    },"Human learning threshold policy recorded.");
    if(saved){setThreshold("");setPolicyNote("");}
  }

  return <main style={{minHeight:"100vh",background:"#f8f6f0",color:"#1a1a1a",padding:"34px 18px"}}>
    <div style={{maxWidth:1120,margin:"0 auto",display:"grid",gap:18}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:20,flexWrap:"wrap"}}>
        <div>
          <p style={{fontSize:12,letterSpacing:2,margin:"0 0 8px"}}>LINEN EARTH / ROADMAP V2 / PHASE 11</p>
          <h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(34px,5vw,56px)",lineHeight:1,margin:"0 0 10px"}}>Customer Outcome Review</h1>
          <p style={{maxWidth:780,lineHeight:1.6,opacity:.72}}>Review real delivered-garment outcomes before any customer feedback becomes eligible for learning. The evidence threshold is entered and signed by a human; the software does not invent one.</p>
        </div>
        <nav style={{display:"flex",gap:12,flexWrap:"wrap"}}><Link href="/operator/production">Production Desk</Link><Link href="/operator/phase10-readiness">Readiness</Link></nav>
      </header>

      {!configured&&<section style={{...panel,background:"#fff4df"}}>Phase 11 customer-outcome migrations are not installed yet.</section>}
      {message&&<section style={{...panel,background:"#ece8df"}}>{message}</section>}

      <section style={{...panel,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
        <article><small>OUTCOMES</small><div style={{fontSize:34,fontWeight:800}}>{summary.totalOutcomes}</div></article>
        <article><small>APPROVED</small><div style={{fontSize:34,fontWeight:800}}>{summary.approved}</div></article>
        <article><small>REJECTED</small><div style={{fontSize:34,fontWeight:800}}>{summary.rejected}</div></article>
        <article><small>UNREVIEWED</small><div style={{fontSize:34,fontWeight:800}}>{summary.unreviewed}</div></article>
        <article><small>APPROVED FIT CASES</small><div style={{fontSize:34,fontWeight:800}}>{summary.approvedFitCases}</div></article>
        <article><small>HUMAN THRESHOLD</small><div style={{fontSize:34,fontWeight:800}}>{summary.threshold??"—"}</div></article>
        <article><small>EVIDENCE GATE</small><div style={{fontSize:24,fontWeight:800}}>{summary.gateComplete?"MET":"OPEN"}</div></article>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(340px,1fr))",gap:18}}>
        <article style={panel}>
          <h2 style={{marginTop:0}}>1. Reviewer context</h2>
          <p style={{fontSize:13,opacity:.65,lineHeight:1.55}}>Approve only when the customer evidence is usable for learning. Reject evidence caused by an unrelated production problem, ambiguous feedback, or another reason that should not influence design logic.</p>
          <label style={{display:"grid",gap:5}}><span>Named reviewer</span><input style={input} value={reviewer} onChange={e=>setReviewer(e.target.value.slice(0,120))} placeholder="Owner / fit reviewer"/></label>
          <label style={{display:"grid",gap:5,marginTop:10}}><span>Review note</span><textarea style={{...input,minHeight:90}} value={reviewNote} onChange={e=>setReviewNote(e.target.value.slice(0,1200))} placeholder="Reason for approval or rejection. Rejection requires a note."/></label>
        </article>

        <article style={panel}>
          <h2 style={{marginTop:0}}>2. Human evidence threshold</h2>
          <p style={{fontSize:13,opacity:.65,lineHeight:1.55}}>Enter the minimum number of approved real outcomes required by your documented learning policy. Recording this gate still does not automatically change Designer ranking.</p>
          <label style={{display:"grid",gap:5}}><span>Minimum approved cases</span><input style={input} type="number" min="1" max="10000" step="1" value={threshold} onChange={e=>setThreshold(e.target.value)}/></label>
          <label style={{display:"grid",gap:5,marginTop:10}}><span>Policy approver</span><input style={input} value={approvedBy} onChange={e=>setApprovedBy(e.target.value.slice(0,120))} placeholder="Named owner / approver"/></label>
          <label style={{display:"grid",gap:5,marginTop:10}}><span>Source / reasoning</span><textarea style={{...input,minHeight:90}} value={policyNote} onChange={e=>setPolicyNote(e.target.value.slice(0,1200))} placeholder="Document where this threshold comes from."/></label>
          <button style={{...button,marginTop:12}} disabled={busy||!threshold||approvedBy.trim().length<2||policyNote.trim().length<3} onClick={()=>void savePolicy()}>Record threshold policy</button>
          {summary.policy&&<p style={{fontSize:12,opacity:.62,lineHeight:1.5,marginBottom:0}}>Latest policy: {summary.policy.minimum_approved_cases} approved cases · {summary.policy.approved_by} · {new Date(summary.policy.created_at).toLocaleDateString("en-IN")}</p>}
        </article>
      </section>

      <section style={panel}>
        <h2 style={{marginTop:0}}>Delivered-order outcome evidence</h2>
        {!outcomes.length&&<p style={{opacity:.65}}>No authenticated post-delivery customer outcome has been recorded yet.</p>}
        <div style={{display:"grid",gap:12}}>
          {outcomes.map(outcome=>{
            const reviewRow=latestReviewByOutcome.get(outcome.outcome_id);
            return <article key={outcome.outcome_id} style={{borderTop:"1px solid #ece6dc",paddingTop:12,display:"grid",gap:7}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                <strong>{outcome.revision_id}</strong>
                <b>{reviewRow?reviewRow.decision.toUpperCase():"UNREVIEWED"}</b>
              </div>
              <div style={{fontSize:13}}>Overall: <strong>{label(outcome.overall_rating)}</strong> · Fit: <strong>{label(outcome.fit_result)}</strong> · {outcome.worn_confirmed?"worn + checked":"wear not confirmed"}</div>
              <small style={{opacity:.62}}>Order {outcome.order_id.slice(0,8)}… · recorded {new Date(outcome.created_at).toLocaleString("en-IN")}</small>
              {outcome.note&&<p style={{margin:"2px 0",fontSize:13,lineHeight:1.5}}>{outcome.note}</p>}
              {reviewRow&&<small style={{opacity:.62}}>Latest review by {reviewRow.reviewer} · {new Date(reviewRow.created_at).toLocaleString("en-IN")}{reviewRow.note?" · "+reviewRow.note:""}</small>}
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button style={{...button,background:"#6b7a63"}} disabled={busy||reviewer.trim().length<2} onClick={()=>void review(outcome.outcome_id,"approved")}>Approve evidence</button>
                <button style={{...button,background:"#7a2f2f"}} disabled={busy||reviewer.trim().length<2||reviewNote.trim().length<3} onClick={()=>void review(outcome.outcome_id,"rejected")}>Reject evidence</button>
              </div>
            </article>;
          })}
        </div>
      </section>

      <section style={{...panel,background:"#f2efe8"}}>
        <strong>Learning boundary</strong>
        <p style={{marginBottom:0,lineHeight:1.55,fontSize:13}}>“Evidence gate met” means only that the human-defined quantity of reviewed customer outcomes exists. Designer ranking remains unchanged until a separate approved learning rule explicitly maps reviewed evidence into bounded recommendation signals.</p>
      </section>
    </div>
  </main>;
}
