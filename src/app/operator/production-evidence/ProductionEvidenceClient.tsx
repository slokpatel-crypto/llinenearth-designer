"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  PRODUCTION_REENTRY_FIELDS,
  summarizeProductionDeliveryEvidence,
} from "@/lib/designer/production-delivery-evidence";

type Order={order_id:string;revision_id:string;recipe_hash:string;status:string;note:string;created_at:string};
type Evidence={evidence_id:string;order_id:string;revision_id:string;recipe_hash:string;manual_design_reentry:boolean;reentry_fields:string[];note:string;operator:string;created_at:string;order_created_at:string};

export default function ProductionEvidenceClient(){
  const [orders,setOrders]=useState<Order[]>([]);
  const [evidence,setEvidence]=useState<Evidence[]>([]);
  const [configured,setConfigured]=useState(true);
  const [selectedOrderId,setSelectedOrderId]=useState("");
  const [manualChoice,setManualChoice]=useState<"unset"|"yes"|"no">("unset");
  const [reentryFields,setReentryFields]=useState<string[]>([]);
  const [note,setNote]=useState("");
  const [operator,setOperator]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/production-evidence",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/production-evidence";return;}
    const data=await response.json();
    if(!response.ok){setMessage(data.error||"Production evidence could not be loaded.");return;}
    const nextOrders=Array.isArray(data.orders)?data.orders:[];
    const nextEvidence=Array.isArray(data.evidence)?data.evidence:[];
    setConfigured(data.configured!==false);
    setOrders(nextOrders);
    setEvidence(nextEvidence);
    const requested=new URLSearchParams(window.location.search).get("order");
    const delivered=nextOrders.filter((item:Order)=>item.status==="delivered");
    const requestedDelivered=delivered.find((item:Order)=>item.order_id===requested);
    const firstMissing=delivered.find((item:Order)=>!nextEvidence.some((row:Evidence)=>row.order_id===item.order_id));
    setSelectedOrderId((current)=>current||requestedDelivered?.order_id||firstMissing?.order_id||delivered[0]?.order_id||"");
  }

  useEffect(()=>{void load();},[]);

  const delivered=useMemo(()=>[...orders].filter((item)=>item.status==="delivered").sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)),[orders]);
  const summary=useMemo(()=>summarizeProductionDeliveryEvidence(orders,evidence),[orders,evidence]);
  const selected=delivered.find((item)=>item.order_id===selectedOrderId)||delivered[0]||null;
  const selectedEvidence=selected?evidence.find((item)=>item.order_id===selected.order_id)||null:null;
  const choiceValid=manualChoice!=="unset"&&(manualChoice==="no"||reentryFields.length>0||note.trim().length>=3);

  function chooseOrder(orderId:string){
    setSelectedOrderId(orderId);
    setManualChoice("unset");
    setReentryFields([]);
    setNote("");
    setMessage("");
  }

  function toggleField(id:string){
    setReentryFields((current)=>current.includes(id)?current.filter((item)=>item!==id):[...current,id]);
  }

  async function saveEvidence(){
    if(!selected||selectedEvidence||busy||!choiceValid) return;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/operator/production-evidence",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          action:"record",
          orderId:selected.order_id,
          manualDesignReentry:manualChoice==="yes",
          reentryFields,
          note,
          operator,
        }),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Production completion evidence could not be saved.");
      setMessage("Immutable completion audit saved for this delivered order.");
      setManualChoice("unset");setReentryFields([]);setNote("");
      await load();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Production completion evidence could not be saved.");
    }finally{setBusy(false);}
  }

  return <main className="productionEvidence">
    <header className="productionEvidenceHeader">
      <div>
        <span>LINEN EARTH / ROADMAP V2 / PHASE 8 EVIDENCE</span>
        <h1>Zero-Reentry Proof</h1>
        <p>Audit each real delivered order to prove whether locked design data travelled through production without being typed again. This screen records evidence; it never assumes the gate passed.</p>
      </div>
      <nav><Link href="/operator">Operator Desk</Link><Link href="/operator/production">Production Desk</Link><Link href="/operator/garment-qc">Garment QC</Link></nav>
    </header>

    {!configured&&<section className="productionEvidenceNotice">Production evidence migration is not installed yet.</section>}
    {message&&<section className="productionEvidenceNotice">{message}</section>}

    <section className="productionEvidenceScore">
      <article><span>DELIVERED</span><strong>{summary.deliveredCount}</strong><small>real completed orders</small></article>
      <article><span>FIRST 10 AUDITED</span><strong>{summary.auditedTargetCount}/10</strong><small>immutable completion audits</small></article>
      <article><span>ZERO RE-ENTRY</span><strong>{summary.zeroReentryTargetCount}</strong><small>within first 10 delivered</small></article>
      <article data-alert={summary.reentryIncidentCount>0}><span>RE-ENTRY INCIDENTS</span><strong>{summary.reentryIncidentCount}</strong><small>within first 10 delivered</small></article>
      <article data-complete={summary.gateComplete}><span>PHASE 8 GATE</span><strong>{summary.gateComplete?"PROVED":"OPEN"}</strong><small>{summary.gateComplete?"first 10 passed":"requires real evidence"}</small></article>
    </section>

    <section className="productionEvidenceLayout">
      <aside className="productionEvidenceQueue">
        <div className="productionEvidenceSectionHead"><span>DELIVERED ORDER AUDITS</span><b>{delivered.length}</b></div>
        {!delivered.length&&<p>No delivered orders exist yet.</p>}
        {delivered.map((item,index)=>{
          const row=evidence.find((entry)=>entry.order_id===item.order_id);
          return <button key={item.order_id} className={selected?.order_id===item.order_id?"active":""} onClick={()=>chooseOrder(item.order_id)}>
            <span><b>{item.revision_id}</b>{index<10&&<em>FIRST 10</em>}</span>
            <small>{item.order_id}</small>
            <i data-state={!row?"pending":row.manual_design_reentry?"incident":"clean"}>{!row?"audit pending":row.manual_design_reentry?"re-entry recorded":"zero re-entry"}</i>
          </button>;
        })}
      </aside>

      <section className="productionEvidencePanel">
        {!selected?<div className="productionEvidenceEmpty"><h2>No delivered order yet.</h2><p>Evidence can only be recorded after delivery, which itself requires finished-garment QC approval.</p></div>:<>
          <div className="productionEvidenceIdentity">
            <span><small>ORDER</small><b>{selected.order_id}</b></span>
            <span><small>REVISION</small><b>{selected.revision_id}</b></span>
            <span><small>RECIPE HASH</small><b>{selected.recipe_hash}</b></span>
          </div>

          {selectedEvidence?<div className="productionEvidenceLocked">
            <span>IMMUTABLE AUDIT</span>
            <h2>{selectedEvidence.manual_design_reentry?"Manual re-entry occurred":"Zero design-data re-entry confirmed"}</h2>
            <p>{selectedEvidence.note||"No additional note."}</p>
            {selectedEvidence.reentry_fields?.length>0&&<p><b>Fields:</b> {selectedEvidence.reentry_fields.join(", ")}</p>}
            <small>{selectedEvidence.operator||"Operator not named"} · {new Date(selectedEvidence.created_at).toLocaleString("en-IN")}</small>
          </div>:<>
            <div className="productionEvidenceChoice">
              <span>01 / DID ANY DESIGN DATA HAVE TO BE TYPED AGAIN?</span>
              <div>
                <button aria-pressed={manualChoice==="no"} onClick={()=>{setManualChoice("no");setReentryFields([]);}}>No — zero re-entry</button>
                <button aria-pressed={manualChoice==="yes"} onClick={()=>setManualChoice("yes")}>Yes — re-entry occurred</button>
              </div>
            </div>

            {manualChoice==="yes"&&<div className="productionEvidenceFields">
              <span>02 / WHAT WAS RE-ENTERED?</span>
              <div>{PRODUCTION_REENTRY_FIELDS.map((item)=><button key={item.id} aria-pressed={reentryFields.includes(item.id)} onClick={()=>toggleField(item.id)}>{item.label}</button>)}</div>
            </div>}

            <div className="productionEvidenceNotes">
              <label>Operator / initials<input value={operator} onChange={(event)=>setOperator(event.target.value)} maxLength={120} placeholder="Optional"/></label>
              <label>Completion note<textarea rows={4} value={note} onChange={(event)=>setNote(event.target.value)} placeholder="What happened during the real handoff and production flow?"/></label>
            </div>
            <button className="productionEvidenceSave" disabled={busy||!choiceValid} onClick={()=>void saveEvidence()}>{busy?"Saving…":"Save immutable completion audit"}</button>
            <p className="productionEvidenceRule">Save only after checking the actual production workflow. A re-entry incident keeps the first-10 gate open; the system will not hide it.</p>
          </>}
        </>}
      </section>
    </section>
  </main>;
}
