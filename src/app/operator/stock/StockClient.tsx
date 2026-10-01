"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StockRow={fabric_id:string;physical_metres:number;reserved_metres:number;available_metres:number;manual_event_count:number;provenance_event_count:number;legacy_unverified_event_count:number;provenance_ready:boolean;last_event_at:string|null};

export default function StockClient(){
  const [stock,setStock]=useState<StockRow[]>([]);
  const [configured,setConfigured]=useState(true);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [form,setForm]=useState({fabricId:"",eventType:"receipt",quantityMetres:"",recordedBy:"",sourceReference:"",note:""});
  const [reservation,setReservation]=useState({fabricId:"",revisionId:"",quantityMetres:""});
  const [close,setClose]=useState({reservationId:"",actualMetres:"",note:""});

  async function load(){
    const response=await fetch("/api/operator/stock",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/stock";return;}
    const data=await response.json();
    if(response.ok){setConfigured(data.configured!==false);setStock(Array.isArray(data.stock)?data.stock:[]);}
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

  async function post(body:Record<string,unknown>,success:string){
    if(busy) return;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/operator/stock",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Stock operation failed.");
      setMessage(success);await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Stock operation failed.");}
    finally{setBusy(false);}
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

    <section className="stockStats">
      <article><small>FABRICS TRACKED</small><strong>{stock.length}</strong></article>
      <article><small>AVAILABLE</small><strong>{totalAvailable.toFixed(2)} m</strong></article>
      <article><small>RESERVED</small><strong>{totalReserved.toFixed(2)} m</strong></article>
      <article><small>PHYSICAL PROVENANCE</small><strong>{provenanceReady?"VERIFIED":"OPEN"}</strong><small>{legacyUnverified} legacy/unverified manual event(s)</small></article>
      <article><small>BACKEND</small><strong>{configured?"LIVE":"NOT CONFIGURED"}</strong></article>
    </section>

    <section className="stockGrid">
      <article className="stockPanel">
        <span>01 / PHYSICAL STOCK</span><h2>Record verified metres.</h2>
        <label>Fabric ID<input value={form.fabricId} onChange={(e)=>setForm({...form,fabricId:e.target.value})}/></label>
        <label>Event<select value={form.eventType} onChange={(e)=>setForm({...form,eventType:e.target.value})}><option value="receipt">Receipt / opening verified stock</option><option value="adjustment_in">Adjustment in</option><option value="adjustment_out">Adjustment out</option></select></label>
        <label>Metres<input type="number" min=".001" step=".001" value={form.quantityMetres} onChange={(e)=>setForm({...form,quantityMetres:e.target.value})}/></label>
        <label>Recorded by / checker<input value={form.recordedBy} onChange={(e)=>setForm({...form,recordedBy:e.target.value})} maxLength={120} placeholder="Required"/></label>
        <label>Physical source reference<input value={form.sourceReference} onChange={(e)=>setForm({...form,sourceReference:e.target.value})} maxLength={240} placeholder="Roll tag, receipt, stock-count sheet…"/></label>
        <label>Note<textarea rows={2} value={form.note} onChange={(e)=>setForm({...form,note:e.target.value})}/></label>
        <button disabled={busy||!configured||!form.fabricId||Number(form.quantityMetres)<=0||form.recordedBy.trim().length<2||form.sourceReference.trim().length<3} onClick={()=>void post({action:"record",...form,quantityMetres:Number(form.quantityMetres)},"Provenance-backed stock event recorded.")}>Record stock event</button>
      </article>

      <article className="stockPanel">
        <span>02 / RESERVE</span><h2>Hold cloth for a locked design.</h2>
        <label>Fabric ID<input value={reservation.fabricId} onChange={(e)=>setReservation({...reservation,fabricId:e.target.value})}/></label>
        <label>Locked revision ID<input value={reservation.revisionId} onChange={(e)=>setReservation({...reservation,revisionId:e.target.value})}/></label>
        <label>Metres to reserve<input type="number" min=".001" step=".001" value={reservation.quantityMetres} onChange={(e)=>setReservation({...reservation,quantityMetres:e.target.value})}/></label>
        <button disabled={busy||!configured||!reservation.fabricId||reservation.revisionId.length<12||Number(reservation.quantityMetres)<=0} onClick={()=>void post({action:"reserve",...reservation,quantityMetres:Number(reservation.quantityMetres),requestKey:crypto.randomUUID()},"Reservation created.")}>Create reservation</button>
      </article>

      <article className="stockPanel">
        <span>03 / CLOSE RESERVATION</span><h2>Consume or release.</h2>
        <label>Reservation UUID<input value={close.reservationId} onChange={(e)=>setClose({...close,reservationId:e.target.value})}/></label>
        <label>Actual metres used<input type="number" min=".001" step=".001" value={close.actualMetres} onChange={(e)=>setClose({...close,actualMetres:e.target.value})}/></label>
        <label>Note<textarea rows={2} value={close.note} onChange={(e)=>setClose({...close,note:e.target.value})}/></label>
        <div className="stockActions">
          <button disabled={busy||!configured||!close.reservationId||Number(close.actualMetres)<=0} onClick={()=>void post({action:"consume",reservationId:close.reservationId,actualMetres:Number(close.actualMetres),note:close.note},"Reservation consumed and unused metres released.")}>Consume</button>
          <button disabled={busy||!configured||!close.reservationId} onClick={()=>void post({action:"release",reservationId:close.reservationId,note:close.note},"Reservation released.")}>Release</button>
        </div>
      </article>
    </section>

    {message&&<p className="stockMessage">{message}</p>}

    <section className="stockTable">
      <div><span>LIVE SNAPSHOT</span><h2>Available metres by fabric.</h2></div>
      {!stock.length&&<p>No physical stock has been recorded yet.</p>}
      {stock.map((row)=><article key={row.fabric_id}>
        <b>{row.fabric_id}</b>
        <span>Physical <strong>{Number(row.physical_metres).toFixed(3)} m</strong></span>
        <span>Reserved <strong>{Number(row.reserved_metres).toFixed(3)} m</strong></span>
        <span>Available <strong>{Number(row.available_metres).toFixed(3)} m</strong></span>
        <span>Provenance <strong>{row.provenance_ready?"verified":"open"}</strong></span>
        <small>{Number(row.provenance_event_count||0)}/{Number(row.manual_event_count||0)} manual events verified · {row.last_event_at?new Date(row.last_event_at).toLocaleString("en-IN"):"—"}</small>
      </article>)}
    </section>
  </main>;
}
