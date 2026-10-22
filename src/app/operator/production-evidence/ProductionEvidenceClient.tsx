"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  PRODUCTION_REENTRY_FIELDS,
  summarizeProductionDeliveryEvidence,
} from "@/lib/designer/production-delivery-evidence";

type Order={order_id:string;revision_id:string;recipe_hash:string;status:string;note:string;created_at:string;delivered_at?:string|null};
type Evidence={evidence_id:string;order_id:string;revision_id:string;recipe_hash:string;manual_design_reentry:boolean;reentry_fields:string[];note:string;operator:string;evidence_reference?:string;created_at:string;order_created_at:string};
type FirstTenBasis={version:"linen-earth-production-first-ten-audit-v2";historyValid:true;orders:Order[];evidence:Evidence[]};

export default function ProductionEvidenceClient(){
  const [orders,setOrders]=useState<Order[]>([]);
  const [evidence,setEvidence]=useState<Evidence[]>([]);
  const [firstTenBasis,setFirstTenBasis]=useState<FirstTenBasis|null>(null);
  const [deliveryHistoryInvalid,setDeliveryHistoryInvalid]=useState(false);
  const [configured,setConfigured]=useState(true);
  const [selectedOrderId,setSelectedOrderId]=useState("");
  const [manualChoice,setManualChoice]=useState<"unset"|"yes"|"no">("unset");
  const [reentryFields,setReentryFields]=useState<string[]>([]);
  const [note,setNote]=useState("");
  const [operator,setOperator]=useState("");
  const [evidenceReference,setEvidenceReference]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/production-evidence",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/production-evidence";return;}
    const data=await response.json();
    if(!response.ok){setMessage(data.error||"Production evidence could not be loaded.");return;}
    const nextOrders=Array.isArray(data.orders)?data.orders:[];
    const nextEvidence=Array.isArray(data.evidence)?data.evidence:[];
    const rawBasis=data.firstTenBasis as Partial<FirstTenBasis>|null;
    const basis:FirstTenBasis|null=rawBasis?.version==="linen-earth-production-first-ten-audit-v2"
      &&rawBasis.historyValid===true
      &&Array.isArray(rawBasis.orders)&&Array.isArray(rawBasis.evidence)
      ?rawBasis as FirstTenBasis:null;
    // Include the oldest ten deliveries in the operator queue even if they
    // fell out of the newest-500 browsing RPC.
    const browseOrders=[...new Map([...nextOrders,...(basis?.orders||[])]
      .map((item:Order)=>[item.order_id,item])).values()];
    const browseEvidence=[...new Map([...nextEvidence,...(basis?.evidence||[])]
      .map((item:Evidence)=>[item.evidence_id,item])).values()];
    setConfigured(data.configured!==false);
    setFirstTenBasis(basis);
    setDeliveryHistoryInvalid(rawBasis?.version==="linen-earth-production-first-ten-audit-v2"&&rawBasis.historyValid!==true);
    setOrders(browseOrders);
    setEvidence(browseEvidence);
    const requested=new URLSearchParams(window.location.search).get("order");
    const delivered=browseOrders.filter((item:Order)=>item.status==="delivered");
    const requestedDelivered=delivered.find((item:Order)=>item.order_id===requested);
    const firstMissing=[...(basis?.orders||[]),...delivered].find((item:Order)=>!browseEvidence.some((row:Evidence)=>row.order_id===item.order_id));
    setSelectedOrderId((current)=>current||requestedDelivered?.order_id||firstMissing?.order_id||delivered[0]?.order_id||"");
  }

  useEffect(()=>{void load();},[]);

  const delivered=useMemo(()=>[...orders].filter((item)=>item.status==="delivered").sort((a,b)=>Date.parse(a.delivered_at||a.created_at)-Date.parse(b.delivered_at||b.created_at)),[orders]);
  const firstTenOrderIds=useMemo(()=>new Set(firstTenBasis?.orders.map((row)=>row.order_id)||[]),[firstTenBasis]);
  // A positive first-ten proof must come from the oldest-ten SQL audit basis,
  // never from the operator browsing lists that have 500-row caps.
  const summary=useMemo(()=>summarizeProductionDeliveryEvidence(
    firstTenBasis?.orders||[],firstTenBasis?.evidence||[]),[firstTenBasis]);
  const selected=delivered.find((item)=>item.order_id===selectedOrderId)||delivered[0]||null;
  const selectedEvidenceRows=selected?evidence.filter((item)=>
    item.order_id.toLowerCase()===selected.order_id.toLowerCase()):[];
  const selectedEvidence=selectedEvidenceRows[0]||null;
  // A later clean check cannot erase an earlier re-entry incident. Show all
  // immutable audit rows, even if the newest browsing RPC returns them out of order.
  const selectedIncident=selectedEvidenceRows.some((item)=>item.manual_design_reentry===true);
  const selectedDisputed=selectedEvidenceRows.length>1&&selectedEvidenceRows.some((item)=>
    item.manual_design_reentry!==selectedEvidence?.manual_design_reentry);
  const choiceValid=manualChoice!=="unset"&&operator.trim().length>=2&&evidenceReference.trim().length>=3&&(manualChoice==="no"||reentryFields.length>0||note.trim().length>=3);

  function chooseOrder(orderId:string){
    setSelectedOrderId(orderId);
    setManualChoice("unset");
    setReentryFields([]);
    setNote("");
    setOperator("");
    setEvidenceReference("");
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
          evidenceReference,
        }),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Production completion evidence could not be saved.");
      setMessage("Immutable completion audit saved for this delivered order.");
      setManualChoice("unset");setReentryFields([]);setNote("");setOperator("");setEvidenceReference("");
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
    {configured&&!firstTenBasis&&<section className="productionEvidenceNotice">First-ten certification is unavailable until the full-history delivery-event audit migration and verified chronology are available. The order queue remains usable, but browsing results cannot prove release readiness.</section>}
    {deliveryHistoryInvalid&&<section className="productionEvidenceNotice">Delivered-order history is missing or contradicts its delivery-event timestamps. Reconcile the real order transitions before any first-ten certification.</section>}
    {message&&<section className="productionEvidenceNotice">{message}</section>}
    {summary.sourceCoverageUnknown&&<section className="productionEvidenceNotice">Audit proof is incomplete: the 500-row history limit may exclude older deliveries or inspections. Retrieve the full history before certifying the first ten orders.</section>}
    {summary.duplicateEvidenceSourceCount>0&&<section className="productionEvidenceNotice">Shared physical job-card reference detected across distinct delivered orders. Independently identify and review each source before sign-off.</section>}

    <section className="productionEvidenceScore">
      <article><span>EARLIEST DELIVERIES</span><strong>{summary.deliveredCount}/10</strong><small>audited historical snapshot, not total shop orders</small></article>
      <article><span>FIRST 10 AUDITED</span><strong>{summary.auditedTargetCount}/10</strong><small>immutable completion audits</small></article>
      <article><span>ZERO RE-ENTRY</span><strong>{summary.zeroReentryTargetCount}</strong><small>within first 10 delivered</small></article>
      <article data-alert={summary.reentryIncidentCount>0}><span>RE-ENTRY INCIDENTS</span><strong>{summary.reentryIncidentCount}</strong><small>within first 10 delivered</small></article>
      <article data-complete={summary.gateComplete}><span>PHASE 8 GATE</span><strong>{summary.gateComplete?"PROVED":"OPEN"}</strong><small>{summary.gateComplete?"first 10 passed":"requires real evidence"}</small></article>
    </section>

    <section className="productionEvidenceLayout">
      <aside className="productionEvidenceQueue">
        <div className="productionEvidenceSectionHead"><span>DELIVERED ORDER AUDITS</span><b>{delivered.length}</b></div>
        {!delivered.length&&<p>No delivered orders exist yet.</p>}
        {delivered.map((item)=>{
          const row=evidence.find((entry)=>entry.order_id===item.order_id);
          return <button key={item.order_id} className={selected?.order_id===item.order_id?"active":""} onClick={()=>chooseOrder(item.order_id)}>
            <span><b>{item.revision_id}</b>{firstTenOrderIds.has(item.order_id)&&<em>FIRST 10</em>}</span>
            <small>{item.order_id}</small>
            <i data-state={!row?"pending":evidence.some((entry)=>entry.order_id===item.order_id&&entry.manual_design_reentry===true)?"incident":"clean"}>{!row?"audit pending":evidence.some((entry)=>entry.order_id===item.order_id&&entry.manual_design_reentry===true)?"re-entry recorded":"audit recorded"}</i>
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
            <h2>{selectedIncident?"Manual re-entry occurred":selectedDisputed?"Conflicting audits — review required":"No recorded design-data re-entry"}</h2>
            {selectedDisputed&&<p role="alert">Conflicting immutable audit outcomes exist for this order. Reconcile all real production evidence before sign-off.</p>}
            <p>{selectedEvidenceRows.length} immutable completion audit{selectedEvidenceRows.length===1?"":"s"} recorded. A clean audit never cancels an incident.</p>
            {selectedEvidenceRows.map((row)=>(
              <div key={row.evidence_id}>
                <p><b>{row.manual_design_reentry?"Re-entry incident":"No re-entry recorded"}:</b> {row.note||"No additional note."}</p>
                {row.reentry_fields?.length>0&&<p><b>Fields:</b> {row.reentry_fields.join(", ")}</p>}
                <p><b>Evidence reference:</b> {row.evidence_reference||"Legacy audit · provenance not recorded"}</p>
                <small>{row.operator||"Operator not named"} · {Number.isFinite(Date.parse(row.created_at))?new Date(row.created_at).toLocaleString("en-IN"):"Timestamp unverified"}</small>
              </div>
            ))}
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
              <label>Operator / checker<input value={operator} onChange={(event)=>setOperator(event.target.value)} maxLength={120} placeholder="Required"/></label>
              <label>Production-flow evidence reference<input value={evidenceReference} onChange={(event)=>setEvidenceReference(event.target.value)} maxLength={240} placeholder="Tailor job card, cutting packet, dispatch note…"/></label>
              <label>Completion note<textarea rows={4} value={note} onChange={(event)=>setNote(event.target.value)} placeholder="What happened during the real handoff and production flow?"/></label>
            </div>
            <button className="productionEvidenceSave" disabled={busy||!choiceValid} onClick={()=>void saveEvidence()}>{busy?"Saving…":"Save immutable completion audit"}</button>
            <p className="productionEvidenceRule">Save only after checking the actual production workflow. A named checker plus a concrete production-flow reference are required; legacy audits without provenance remain visible but do not satisfy the first-10 gate.</p>
          </>}
        </>}
      </section>
    </section>
  </main>;
}
