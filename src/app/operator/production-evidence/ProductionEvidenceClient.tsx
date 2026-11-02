"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {createOperatorMutationGate} from "@/lib/designer/operator-mutation-gate";
import {requireOperatorCreatedId} from "@/lib/designer/operator-created-id";
import {requireDeliveryEvidenceSnapshot} from "@/lib/designer/operator-delivery-snapshot";
import type {DeliverySnapshotOrder as Order, DeliverySnapshotAudit as Evidence} from "@/lib/designer/operator-delivery-snapshot";
import {
  PRODUCTION_REENTRY_FIELDS,
  summarizeProductionDeliveryEvidence,
} from "@/lib/designer/production-delivery-evidence";


export default function ProductionEvidenceClient(){
  const [orders,setOrders]=useState<Order[]>([]);
  const [evidence,setEvidence]=useState<Evidence[]>([]);
  const [configured,setConfigured]=useState(false);
  const [snapshotState,setSnapshotState]=useState<"loading"|"ready"|"error">("loading");
  const refreshGeneration=useRef(0);
  const mutationGate=useRef(createOperatorMutationGate());
  const [selectedOrderId,setSelectedOrderId]=useState("");
  const [manualChoice,setManualChoice]=useState<"unset"|"yes"|"no">("unset");
  const [reentryFields,setReentryFields]=useState<string[]>([]);
  const [note,setNote]=useState("");
  const [operator,setOperator]=useState("");
  const [evidenceReference,setEvidenceReference]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(expectedReceipt?:{orderId:string;evidenceId:string}):Promise<boolean>{
    const generation=++refreshGeneration.current;
    const previousSelection=selectedOrderId;
    // Invalidate old delivered-order counts before any network request.
    setSnapshotState("loading");
    setConfigured(false);setOrders([]);setEvidence([]);setSelectedOrderId("");
    try{
      const response=await fetch("/api/operator/production-evidence",{cache:"no-store"});
      if(generation!==refreshGeneration.current)return false;
      if(response.status===401){
        setSnapshotState("error");
        window.location.href="/operator/login?next=/operator/production-evidence";
        return false;
      }
      if(!response.ok)throw new Error("Delivery ledger unavailable");
      const snapshot=requireDeliveryEvidenceSnapshot(await response.json());
      if(generation!==refreshGeneration.current)return false;
      if(expectedReceipt&&!snapshot.evidence.some(row=>
        row.order_id.toLowerCase()===expectedReceipt.orderId.toLowerCase()&&
        row.evidence_id.toLowerCase()===expectedReceipt.evidenceId.toLowerCase()))
        throw new Error("New receipt absent from verified ledger");
      const nextOrders=snapshot.orders,nextEvidence=snapshot.evidence;
      const requested=new URLSearchParams(window.location.search).get("order");
      const delivered=nextOrders.filter(item=>item.status==="delivered");
      const requestedDelivered=delivered.find(item=>item.order_id===requested);
      const prior=delivered.find(item=>item.order_id===previousSelection);
      const firstMissing=delivered.find(item=>
        !nextEvidence.some(row=>row.order_id===item.order_id));
      setOrders(nextOrders);setEvidence(nextEvidence);setConfigured(true);
      setSelectedOrderId(prior?.order_id||requestedDelivered?.order_id||
        firstMissing?.order_id||delivered[0]?.order_id||"");
      setSnapshotState("ready");
      setMessage("");
      return true;
    }catch{
      if(generation!==refreshGeneration.current)return false;
      setOrders([]);setEvidence([]);setConfigured(false);
      setSelectedOrderId("");setSnapshotState("error");
      setMessage("Delivery evidence unavailable or unverified. Previous approval totals were cleared.");
      return false;
    }
  }

  useEffect(()=>{void load();},[]);

  const delivered=useMemo(()=>[...orders].filter((item)=>item.status==="delivered").sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)),[orders]);
  const summary=useMemo(()=>summarizeProductionDeliveryEvidence(orders,evidence),[orders,evidence]);
  const selected=delivered.find((item)=>item.order_id===selectedOrderId)||delivered[0]||null;
  const selectedEvidence=selected?evidence.find((item)=>item.order_id===selected.order_id)||null:null;
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
    if(!selected||selectedEvidence||busy||!choiceValid||!configured||
      snapshotState!=="ready"||!mutationGate.current.enter())return;
    setBusy(true);setMessage("");
    // A failed/uncertain POST must not leave an old COMPLETE gate visible.
    refreshGeneration.current++;
    setOrders([]);setEvidence([]);setConfigured(false);
    setSnapshotState("loading");
    try{
      const response=await fetch("/api/operator/production-evidence",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          action:"record",
          orderId:selected.order_id,
          manualDesignReentry:manualChoice==="yes",
          reentryFields,note,operator,evidenceReference,
        }),
      });
      const body:unknown=await response.json();
      const receipt=body&&typeof body==="object"&&!Array.isArray(body)?
        (body as Record<string,unknown>).evidenceId:null;
      if(!response.ok)throw new Error("Delivery audit write could not be verified");
      const evidenceId=requireOperatorCreatedId(receipt);
      const refreshed=await load({orderId:selected.order_id,evidenceId});
      if(!refreshed){
        setMessage("Write acknowledged, but current delivery ledger did not verify the receipt. Reconcile before retrying.");
        return;
      }
      setManualChoice("unset");setReentryFields([]);setNote("");
      setOperator("");setEvidenceReference("");
      setMessage("Immutable completion audit acknowledged and verified in the latest ledger.");
    }catch{
      setOrders([]);setEvidence([]);setConfigured(false);
      setSelectedOrderId("");setSnapshotState("error");
      setMessage("Delivery audit outcome unverified. Refresh the ledger and reconcile before any retry.");
    }finally{
      mutationGate.current.exit();
      setBusy(false);
    }
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

    {snapshotState==="loading"&&<section role="status" className="productionEvidenceNotice">Refreshing delivery evidence; previous counts are withheld.</section>}
    {snapshotState==="error"&&<section role="alert" className="productionEvidenceNotice">Delivery evidence is UNVERIFIED. The latest trusted snapshot is unavailable; do not record another delivery audit until reconciliation.</section>}
    <button type="button" disabled={busy||snapshotState==="loading"} onClick={()=>void load()}>Refresh delivery evidence</button>
    {snapshotState==="ready"&&summary.evidenceIntegrityIssues>0&&
      <section className="productionEvidenceNotice" role="alert">
        Delivery evidence integrity blocked: {summary.evidenceIntegrityIssues} duplicate, malformed or contradictory source records. The first-ten acceptance gate cannot pass until the source ledger is reconciled.
      </section>}
    {message&&<section className="productionEvidenceNotice">{message}</section>}

    <section className="productionEvidenceScore">
      <article><span>DELIVERED</span><strong>{snapshotState==="ready"?summary.deliveredCount:"—"}</strong><small>real completed orders</small></article>
      <article><span>FIRST 10 AUDITED</span><strong>{snapshotState==="ready"?summary.auditedTargetCount:"—"}/10</strong><small>immutable completion audits</small></article>
      <article><span>ZERO RE-ENTRY</span><strong>{snapshotState==="ready"?summary.zeroReentryTargetCount:"—"}</strong><small>within first 10 delivered</small></article>
      <article data-alert={summary.reentryIncidentCount>0}><span>RE-ENTRY INCIDENTS</span><strong>{snapshotState==="ready"?summary.reentryIncidentCount:"—"}</strong><small>within first 10 delivered</small></article>
      <article data-complete={snapshotState==="ready"&&summary.gateComplete}><span>PHASE 8 EVIDENCE GATE</span><strong>{snapshotState!=="ready"?"UNVERIFIED":summary.gateComplete?"SOURCE AUDITED":"OPEN"}</strong><small>{summary.gateComplete&&snapshotState==="ready"?"first ten source audits checked; physical delivery signoff remains separate":"requires current source evidence"}</small></article>
    </section>

    <section className="productionEvidenceLayout">
      <aside className="productionEvidenceQueue">
        <div className="productionEvidenceSectionHead"><span>DELIVERED ORDER AUDITS</span><b>{delivered.length}</b></div>
        {snapshotState==="ready"&&!delivered.length&&<p>No delivered orders exist yet.</p>}
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
            <p><b>Evidence reference:</b> {selectedEvidence.evidence_reference||"Legacy audit · provenance not recorded"}</p>
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
              <label>Operator / checker<input value={operator} onChange={(event)=>setOperator(event.target.value)} maxLength={120} placeholder="Required"/></label>
              <label>Production-flow evidence reference<input value={evidenceReference} onChange={(event)=>setEvidenceReference(event.target.value)} maxLength={240} placeholder="Tailor job card, cutting packet, dispatch note…"/></label>
              <label>Completion note<textarea rows={4} value={note} onChange={(event)=>setNote(event.target.value)} placeholder="What happened during the real handoff and production flow?"/></label>
            </div>
            <button className="productionEvidenceSave" disabled={busy||!choiceValid||snapshotState!=="ready"||!configured} onClick={()=>void saveEvidence()}>{busy?"Saving…":"Save immutable completion audit"}</button>
            <p className="productionEvidenceRule">Save only after checking the actual production workflow. A named checker plus a concrete production-flow reference are required; legacy audits without provenance remain visible but do not satisfy the first-10 gate.</p>
          </>}
        </>}
      </section>
    </section>
  </main>;
}
