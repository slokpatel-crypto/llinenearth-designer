"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CalibrationCase={
  at:string;caseId:string;
  selfChestCm:number;tailorChestCm:number;chestErrorCm:number;
  selfSleeveCm:number;tailorSleeveCm:number;sleeveErrorCm:number;
  evidenceSource:string;checkedBy:string;note:string;
};
type Payload={
  configured:boolean;
  cases:CalibrationCase[];
  summary:{
    target:number;total:number;
    medianChestErrorCm:number|null;medianSleeveErrorCm:number|null;
    chestPass:boolean;sleevePass:boolean;complete:boolean;
  };
};

const empty={caseId:"",selfChest:"",tailorChest:"",selfSleeve:"",tailorSleeve:"",evidenceSource:"",checkedBy:"",note:""};

export default function MeasurementCalibrationClient(){
  const [data,setData]=useState<Payload|null>(null);
  const [form,setForm]=useState(empty);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/measurement-calibration",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/measurement-calibration";return;}
    if(response.ok) setData(await response.json() as Payload);
  }
  useEffect(()=>{void load();},[]);

  const valid=Boolean(
    form.caseId.trim()
    && Number(form.selfChest)>=50 && Number(form.selfChest)<=200
    && Number(form.tailorChest)>=50 && Number(form.tailorChest)<=200
    && Number(form.selfSleeve)>=30 && Number(form.selfSleeve)<=100
    && Number(form.tailorSleeve)>=30 && Number(form.tailorSleeve)<=100
    && form.evidenceSource.trim().length>=3
    && form.checkedBy.trim().length>=2
  );

  async function save(){
    if(!valid||saving) return;
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/operator/measurement-calibration",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          caseId:form.caseId.trim(),
          selfChestCm:Number(form.selfChest),
          tailorChestCm:Number(form.tailorChest),
          selfSleeveCm:Number(form.selfSleeve),
          tailorSleeveCm:Number(form.tailorSleeve),
          evidenceSource:form.evidenceSource.trim(),
          checkedBy:form.checkedBy.trim(),
          note:form.note.trim(),
        }),
      });
      const result=await response.json() as {stored?:boolean;error?:string};
      if(!response.ok||!result.stored) throw new Error(result.error||"Calibration case was not stored.");
      setForm(empty);
      setMessage("Calibration case recorded.");
      await load();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Calibration case could not be stored.");
    }finally{setSaving(false);}
  }

  const summary=data?.summary;
  return <main className="measurementCal">
    <header className="measurementCalHeader">
      <div><span>LINEN EARTH / PRIVATE OPERATOR</span><h1>Measurement Calibration</h1><p>Compare a customer's self-measurement with the tailor's measurement. Use anonymous case IDs only. The roadmap gate is based on real evidence, never guessed values.</p></div>
      <nav><Link href="/measurements">Open customer guide</Link><Link href="/operator/phase10-readiness">Readiness</Link><Link href="/operator">Operator Desk</Link></nav>
    </header>

    <section className="measurementCalSummary">
      <article data-pass={Boolean(summary?.total && summary.total>=10)}><small>CASES</small><strong>{summary?.total??0}/{summary?.target??10}</strong><span>Unique case IDs; latest entry per case is used.</span></article>
      <article data-pass={summary?.chestPass===true}><small>MEDIAN CHEST ERROR</small><strong>{summary?.medianChestErrorCm??"—"} cm</strong><span>Target &lt; 1.5 cm after at least 10 cases.</span></article>
      <article data-pass={summary?.sleevePass===true}><small>MEDIAN SLEEVE ERROR</small><strong>{summary?.medianSleeveErrorCm??"—"} cm</strong><span>Target &lt; 1.0 cm after at least 10 cases.</span></article>
      <article data-pass={summary?.complete===true}><small>ROADMAP GATE</small><strong>{summary?.complete?"PASS":"REVIEW"}</strong><span>{summary?.complete?"Measurement accuracy evidence is ready.":"More real comparison evidence is required."}</span></article>
    </section>

    <section className="measurementCalLayout">
      <article className="measurementCalForm">
        <div><span>01 / RECORD CASE</span><h2>Self vs tailor.</h2><p>Do not enter a customer's name, phone number or other personal identifier. Use a label such as CASE-01.</p></div>
        <label>Anonymous case ID<input value={form.caseId} onChange={(event)=>setForm((current)=>({...current,caseId:event.target.value.slice(0,80)}))} placeholder="CASE-01"/></label>
        <div className="measurementCalPair">
          <label>Self chest (cm)<input type="number" min="50" max="200" step=".1" value={form.selfChest} onChange={(event)=>setForm((current)=>({...current,selfChest:event.target.value}))}/></label>
          <label>Tailor chest (cm)<input type="number" min="50" max="200" step=".1" value={form.tailorChest} onChange={(event)=>setForm((current)=>({...current,tailorChest:event.target.value}))}/></label>
        </div>
        <div className="measurementCalPair">
          <label>Self sleeve (cm)<input type="number" min="30" max="100" step=".1" value={form.selfSleeve} onChange={(event)=>setForm((current)=>({...current,selfSleeve:event.target.value}))}/></label>
          <label>Tailor sleeve (cm)<input type="number" min="30" max="100" step=".1" value={form.tailorSleeve} onChange={(event)=>setForm((current)=>({...current,tailorSleeve:event.target.value}))}/></label>
        </div>
        <label>Physical comparison source<input value={form.evidenceSource} onChange={(event)=>setForm((current)=>({...current,evidenceSource:event.target.value.slice(0,240)}))} placeholder="Tailor session / tape-check reference / fitting note"/></label>
        <label>Checked by<input value={form.checkedBy} onChange={(event)=>setForm((current)=>({...current,checkedBy:event.target.value.slice(0,120)}))} placeholder="Tailor / reviewer"/></label>
        <label>Operator note<textarea value={form.note} onChange={(event)=>setForm((current)=>({...current,note:event.target.value.slice(0,1200)}))} placeholder="Any measurement difficulty or correction…"/></label>
        <button type="button" disabled={!valid||saving||data?.configured===false} onClick={()=>void save()}>{saving?"Saving…":"Record comparison"}</button>
        {data?.configured===false&&<small>Supabase operator memory must be configured before evidence can be retained.</small>}
        {message&&<p className="measurementCalMessage">{message}</p>}
      </article>

      <article className="measurementCalCases">
        <div><span>02 / RECORDED EVIDENCE</span><h2>Latest unique cases.</h2></div>
        {!data?.cases.length&&<p>No calibration cases recorded yet.</p>}
        {data?.cases.slice(0,20).map((item)=><div className="measurementCalCase" key={item.caseId}>
          <div><b>{item.caseId}</b><small>{new Date(item.at).toLocaleString("en-IN")}</small></div>
          <span>Chest {item.selfChestCm} → {item.tailorChestCm} cm <b>Δ {item.chestErrorCm}</b></span>
          <span>Sleeve {item.selfSleeveCm} → {item.tailorSleeveCm} cm <b>Δ {item.sleeveErrorCm}</b></span>
          <p><b>Evidence:</b> {item.evidenceSource} · checked by {item.checkedBy}</p>
          {item.note&&<p>{item.note}</p>}
        </div>)}
      </article>
    </section>
  </main>;
}
