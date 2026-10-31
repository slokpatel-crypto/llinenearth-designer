"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { normalizeManualStockEvent, stockManualRecordAttempt, stockManualRecordSignature, stockReservationAttempt, stockReservationSignature } from "@/lib/designer/stock-ledger";
import { validateOperatorStockSnapshot, verifiedOperatorStockMutationReceipt, verifyOperatorStockSourceAudit, type OperatorStockSourceAudit } from "@/lib/designer/operator-stock-safety";

type StockRow={fabric_id:string;physical_metres:number;reserved_metres:number;available_metres:number;manual_event_count:number;provenance_event_count:number;legacy_unverified_event_count:number;provenance_ready:boolean;last_event_at:string|null};

export default function StockClient(){
  const [stock,setStock]=useState<StockRow[]>([]);
  const [configured,setConfigured]=useState(true);
  const [snapshotState,setSnapshotState]=useState<"loading"|"ready"|"error">("loading");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  // React's busy state is asynchronous; a synchronous gate stops same-render
  // double-clicks. Keep request keys for an unchanged intent even if the
  // operator edits and later returns to it after an ambiguous network result.
  const writeInFlight=useRef(false);
  const readGeneration=useRef(0);
  const auditGeneration=useRef(0);
  const [sourceAudit,setSourceAudit]=useState<OperatorStockSourceAudit|null>(null);
  const [auditStatus,setAuditStatus]=useState<"idle"|"loading"|"ready"|"error">("idle");
  const reservationKeys=useRef(new Map<string,string>());
  const manualRecordKeys=useRef(new Map<string,string>());
  const [confirmedReservations,setConfirmedReservations]=useState<ReadonlySet<string>>(()=>new Set());
  const [confirmedManualRecords,setConfirmedManualRecords]=useState<ReadonlySet<string>>(()=>new Set());
  const [form,setForm]=useState({fabricId:"",eventType:"receipt",quantityMetres:"",recordedBy:"",sourceReference:"",note:""});
  const [reservation,setReservation]=useState({fabricId:"",revisionId:"",quantityMetres:"",requestedBy:"",sourceReference:""});
  const [close,setClose]=useState({reservationId:"",actualMetres:"",checkedBy:"",sourceReference:"",note:""});

  async function load():Promise<boolean>{
    const generation=++readGeneration.current;
    setSnapshotState("loading");
    setConfigured(false);
    setStock([]);
    try{
      const response=await fetch("/api/operator/stock",{cache:"no-store"});
      if(generation!==readGeneration.current) return false;
      if(response.status===401){window.location.href="/operator/login?next=/operator/stock";return false;}
      if(!response.ok) throw new Error("Stock ledger request failed.");
      const data:unknown=await response.json();
      if(generation!==readGeneration.current) return false;
      if(!data||typeof data!=="object"||!("stock" in data)||
         !("configured" in data)||data.configured!==true)
        throw new Error("Stock ledger response is invalid.");
      // A 200 response cannot authorize a physical metre count by itself.
      // Recheck every SKU, quantity, provenance and duplicate in the browser.
      const verifiedStock=validateOperatorStockSnapshot(data.stock);
      if(verifiedStock===null)throw new Error("Stock ledger rows are inconsistent.");
      setConfigured(true);
      setStock(verifiedStock);
      setSnapshotState("ready");
      return true;
    }catch{
      if(generation===readGeneration.current){
        // Never show a failed, superseded or ambiguous GET as verified stock.
        setConfigured(false);
        setStock([]);
        setSnapshotState("error");
      }
      return false;
    }
  }
  useEffect(()=>{
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

  async function loadSourceAudit(){
    if(writeInFlight.current||auditStatus==="loading")return;
    const generation=++auditGeneration.current;
    setSourceAudit(null);
    setAuditStatus("loading");
    try{
      const response=await fetch("/api/operator/stock/audit",{cache:"no-store"});
      if(generation!==auditGeneration.current)return;
      if(response.status===401){
        window.location.href="/operator/login?next=/operator/stock";
        return;
      }
      if(!response.ok)throw new Error("Audit is unavailable.");
      const payload:unknown=await response.json();
      if(generation!==auditGeneration.current)return;
      if(!payload||typeof payload!=="object"||!("audit" in payload))
        throw new Error("Missing audit counters.");
      const safe=verifyOperatorStockSourceAudit(payload.audit);
      if(!safe)throw new Error("Invalid audit counters.");
      setSourceAudit(safe);
      setAuditStatus("ready");
    }catch{
      if(generation===auditGeneration.current){
        setSourceAudit(null);
        setAuditStatus("error");
      }
    }
  }

  async function post(body:Record<string,unknown>,success:string,reservationSignature?:string,manualSignature?:string){
    if(writeInFlight.current||snapshotState!=="ready"||!configured||
       (reservationSignature&&confirmedReservations.has(reservationSignature))||
       (manualSignature&&confirmedManualRecords.has(manualSignature))) return;
    writeInFlight.current=true;
    // Invalidate outstanding stock reads BEFORE sending a mutation. A GET
    // started earlier cannot restore pre-write availability after the POST.
    readGeneration.current++;
    auditGeneration.current++; // Late audit responses cannot restore pre-mutation counts.
    setSourceAudit(null);
    setAuditStatus("idle");
    setStock([]);setConfigured(false);setSnapshotState("loading");
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/operator/stock",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),
      });
      const data:unknown=await response.json();
      if(!response.ok){
        const error=data&&typeof data==="object"&&"error" in data&&typeof data.error==="string"
          ?data.error:"Stock operation failed.";
        throw new Error(error);
      }
      // A success-shaped HTTP response must contain the exact event UUID,
      // reservation UUID or literal close acknowledgement for this action.
      if(!verifiedOperatorStockMutationReceipt(body.action,data))
        throw new Error("Stock operation receipt could not be verified.");
      if(reservationSignature)
        setConfirmedReservations(previous=>new Set([...previous,reservationSignature]));
      if(manualSignature)
        setConfirmedManualRecords(previous=>new Set([...previous,manualSignature]));
      setMessage(success);
    }catch(error){
      const detail=error instanceof Error?error.message:"Stock operation failed.";
      const warning=reservationSignature||manualSignature
        ?"Outcome may be uncertain. Check the live ledger; retrying identical details reuses the same request key."
        :"Check the stock ledger before retrying; an earlier request might already have changed physical stock.";
      setMessage(detail+" "+warning);
    }finally{
      // Even a timeout or invalid JSON may follow a committed SQL mutation.
      // Reconcile from the server before enabling a new operator action.
      await load();
      writeInFlight.current=false;
      setBusy(false);
    }
  }

  // A source worksheet must not be counted twice when a response is lost.
  // Normalization runs before deriving the retry key, so cosmetic whitespace
  // edits cannot invent a second physical event for the same evidence.
  const manualRecordSignature=(()=>{
    try{
      return stockManualRecordSignature(normalizeManualStockEvent({
        ...form,quantityMetres:Number(form.quantityMetres),
      }));
    }catch{return null;}
  })();
  function submitManualRecord(){
    if(writeInFlight.current||!manualRecordSignature||
       confirmedManualRecords.has(manualRecordSignature)) return;
    try{
      const intent=normalizeManualStockEvent({...form,quantityMetres:Number(form.quantityMetres)});
      const attempt=stockManualRecordAttempt(manualRecordKeys.current,intent,()=>crypto.randomUUID());
      manualRecordKeys.current.set(attempt.signature,attempt.requestKey);
      void post({action:"record",...intent,requestKey:attempt.requestKey},
        "Provenance-backed stock event recorded.",undefined,attempt.signature);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Invalid physical stock evidence.");
    }
  }

  const reservationIntent={
    fabricId:reservation.fabricId,revisionId:reservation.revisionId,
    quantityMetres:Number(reservation.quantityMetres),
    requestedBy:reservation.requestedBy,sourceReference:reservation.sourceReference,
  };
  const reservationSignature=stockReservationSignature(reservationIntent);
  function submitReservation(){
    if(writeInFlight.current||confirmedReservations.has(reservationSignature)) return;
    const attempt=stockReservationAttempt(reservationKeys.current,reservationIntent,()=>crypto.randomUUID());
    reservationKeys.current.set(attempt.signature,attempt.requestKey);
    void post({action:"reserve",...reservationIntent,requestKey:attempt.requestKey},
      "Provenance-backed reservation created.",attempt.signature);
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
    <section className="stockStats">
      <article><small>FABRICS TRACKED</small><strong>{snapshotState==="ready"?stock.length:"—"}</strong></article>
      <article><small>AVAILABLE</small><strong>{snapshotState==="ready"?`${totalAvailable.toFixed(3)} m`:"—"}</strong></article>
      <article><small>RESERVED</small><strong>{snapshotState==="ready"?`${totalReserved.toFixed(3)} m`:"—"}</strong></article>
      <article><small>PHYSICAL PROVENANCE</small><strong>{snapshotState==="ready"?(provenanceReady?"RECORDED":"PENDING"):"UNAVAILABLE"}</strong><small>{snapshotState==="ready"?<>Documented entries only; not independent roll or metreage certification. {legacyUnverified} legacy/unverified manual event(s)</>:"Awaiting an accessible ledger snapshot; no provenance claim is possible."}</small></article>
      <article><small>BACKEND</small><strong>{snapshotState==="error"?"UNAVAILABLE":snapshotState==="loading"?"CHECKING":configured?"LIVE":"NOT CONFIGURED"}</strong></article>
    </section>

    <section className="stockGrid">
      <article className="stockPanel">
        <span>01 / PHYSICAL STOCK</span><h2>Record verified metres.</h2>
        <label>Fabric ID<input value={form.fabricId} onChange={(e)=>setForm({...form,fabricId:e.target.value})}/></label>
        <label>Event<select value={form.eventType} onChange={(e)=>setForm({...form,eventType:e.target.value})}><option value="receipt">Receipt / opening verified stock</option><option value="adjustment_in">Adjustment in</option><option value="adjustment_out">Adjustment out</option></select></label>
        <label>Metres<input type="number" min=".001" step=".001" value={form.quantityMetres} onChange={(e)=>setForm({...form,quantityMetres:e.target.value})}/></label>
        <label>Recorded by / checker<input value={form.recordedBy} onChange={(e)=>setForm({...form,recordedBy:e.target.value})} maxLength={120} placeholder="Required"/></label>
        <label>Physical source reference<input value={form.sourceReference} onChange={(e)=>setForm({...form,sourceReference:e.target.value})} maxLength={240} placeholder={form.eventType==="receipt"?"Actual roll tag + supplier receipt LINE ID":"Actual adjustment / count document line"}/></label>
        <p className="stockMessage">For a receipt, use the real supplier document AND exact physical roll/line identity, not a generic invoice number. Reusing that line for this fabric cannot create more stock, even with a different request key. Never invent a line ID. Adjustments require their own genuine evidence.</p>
        <label>Note<textarea rows={2} value={form.note} onChange={(e)=>setForm({...form,note:e.target.value})}/></label>
        <button disabled={busy||snapshotState!=="ready"||!configured||!manualRecordSignature||confirmedManualRecords.has(manualRecordSignature)} onClick={submitManualRecord}>Record stock event</button>
        {manualRecordSignature&&confirmedManualRecords.has(manualRecordSignature)&&<p className="stockMessage">This exact stock entry is already recorded in this session. Use a distinct physical source document for a new event.</p>}
      </article>

      <article className="stockPanel">
        <span>02 / RESERVE</span><h2>Hold cloth for a locked design.</h2>
        <label>Fabric ID<input value={reservation.fabricId} onChange={(e)=>setReservation({...reservation,fabricId:e.target.value})}/></label>
        <label>Locked revision ID<input value={reservation.revisionId} onChange={(e)=>setReservation({...reservation,revisionId:e.target.value})}/></label>
        <label>Metres to reserve<input type="number" min=".001" step=".001" value={reservation.quantityMetres} onChange={(e)=>setReservation({...reservation,quantityMetres:e.target.value})}/></label>
        <label>Requested / checked by<input value={reservation.requestedBy} onChange={(e)=>setReservation({...reservation,requestedBy:e.target.value})} maxLength={120} placeholder="Required"/></label>
        <label>Meterage sheet + documented line reference<input value={reservation.sourceReference} onChange={(e)=>setReservation({...reservation,sourceReference:e.target.value})} maxLength={240} placeholder="Approved sheet ID / actual order line ID"/></label>
        <p className="stockMessage">Use the real document and its exact line/item reference. A sheet may cover multiple locked orders, but one fabric + revision + source line cannot reserve twice. Do not invent a new line reference to bypass a duplicate.</p>
        <button disabled={busy||snapshotState!=="ready"||!configured||confirmedReservations.has(reservationSignature)||!reservation.fabricId||reservation.revisionId.length<12||Number(reservation.quantityMetres)<=0||reservation.requestedBy.trim().length<2||reservation.sourceReference.trim().length<3} onClick={submitReservation}>Create reservation</button>
        {confirmedReservations.has(reservationSignature)&&<p className="stockMessage">This exact reservation request is already confirmed. Only create another reservation for a genuinely different documented meterage line or locked order.</p>}
      </article>

      <article className="stockPanel">
        <span>03 / CLOSE RESERVATION</span><h2>Consume or release.</h2>
        <label>Reservation UUID<input value={close.reservationId} onChange={(e)=>setClose({...close,reservationId:e.target.value})}/></label>
        <label>Actual metres used<input type="number" min=".001" step=".001" value={close.actualMetres} onChange={(e)=>setClose({...close,actualMetres:e.target.value})}/></label>
        <label>Close action checked by<input value={close.checkedBy} onChange={(e)=>setClose({...close,checkedBy:e.target.value})} maxLength={120} placeholder="Required"/></label>
        <label>Close action source<input value={close.sourceReference} onChange={(e)=>setClose({...close,sourceReference:e.target.value})} maxLength={240} placeholder="Cutting sheet, cancellation note, usage card…"/></label>
        <label>Note<textarea rows={2} value={close.note} onChange={(e)=>setClose({...close,note:e.target.value})}/></label>
        <div className="stockActions">
          <button disabled={busy||snapshotState!=="ready"||!configured||!close.reservationId||Number(close.actualMetres)<=0||close.checkedBy.trim().length<2||close.sourceReference.trim().length<3} onClick={()=>void post({action:"consume",reservationId:close.reservationId,actualMetres:Number(close.actualMetres),checkedBy:close.checkedBy,sourceReference:close.sourceReference,note:close.note},"Reservation consumed from measured usage and unused metres released.")}>Consume</button>
          <button disabled={busy||snapshotState!=="ready"||!configured||!close.reservationId||close.checkedBy.trim().length<2||close.sourceReference.trim().length<3} onClick={()=>void post({action:"release",reservationId:close.reservationId,releasedBy:close.checkedBy,sourceReference:close.sourceReference,note:close.note},"Reservation released.")}>Release</button>
        </div>
      </article>
    </section>

    {message&&<p className="stockMessage">{message}</p>}

    <section className="stockTable">
      <div>
        <span>READ-ONLY SOURCE AUDIT</span><h2>Review legacy meterage evidence.</h2>
        <p>This summary contains counts only; no supplier sheet, customer or checker identities. It cannot certify real paper documents or measured cloth. Do not install a migration solely because these counts are zero.</p>
        <button disabled={busy||writeInFlight.current||auditStatus==="loading"} onClick={()=>void loadSourceAudit()}>
          {auditStatus==="loading"?"Checking historical ledger…":"Run aggregate audit"}
        </button>
        {auditStatus==="error"&&<p className="stockMessage">Read-only audit unavailable or invalid. No production readiness is inferred; ask the owner to review the database function installation.</p>}
        {sourceAudit&&auditStatus==="ready"&&<article>
          <span>Reservation rows <strong>{sourceAudit.reservationRows}</strong></span>
          <span>Duplicate source-line groups <strong>{sourceAudit.duplicateLineGroups}</strong></span>
          <span>Rows in duplicate groups <strong>{sourceAudit.duplicateLineRows}</strong></span>
          <span>Missing locked revision <strong>{sourceAudit.missingLockedRevision}</strong></span>
          <span>Missing source reference <strong>{sourceAudit.missingSource}</strong></span>
          <span>Missing named checker <strong>{sourceAudit.missingChecker}</strong></span>
          <span>Missing request key <strong>{sourceAudit.missingRequestKey}</strong></span>
          <span>Missing reservation UUID <strong>{sourceAudit.missingReservationUuid}</strong></span>
          <span>Padded source reference <strong>{sourceAudit.paddedSource}</strong></span>
          <span>Placeholder source reference <strong>{sourceAudit.placeholderSource}</strong></span>
          <small>Aggregate legacy evidence only. Real paper line uniqueness, authenticated owner reconciliation and migration approval remain separate requirements.</small>
        </article>}
      </div>
    </section>

    <section className="stockTable">
      <div><span>LIVE SNAPSHOT</span><h2>Available metres by fabric.</h2><p>Named ledger references alone do not certify physical roll counts or independently verify supplier measurements.</p></div>
      {snapshotState==="ready"&&!stock.length&&<p>No physical stock has been recorded yet.</p>}
      {stock.map((row)=><article key={row.fabric_id}>
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
