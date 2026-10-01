"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type UsageCase={
  at:string;caseId:string;revisionId:string;garment:"shirt"|"trouser";fabricId:string;
  fabricWidthCm:number;actualMetres:number;patternRepeatMm:number|null;patternMatching:boolean;
  cutContext:string;note:string;
};
type Payload={
  configured:boolean;cases:UsageCase[];
  summary:{total:number;shirtCases:number;trouserCases:number;medianShirtMetres:number|null;medianTrouserMetres:number|null;readyForModel:boolean};
};
const empty={caseId:"",revisionId:"",garment:"shirt",fabricId:"",fabricWidthCm:"",actualMetres:"",patternRepeatMm:"",patternMatching:false,cutContext:"",note:""};

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
    form.caseId.trim()&&form.revisionId.trim()&&form.fabricId.trim()
    && Number(form.fabricWidthCm)>=60&&Number(form.fabricWidthCm)<=220
    && Number(form.actualMetres)>0&&Number(form.actualMetres)<=12
  );

  async function save(){
    if(!valid||saving) return;
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/memory/event",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          id:"EV-PROD-USAGE-"+crypto.randomUUID(),
          sessionId:"PRODUCTION-CALIBRATION",
          type:"operator_note",
          at:new Date().toISOString(),
          payload:{
            subtype:"production_usage_case",version:"production-usage-v1",
            caseId:form.caseId.trim(),revisionId:form.revisionId.trim(),
            garment:form.garment,fabricId:form.fabricId.trim(),
            fabricWidthCm:Number(form.fabricWidthCm),actualMetres:Number(form.actualMetres),
            patternRepeatMm:form.patternRepeatMm?Number(form.patternRepeatMm):null,
            patternMatching:form.patternMatching,cutContext:form.cutContext.trim(),note:form.note.trim(),
          },
        }),
      });
      const result=await response.json() as {stored?:boolean;error?:string};
      if(!response.ok||!result.stored) throw new Error(result.error||"Production usage case was not stored.");
      setForm(empty);setMessage("Real cloth-usage case recorded.");await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Production usage case could not be stored.");}
    finally{setSaving(false);}
  }

  const summary=data?.summary;
  return <main className="prodCal">
    <header className="prodCalHeader">
      <div><span>LINEN EARTH / PRIVATE OPERATOR</span><h1>Production Calibration</h1><p>Record cloth actually consumed after a real garment is cut. This evidence will later support meterage estimation; the system does not guess meterage from these few cases.</p></div>
      <nav><Link href="/operator">Operator Desk</Link><Link href="/operator/phase10-readiness">Readiness</Link></nav>
    </header>

    <section className="prodCalSummary">
      <article><small>SHIRT CASES</small><strong>{summary?.shirtCases??0}/20</strong><span>Minimum evidence target before fitting a first estimator.</span></article>
      <article><small>TROUSER CASES</small><strong>{summary?.trouserCases??0}/20</strong><span>Collected separately from shirt usage.</span></article>
      <article><small>MEDIAN OBSERVED</small><strong>{summary?.medianShirtMetres??"—"} / {summary?.medianTrouserMetres??"—"} m</strong><span>Descriptive only; not a quote or recommendation.</span></article>
      <article data-pass={summary?.readyForModel===true}><small>ESTIMATOR DATA</small><strong>{summary?.readyForModel?"READY TO ANALYSE":"COLLECTING"}</strong><span>Even when ready, owner/tailor review is required before customer use.</span></article>
    </section>

    <section className="prodCalLayout">
      <article className="prodCalForm">
        <span>01 / REAL CUT</span><h2>Record actual cloth usage.</h2>
        <label>Anonymous case ID<input value={form.caseId} onChange={(e)=>setForm({...form,caseId:e.target.value.slice(0,80)})} placeholder="CUT-001"/></label>
        <label>Locked revision ID<input value={form.revisionId} onChange={(e)=>setForm({...form,revisionId:e.target.value.slice(0,180)})} placeholder="LE-LOCK-…"/></label>
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
        <label>Operator note<textarea rows={3} value={form.note} onChange={(e)=>setForm({...form,note:e.target.value.slice(0,600)})} placeholder="Waste, defect allowance, special matching, tailor note…"/></label>
        <button type="button" onClick={()=>void save()} disabled={!valid||saving||data?.configured===false}>{saving?"Saving…":"Record actual usage"}</button>
        {data?.configured===false&&<small>Cloud operator memory must be configured before evidence can be retained.</small>}
        {message&&<p>{message}</p>}
      </article>

      <article className="prodCalCases">
        <span>02 / EVIDENCE</span><h2>Latest real cuts.</h2>
        {!data?.cases.length&&<p>No production usage cases recorded yet.</p>}
        {data?.cases.slice(0,30).map((item)=><div key={item.caseId} className="prodCalCase">
          <div><b>{item.caseId}</b><small>{new Date(item.at).toLocaleString("en-IN")}</small></div>
          <span>{item.garment.toUpperCase()} · {item.fabricId}</span>
          <strong>{item.actualMetres} m from {item.fabricWidthCm} cm width</strong>
          <small>{item.revisionId}</small>
          {item.patternMatching&&<em>pattern matching</em>}
          {item.note&&<p>{item.note}</p>}
        </div>)}
      </article>
    </section>
  </main>;
}
