"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createOperatorMutationGate } from "@/lib/designer/operator-mutation-gate";
import { requireStockClientAcknowledgment } from "@/lib/designer/operator-stock-client-ack";
import { createStockReservationAttemptTracker, type StockReservationAttempt } from "@/lib/designer/stock-reservation-attempt";
import { stockMutationNeedsReconciliation } from "@/lib/designer/stock-mutation-reconciliation";
import { createStockManualAttemptTracker } from "@/lib/designer/stock-manual-attempt";
import { createStockUncertainJournal } from "@/lib/designer/stock-uncertain-journal";

type StockRow={fabric_id:string;physical_metres:number;reserved_metres:number;available_metres:number;manual_event_count:number;provenance_event_count:number;legacy_unverified_event_count:number;provenance_ready:boolean;last_event_at:string|null};

export default function StockClient(){
  const [stock,setStock]=useState<StockRow[]>([]);
  const [configured,setConfigured]=useState(true);
  const [snapshotState,setSnapshotState]=useState<"loading"|"ready"|"error">("loading");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [uncertainWrite,setUncertainWrite]=useState(false);
  const uncertainWriteRef=useRef(false);
  const mutationGate=useRef(createOperatorMutationGate());
  const reservationAttempt=useRef(createStockReservationAttemptTracker(()=>crypto.randomUUID()));
  const manualAttempt=useRef(createStockManualAttemptTracker(()=>crypto.randomUUID(),()=>window.sessionStorage));
  const uncertainJournal=useRef(createStockUncertainJournal());
  const [form,setForm]=useState({fabricId:"",eventType:"receipt",quantityMetres:"",recordedBy:"",sourceReference:"",note:""});
  const [reservation,setReservation]=useState({fabricId:"",revisionId:"",quantityMetres:"",requestedBy:"",sourceReference:""});
  const [close,setClose]=useState({reservationId:"",actualMetres:"",checkedBy:"",sourceReference:"",note:""});

  async function load():Promise<boolean>{
    // A stale previous snapshot must not remain actionable while a new ledger
    // read is in flight, especially after a confirmed write.
    setSnapshotState("loading");
    try{
      const response=await fetch("/api/operator/stock",{cache:"no-store"});
      if(response.status===401){
        setConfigured(false);setStock([]);setSnapshotState("error");
        window.location.href="/operator/login?next=/operator/stock";
        return false;
      }
      if(!response.ok) throw new Error("Stock ledger request failed.");
      const data:unknown=await response.json();
      if(!data||typeof data!=="object"||!("stock" in data)||!Array.isArray(data.stock)||
        !("configured" in data)||data.configured!==true)
        throw new Error("Stock ledger response is invalid.");
      setConfigured(true);
      setStock(data.stock as StockRow[]);
      setSnapshotState("ready");
      return true;
    }catch{
      // Never show an API failure as verified zero metres of cloth.
      setConfigured(false);
      setStock([]);
      setSnapshotState("error");
      return false;
    }
  }
  useEffect(()=>{
    // Recovery must run before the first verified snapshot can enable buttons.
    if(uncertainJournal.current.isBlocked()){
      uncertainWriteRef.current=true;
      setUncertainWrite(true);
      setMessage("An earlier stock operation might have committed before this tab reloaded. Check the ledger and physical source before another movement.");
    }
    void load();
    const params=new URLSearchParams(window.location.search);
    const fabricId=params.get("fabric")||"";
    const revisionId=params.get("revision")||"";
    const metres=params.get("metres")||"";
    if(fabricId||revisionId||metres) {
      setReservation((current)=>({
        ...current,
        fabricId:fabricId.slice(0,160),
        revisionId:revisionId.slice(0,220),
        quantityMetres:/^\d+(?:\.\d+)?$/.test(metres)?metres:current.quantityMetres,
      }));
    }
  },[]);

  async function post(body:Record<string,unknown>,success:string,reservationDraft?:StockReservationAttempt){
    if(uncertainWriteRef.current||uncertainWrite||busy||snapshotState!=="ready"||!configured||!mutationGate.current.enter()) return;
    setBusy(true);setMessage("");
    let requestSent=false,acknowledged=false,httpStatus:number|null=null;
    let markedPending=false;
    try{
      if(body.action==="reserve"&&reservationDraft){
        // An uncertain reservation must never invent a new idempotency key
        // after a reload; store the evidence hash before the privileged RPC.
        body={...body,requestKey:await reservationAttempt.current.keyFor(reservationDraft)};
      }
      if(body.action==="record"){
        const manual={
          fabricId:String(body.fabricId||""),eventType:String(body.eventType||""),
          quantityMetres:Number(body.quantityMetres),note:String(body.note||""),
          recordedBy:String(body.recordedBy||""),sourceReference:String(body.sourceReference||""),
        };
        // Persist the retry identity before the privileged POST, and only
        // after the single-flight gate has locked out duplicate clicks.
        const requestKey=await manualAttempt.current.keyFor(manual);
        body={...body,requestKey};
      }
      if(uncertainJournal.current.isBlocked()){
        uncertainWriteRef.current=true;
        setUncertainWrite(true);
        throw new Error("An earlier stock write still needs physical ledger reconciliation.");
      }
      // The marker MUST survive tab reload even when the HTTP response is lost.
      // A missing/blocked storage write prevents the privileged mutation.
      uncertainJournal.current.markPending();
      markedPending=true;
      requestSent=true;
      const response=await fetch("/api/operator/stock",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      httpStatus=response.status;
      const data:unknown=await response.json();
      if(!response.ok){
        const error=data&&typeof data==="object"&&!Array.isArray(data)&&"error" in data&&
          typeof data.error==="string"?data.error:"Stock operation failed.";
        throw new Error(error);
      }
      requireStockClientAcknowledgment(body.action,data);
      acknowledged=true;
      const refreshed=await load();
      setMessage(refreshed?success:
        "Stock operation acknowledged, but ledger refresh is unavailable. Check the ledger before retrying.");
    }catch(error){
      if(stockMutationNeedsReconciliation(requestSent,acknowledged,httpStatus)){
        uncertainWriteRef.current=true;
        setUncertainWrite(true);
        setMessage("Stock write outcome is uncertain. It may have committed. Check the actual ledger entries and physical source evidence before another write.");
      }else setMessage(error instanceof Error?error.message:"Stock operation failed.");
    }
    finally{
      if(markedPending&&!stockMutationNeedsReconciliation(requestSent,acknowledged,httpStatus)){
        if(!uncertainJournal.current.clearPending()){
          uncertainWriteRef.current=true;
          setUncertainWrite(true);
          setMessage("Stock tracking could not clear its pending marker. Reconcile the ledger and source before continuing.");
        }
      }
      mutationGate.current.exit();setBusy(false);
    }
  }

  const totalAvailable=stock.reduce((sum,row)=>sum+Number(row.available_metres||0),0);
  const totalReserved=stock.reduce((sum,row)=>sum+Number(row.reserved_metres||0),0);
  const positiveStock=stock.filter((row)=>Number(row.physical_metres)>0);
  const provenanceReady=positiveStock.length>0&&positiveStock.every((row)=>row.provenance_ready===true);
  const legacyUnverified=stock.reduce((sum,row)=>sum+Number(row.legacy_unverified_event_count||0),0);

  return <main className="stockDesk">
    <header className="stockHeader">
      <div><span>LINEN EARTH / PRIVATE OPERATOR</span><h1>Fabric Stock Ledger</h1><p>Append-only physical metres, reservations and consumption. Opening stock must be entered from real measurements; this screen never invents availability.</p></div>
      <nav><Link href="/operator">Operator Desk</Link><Link href="/operator/production-calibration">Production Calibration</Link></nav>
    </header>

    {snapshotState==="error"&&<p className="stockMessage" role="alert">Physical stock ledger unavailable. Metres and provenance cannot be confirmed; do not reserve or cut against a missing snapshot.</p>}
    {uncertainWrite&&<section className="stockMessage" role="alert">
      <p>Uncertain stock write: do not submit another movement until you have checked the real ledger event and its physical source reference. A successful snapshot refresh alone does not prove whether the previous write committed.</p>
      <button disabled={busy||snapshotState==="loading"} onClick={()=>{void (async()=>{
        if(await load()){
          // A verified snapshot is not enough: the operator must also restore
          // the persisted fail-closed marker or remain locked after a reload.
          if(!uncertainJournal.current.clearPending()){
            setMessage("Unable to clear pending stock uncertainty. Do not submit new stock movements.");
            return;
          }
          uncertainWriteRef.current=false;
          setUncertainWrite(false);
          setMessage("Ledger reloaded after operator reconciliation. Confirm the original event and source before any new stock movement.");
        }
      })();}}>I checked the ledger and source; refresh to unlock</button>
    </section>}
    <section className="stockStats">
      <article><small>FABRICS TRACKED</small><strong>{snapshotState==="ready"?stock.length:"—"}</strong></article>
      <article><small>AVAILABLE</small><strong>{snapshotState==="ready"?`${totalAvailable.toFixed(3)} m`:"—"}</strong></article>
      <article><small>RESERVED</small><strong>{snapshotState==="ready"?`${totalReserved.toFixed(3)} m`:"—"}</strong></article>
      <article><small>PHYSICAL PROVENANCE</small><strong>{snapshotState==="ready"?(provenanceReady?"RECORDED":"PENDING"):"UNAVAILABLE"}</strong><small>{snapshotState==="ready"?<>Documented entries only; not independent roll or metreage certification. {legacyUnverified} legacy/unverified manual event(s)</>:"Awaiting an accessible ledger snapshot; no provenance claim is possible."}</small></article>
      <article><small>BACKEND</small><strong>{snapshotState==="error"?"UNAVAILABLE":snapshotState==="loading"?"CHECKING":configured?"LIVE":"NOT CONFIGURED"}</strong></article>
    </section>

    <section className="stockGrid">
      <article className="stockPanel">
        <span>01 / PHYSICAL STOCK</span><h2>Record verified metres.</h2><p>Unchanged evidence reuses its original stock event across page reloads in this tab; supply a different measured roll/source reference for a new receipt. No stock entry is sent if safe retry tracking is unavailable.</p>
        <label>Fabric ID<input value={form.fabricId} onChange={(e)=>setForm({...form,fabricId:e.target.value})}/></label>
        <label>Event<select value={form.eventType} onChange={(e)=>setForm({...form,eventType:e.target.value})}><option value="receipt">Receipt / opening verified stock</option><option value="adjustment_in">Adjustment in</option><option value="adjustment_out">Adjustment out</option></select></label>
        <label>Metres<input type="number" min=".001" step=".001" value={form.quantityMetres} onChange={(e)=>setForm({...form,quantityMetres:e.target.value})}/></label>
        <label>Recorded by / checker<input value={form.recordedBy} onChange={(e)=>setForm({...form,recordedBy:e.target.value})} maxLength={120} placeholder="Required"/></label>
        <label>Physical source reference<input value={form.sourceReference} onChange={(e)=>setForm({...form,sourceReference:e.target.value})} maxLength={240} placeholder="Roll tag, receipt, stock-count sheet…"/></label>
        <label>Note<textarea rows={2} value={form.note} onChange={(e)=>setForm({...form,note:e.target.value})}/></label>
        <button disabled={uncertainWrite||busy||snapshotState!=="ready"||!configured||!form.fabricId||Number(form.quantityMetres)<=0||form.recordedBy.trim().length<2||form.sourceReference.trim().length<3} onClick={()=>void post({action:"record",...form,quantityMetres:Number(form.quantityMetres)},"Provenance-backed stock event recorded.")}>Record stock event</button>
      </article>

      <article className="stockPanel">
        <span>02 / RESERVE</span><h2>Hold cloth for a locked design.</h2>
        <label>Fabric ID<input value={reservation.fabricId} onChange={(e)=>setReservation({...reservation,fabricId:e.target.value})}/></label>
        <label>Locked revision ID<input value={reservation.revisionId} onChange={(e)=>setReservation({...reservation,revisionId:e.target.value})}/></label>
        <label>Metres to reserve<input type="number" min=".001" step=".001" value={reservation.quantityMetres} onChange={(e)=>setReservation({...reservation,quantityMetres:e.target.value})}/></label>
        <label>Requested / checked by<input value={reservation.requestedBy} onChange={(e)=>setReservation({...reservation,requestedBy:e.target.value})} maxLength={120} placeholder="Required"/></label>
        <label>Reservation quantity source<input value={reservation.sourceReference} onChange={(e)=>setReservation({...reservation,sourceReference:e.target.value})} maxLength={240} placeholder="Approved meterage sheet, tailor request…"/></label>
        <button disabled={uncertainWrite||busy||snapshotState!=="ready"||!configured||!reservation.fabricId||reservation.revisionId.length<12||Number(reservation.quantityMetres)<=0||reservation.requestedBy.trim().length<2||reservation.sourceReference.trim().length<3} onClick={()=>{const draft={...reservation,quantityMetres:Number(reservation.quantityMetres)};void post({action:"reserve",...draft,},"Provenance-backed reservation created.",draft);}}>Create reservation</button>
      </article>

      <article className="stockPanel">
        <span>03 / CLOSE RESERVATION</span><h2>Consume or release.</h2>
        <label>Reservation UUID<input value={close.reservationId} onChange={(e)=>setClose({...close,reservationId:e.target.value})}/></label>
        <label>Actual metres used<input type="number" min=".001" step=".001" value={close.actualMetres} onChange={(e)=>setClose({...close,actualMetres:e.target.value})}/></label>
        <label>Close action checked by<input value={close.checkedBy} onChange={(e)=>setClose({...close,checkedBy:e.target.value})} maxLength={120} placeholder="Required"/></label>
        <label>Close action source<input value={close.sourceReference} onChange={(e)=>setClose({...close,sourceReference:e.target.value})} maxLength={240} placeholder="Cutting sheet, cancellation note, usage card…"/></label>
        <label>Note<textarea rows={2} value={close.note} onChange={(e)=>setClose({...close,note:e.target.value})}/></label>
        <div className="stockActions">
          <button disabled={uncertainWrite||busy||snapshotState!=="ready"||!configured||!close.reservationId||Number(close.actualMetres)<=0||close.checkedBy.trim().length<2||close.sourceReference.trim().length<3} onClick={()=>void post({action:"consume",reservationId:close.reservationId,actualMetres:Number(close.actualMetres),checkedBy:close.checkedBy,sourceReference:close.sourceReference,note:close.note},"Reservation consumed from measured usage and unused metres released.")}>Consume</button>
          <button disabled={uncertainWrite||busy||snapshotState!=="ready"||!configured||!close.reservationId||close.checkedBy.trim().length<2||close.sourceReference.trim().length<3} onClick={()=>void post({action:"release",reservationId:close.reservationId,releasedBy:close.checkedBy,sourceReference:close.sourceReference,note:close.note},"Reservation released.")}>Release</button>
        </div>
      </article>
    </section>

    {message&&<p className="stockMessage">{message}</p>}

    <section className="stockTable">
      <div>
        <span>{snapshotState==="ready"?"LIVE SNAPSHOT":"SNAPSHOT NOT VERIFIED"}</span>
        <h2>Available metres by fabric.</h2>
        <p>Named ledger references alone do not certify physical roll counts or independently verify supplier measurements.</p>
        <button type="button" disabled={busy||snapshotState==="loading"}
          onClick={()=>void load()}>{snapshotState==="loading"?"Checking ledger…":"Refresh ledger"}</button>
      </div>
      {snapshotState==="loading"&&<p role="status">Checking the live stock ledger. Previous physical balances are hidden until verification completes.</p>}
      {snapshotState==="error"&&<p role="alert">Stock balances are unavailable. Refresh the ledger before recording, reserving or cutting cloth.</p>}
      {snapshotState==="ready"&&!stock.length&&<p>No physical stock has been recorded yet.</p>}
      {snapshotState==="ready"&&stock.map((row)=><article key={row.fabric_id}>
        <b>{row.fabric_id}</b>
        <span>Physical <strong>{Number(row.physical_metres).toFixed(3)} m</strong></span>
        <span>Reserved <strong>{Number(row.reserved_metres).toFixed(3)} m</strong></span>
        <span>Available <strong>{Number(row.available_metres).toFixed(3)} m</strong></span>
        <span>Ledger references <strong>{row.provenance_ready?"recorded":"incomplete"}</strong></span>
        <small>{Number(row.provenance_event_count||0)}/{Number(row.manual_event_count||0)} manual events verified · {row.last_event_at?new Date(row.last_event_at).toLocaleString("en-IN"):"—"}</small>
      </article>)}
    </section>
  </main>;
}
