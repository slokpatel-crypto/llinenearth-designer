"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FINISHED_GARMENT_QC_CHECKS,
  FINISHED_GARMENT_QC_DEFECTS,
  type FinishedGarmentQcCheckId,
  type FinishedGarmentQcDecision,
} from "@/lib/designer/finished-garment-qc";

type Order={order_id:string;revision_id:string;recipe_hash:string;quote_id:string|null;status:string;note:string;created_at:string};
type Inspection={inspection_id:string;order_id:string;revision_id:string;recipe_hash:string;decision:"approved"|"rework";checks:Record<string,boolean>;defects:string[];note:string;inspector:string;inspection_reference?:string;created_at:string};

function emptyChecks(){
  return Object.fromEntries(FINISHED_GARMENT_QC_CHECKS.map((item)=>[item.id,false])) as Record<FinishedGarmentQcCheckId,boolean>;
}

export default function GarmentQcClient(){
  const [orders,setOrders]=useState<Order[]>([]);
  const [inspections,setInspections]=useState<Inspection[]>([]);
  const [configured,setConfigured]=useState(true);
  const [selectedOrderId,setSelectedOrderId]=useState("");
  const [checks,setChecks]=useState<Record<FinishedGarmentQcCheckId,boolean>>(emptyChecks);
  const [defects,setDefects]=useState<string[]>([]);
  const [note,setNote]=useState("");
  const [inspector,setInspector]=useState("");
  const [inspectionReference,setInspectionReference]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/garment-qc",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/garment-qc";return;}
    const data=await response.json();
    if(!response.ok){setMessage(data.error||"Finished-garment QC could not be loaded.");return;}
    const nextOrders=Array.isArray(data.orders)?data.orders:[];
    setConfigured(data.configured!==false);
    setOrders(nextOrders);
    setInspections(Array.isArray(data.inspections)?data.inspections:[]);
    const requested=new URLSearchParams(window.location.search).get("order");
    const requestedReady=nextOrders.find((item:Order)=>item.status==="ready"&&item.order_id===requested);
    const firstReady=nextOrders.find((item:Order)=>item.status==="ready");
    setSelectedOrderId((current)=>current||requestedReady?.order_id||firstReady?.order_id||"");
  }

  useEffect(()=>{void load();},[]);

  const readyOrders=useMemo(()=>orders.filter((item)=>item.status==="ready"),[orders]);
  const selected=readyOrders.find((item)=>item.order_id===selectedOrderId)||readyOrders[0]||null;
  const selectedHistory=useMemo(()=>selected?inspections.filter((item)=>item.order_id===selected.order_id):[],[inspections,selected]);
  const latest=selectedHistory[0]||null;
  const allPass=FINISHED_GARMENT_QC_CHECKS.every((item)=>checks[item.id]);
  const provenanceReady=inspector.trim().length>=2&&inspectionReference.trim().length>=3;
  const reworkHasReason=(defects.length>0||note.trim().length>=3)&&provenanceReady;

  function chooseOrder(orderId:string){
    setSelectedOrderId(orderId);setChecks(emptyChecks());setDefects([]);setNote("");setInspector("");setInspectionReference("");setMessage("");
  }
  function toggleDefect(id:string){
    setDefects((current)=>current.includes(id)?current.filter((item)=>item!==id):[...current,id]);
  }

  async function recordDecision(decision:FinishedGarmentQcDecision){
    if(!selected||busy) return;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/operator/garment-qc",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"record",orderId:selected.order_id,decision,checks,defects,note,inspector,inspectionReference}),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Finished-garment QC could not be recorded.");
      setMessage(decision==="approved"?"QC approved. Delivery is now unlocked for this order.":"Rework recorded. The order was returned to stitching automatically.");
      setChecks(emptyChecks());setDefects([]);setNote("");setInspector("");setInspectionReference("");await load();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Finished-garment QC could not be recorded.");
    }finally{setBusy(false);}
  }

  return <main className="garmentQc">
    <header className="garmentQcHeader">
      <div>
        <span>LINEN EARTH / PRIVATE OPERATOR / PHYSICAL GATE</span>
        <h1>Finished Garment QC</h1>
        <p>Inspect the real garment against its locked production identity before delivery. Approval is append-only evidence; a rework decision sends the order back to stitching.</p>
      </div>
      <nav><Link href="/operator">Operator Desk</Link><Link href="/operator/production">Production Desk</Link><Link href="/operator/stock">Stock Ledger</Link></nav>
    </header>

    {!configured&&<section className="garmentQcNotice">Supabase QC migration is not installed yet. Apply the Roadmap v2 migrations before operational use.</section>}
    {message&&<section className="garmentQcNotice">{message}</section>}

    <section className="garmentQcLayout">
      <aside className="garmentQcOrders">
        <div className="garmentQcSectionHead"><span>01 / READY QUEUE</span><b>{readyOrders.length}</b></div>
        {!readyOrders.length&&<p>No orders are waiting at the ready-for-QC gate.</p>}
        {readyOrders.map((item)=>{
          const itemLatest=inspections.find((inspection)=>inspection.order_id===item.order_id);
          return <button key={item.order_id} className={selected?.order_id===item.order_id?"active":""} onClick={()=>chooseOrder(item.order_id)}>
            <span>{item.revision_id}</span><small>{item.order_id}</small>
            <em data-decision={itemLatest?.decision||"pending"}>{itemLatest?.decision||"pending"}</em>
          </button>;
        })}
      </aside>

      <section className="garmentQcPanel">
        {!selected?<div className="garmentQcEmpty"><h2>Nothing to inspect.</h2><p>When a production order reaches Ready, it will appear here.</p></div>:<>
          <div className="garmentQcIdentity">
            <span><small>ORDER</small><b>{selected.order_id}</b></span>
            <span><small>REVISION</small><b>{selected.revision_id}</b></span>
            <span><small>RECIPE HASH</small><b>{selected.recipe_hash}</b></span>
            <span><small>LATEST QC</small><b>{latest?latest.decision.toUpperCase():"NOT INSPECTED"}</b></span>
          </div>

          <div className="garmentQcChecks">
            <div className="garmentQcSectionHead"><span>02 / PHYSICAL CHECKS</span><b>{FINISHED_GARMENT_QC_CHECKS.filter((item)=>checks[item.id]).length}/{FINISHED_GARMENT_QC_CHECKS.length}</b></div>
            {FINISHED_GARMENT_QC_CHECKS.map((item)=><label key={item.id}>
              <input type="checkbox" checked={checks[item.id]} onChange={(event)=>setChecks({...checks,[item.id]:event.target.checked})}/>
              <span><b>{item.label}</b><small>Confirm only after checking the physical garment.</small></span>
            </label>)}
          </div>

          <div className="garmentQcDefects">
            <span>03 / DEFECT TAGS — USE FOR REWORK</span>
            <div>{FINISHED_GARMENT_QC_DEFECTS.map((item)=><button key={item.id} aria-pressed={defects.includes(item.id)} onClick={()=>toggleDefect(item.id)}>{item.label}</button>)}</div>
          </div>

          <div className="garmentQcNotes">
            <label>Inspector / checker<input value={inspector} onChange={(event)=>setInspector(event.target.value)} maxLength={120} placeholder="Required"/></label>
            <label>Physical inspection reference<input value={inspectionReference} onChange={(event)=>setInspectionReference(event.target.value)} maxLength={240} placeholder="QC sheet, tailor card, inspection batch…"/></label>
            <label>Inspection note<textarea rows={4} value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Physical findings, alteration instruction, or approval note."/></label>
          </div>

          <div className="garmentQcActions">
            <button className="rework" disabled={busy||!reworkHasReason} onClick={()=>void recordDecision("rework")}>{busy?"Saving…":"Record rework"}</button>
            <button disabled={busy||!allPass||!provenanceReady} onClick={()=>void recordDecision("approved")}>{busy?"Saving…":"Approve for delivery"}</button>
          </div>

          <div className="garmentQcHistory">
            <div className="garmentQcSectionHead"><span>04 / INSPECTION HISTORY</span><b>{selectedHistory.length}</b></div>
            {!selectedHistory.length&&<p>No QC evidence has been recorded for this order.</p>}
            {selectedHistory.map((item)=><article key={item.inspection_id}>
              <div><strong>{item.decision.toUpperCase()}</strong><small>{new Date(item.created_at).toLocaleString("en-IN")}</small></div>
              <span>{item.inspector||"Inspector not named"} · {item.inspection_reference||"Legacy inspection · provenance not recorded"}</span>
              {item.defects?.length>0&&<p>Defects: {item.defects.join(", ")}</p>}
              {item.note&&<p>{item.note}</p>}
            </article>)}
          </div>
        </>}
      </section>
    </section>
  </main>;
}
