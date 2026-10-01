"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type UsageCase={
  at:string;caseId:string;orderId:string;revisionId:string;recipeHash:string;garment:"shirt"|"trouser";fabricId:string;
  fabricWidthCm:number;actualMetres:number;patternRepeatMm:number|null;patternMatching:boolean;
  cutContext:string;checkedBy:string;evidenceReference:string;note:string;verifiedEvidence:boolean;
};
type Payload={
  configured:boolean;cases:UsageCase[];
  summary:{total:number;shirtCases:number;trouserCases:number;medianShirtMetres:number|null;medianTrouserMetres:number|null;readyForModel:boolean};
};
const empty={caseId:"",orderId:"",garment:"shirt",fabricId:"",fabricWidthCm:"",actualMetres:"",patternRepeatMm:"",patternMatching:false,cutContext:"",checkedBy:"",evidenceReference:"",note:""};

export default function ProductionCalibrationClient(){
  const [data,setData]=useState<Payload|null>(null);
  const [form,setForm]=useState(empty);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/production-calibration",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/production-calibration";return;}
    if(response.ok) setData(await response.json() as Payload);
  }
  useEffect(()=>{void load();},[]);

  const valid=Boolean(
    form.caseId.trim()&&form.orderId.trim()&&form.fabricId.trim()
    && Number(form.fabricWidthCm)>=60&&Number(form.fabricWidthCm)<=220
    && Number(form.actualMetres)>0&&Number(form.actualMetres)<=12
    && form.checkedBy.trim().length>=2&&form.evidenceReference.trim().length>=3
  );

  async function save(){
    if(!valid||saving) return;
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/operator/production-calibration",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          action:"record",
          caseId:form.caseId.trim(),orderId:form.orderId.trim(),
          garment:form.garment,fabricId:form.fabricId.trim(),
          fabricWidthCm:Number(form.fabricWidthCm),actualMetres:Number(form.actualMetres),
          patternRepeatMm:form.patternRepeatMm?Number(form.patternRepeatMm):null,
          patternMatching:form.patternMatching,cutContext:form.cutContext.trim(),
          checkedBy:form.checkedBy.trim(),evidenceReference:form.evidenceReference.trim(),note:form.note.trim(),
        }),
      });
      const result=await response.json() as {evidenceId?:string;error?:string};
      if(!response.ok||!result.evidenceId) throw new Error(result.error||"Production cut evidence was not stored.");
      setForm(empty);setMessage("Real cloth-usage case recorded.");await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Production usage case could not be stored.");}
    finally{setSaving(false);}
  }

  const summary=data?.summary;
  return <main className="prodCal">
    <header className="prodCalHeader">
      <div><span>LINEN EARTH / PRIVATE OPERATOR</span><h1>Production Calibration</h1><p>Record cloth actually consumed after a real production order reaches cutting. The server verifies the order, immutable design context, exact fabric, named checker and physical cutting reference before this evidence can count toward meterage calibration.</p></div>
      <nav><Link href="/operator">Operator Desk</Link><Link href="/operator/meterage-model">Meterage Registry</Link><Link href="/operator/phase10-readiness">Readiness</Link></nav>
    </header>

    <section className="prodCalSummary">
      <article><small>SHIRT VERIFIED CUTS</small><strong>{summary?.shirtCases??0}/20</strong><span>Only named, physically referenced cuts count toward calibration.</span></article>
      <article><small>TROUSER VERIFIED CUTS</small><strong>{summary?.trouserCases??0}/20</strong><span>Collected separately with checker + cutting reference.</span></article>
      <article><small>MEDIAN OBSERVED</small><strong>{summary?.medianShirtMetres??"—"} / {summary?.medianTrouserMetres??"—"} m</strong><span>Descriptive only; not a quote or recommendation.</span></article>
      <article data-pass={summary?.readyForModel===true}><small>ESTIMATOR DATA</small><strong>{summary?.readyForModel?"READY TO ANALYSE":"COLLECTING"}</strong><span>Even when ready, owner/tailor review is required before customer use.</span></article>
    </section>

    <section className="prodCalLayout">
      <article className="prodCalForm">
        <span>01 / REAL CUT</span><h2>Record actual cloth usage.</h2>
        <label>Anonymous case ID<input value={form.caseId} onChange={(e)=>setForm({...form,caseId:e.target.value.slice(0,80)})} placeholder="CUT-001"/></label>
        <label>Production order ID<input value={form.orderId} onChange={(e)=>setForm({...form,orderId:e.target.value.slice(0,80)})} placeholder="Order UUID from Production Desk"/></label>
        <div className="prodCalPair">
          <label>Garment<select value={form.garment} onChange={(e)=>setForm({...form,garment:e.target.value})}><option value="shirt">Shirt</option><option value="trouser">Trouser</option></select></label>
          <label>Fabric ID<input value={form.fabricId} onChange={(e)=>setForm({...form,fabricId:e.target.value.slice(0,160)})} placeholder="formal-shirting-03"/></label>
        </div>
        <div className="prodCalPair">
          <label>Fabric width (cm)<input type="number" min="60" max="220" step=".1" value={form.fabricWidthCm} onChange={(e)=>setForm({...form,fabricWidthCm:e.target.value})}/></label>
          <label>Actual cloth used (m)<input type="number" min=".1" max="12" step=".01" value={form.actualMetres} onChange={(e)=>setForm({...form,actualMetres:e.target.value})}/></label>
        </div>
        <div className="prodCalPair">
          <label>Pattern repeat (mm)<input type="number" min=".1" max="1000" step=".1" value={form.patternRepeatMm} onChange={(e)=>setForm({...form,patternRepeatMm:e.target.value})} placeholder="optional"/></label>
          <label className="prodCalCheck"><input type="checkbox" checked={form.patternMatching} onChange={(e)=>setForm({...form,patternMatching:e.target.checked})}/> Pattern matching required</label>
        </div>
        <label>Cut / size context<input value={form.cutContext} onChange={(e)=>setForm({...form,cutContext:e.target.value.slice(0,160)})} placeholder="Regular shirt · full sleeve · size 40"/></label>
        <div className="prodCalPair">
          <label>Checked by<input value={form.checkedBy} onChange={(e)=>setForm({...form,checkedBy:e.target.value.slice(0,120)})} placeholder="Tailor / checker"/></label>
          <label>Physical evidence reference<input value={form.evidenceReference} onChange={(e)=>setForm({...form,evidenceReference:e.target.value.slice(0,240)})} placeholder="Cut ticket, job card, roll/cutting record…"/></label>
        </div>
        <label>Operator note<textarea rows={3} value={form.note} onChange={(e)=>setForm({...form,note:e.target.value.slice(0,600)})} placeholder="Waste, defect allowance, special matching, tailor note…"/></label>
        <button type="button" onClick={()=>void save()} disabled={!valid||saving||data?.configured===false}>{saving?"Saving…":"Record actual usage"}</button>
        {data?.configured===false&&<small>The private production-cut evidence registry must be configured before evidence can be retained.</small>}
        {message&&<p>{message}</p>}
      </article>

      <article className="prodCalCases">
        <span>02 / EVIDENCE</span><h2>Latest real cuts.</h2>
        {!data?.cases.length&&<p>No production usage cases recorded yet.</p>}
        {data?.cases.slice(0,30).map((item)=><div key={item.caseId} className="prodCalCase">
          <div><b>{item.caseId}</b><small>{new Date(item.at).toLocaleString("en-IN")}</small></div>
          <span>{item.garment.toUpperCase()} · {item.fabricId} · {item.verifiedEvidence?"VERIFIED":"LEGACY / UNVERIFIED"}</span>
          <strong>{item.actualMetres} m from {item.fabricWidthCm} cm width</strong>
          <small>Order {item.orderId} · locked revision {item.revisionId}</small>
          <small>Verified by {item.checkedBy||"legacy / unverified"} · {item.evidenceReference||"no physical reference"}</small>
          {item.patternMatching&&<em>pattern matching</em>}
          {item.note&&<p>{item.note}</p>}
        </div>)}
      </article>
    </section>
  </main>;
}
