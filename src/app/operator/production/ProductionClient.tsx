"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Quote={quote_id:string;revision_id:string;recipe_hash:string;currency:string;line_items:Array<{label:string;amount:number}>;subtotal:number;adjustment:number;total:number;note:string;status:string;created_at:string};
type Order={order_id:string;revision_id:string;recipe_hash:string;quote_id:string|null;status:string;note:string;created_at:string};

export default function ProductionClient(){
  const [quotes,setQuotes]=useState<Quote[]>([]);
  const [orders,setOrders]=useState<Order[]>([]);
  const [configured,setConfigured]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [quote,setQuote]=useState({revisionId:"",recipeHash:"",currency:"INR",adjustment:"0",note:"",line1Label:"Shirt fabric",line1Amount:"",line2Label:"Tailoring",line2Amount:""});
  const [order,setOrder]=useState({revisionId:"",recipeHash:"",quoteId:"",note:""});

  async function load(){
    const response=await fetch("/api/operator/production",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/production";return;}
    const data=await response.json();
    if(response.ok){setConfigured(data.configured!==false);setQuotes(Array.isArray(data.quotes)?data.quotes:[]);setOrders(Array.isArray(data.orders)?data.orders:[]);}
  }
  useEffect(()=>{void load();},[]);

  async function post(body:Record<string,unknown>,success:string){
    if(busy) return;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/operator/production",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Production operation failed.");
      setMessage(success);await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Production operation failed.");}
    finally{setBusy(false);}
  }

  const quoteItems=useMemo(()=>[
    {label:quote.line1Label.trim(),amount:Number(quote.line1Amount)},
    {label:quote.line2Label.trim(),amount:Number(quote.line2Amount)},
  ].filter((item)=>item.label&&Number.isFinite(item.amount)&&item.amount>=0),[quote]);
  const canQuote=quote.revisionId.trim().length>=12&&/^[a-f0-9]{64}$/i.test(quote.recipeHash.trim())&&quoteItems.length>0;

  return <main className="productionDesk">
    <header className="productionHeader">
      <div><span>LINEN EARTH / PRIVATE OPERATOR</span><h1>Production Desk</h1><p>Create traceable quotes and production orders from locked design revisions. Amounts are entered by the operator; this desk never invents prices.</p></div>
      <nav><Link href="/operator">Operator Desk</Link><Link href="/operator/stock">Stock Ledger</Link><Link href="/operator/production-calibration">Usage Calibration</Link></nav>
    </header>

    <section className="productionGrid">
      <article className="productionPanel">
        <span>01 / QUOTE</span><h2>Create from locked recipe.</h2>
        <label>Revision ID<input value={quote.revisionId} onChange={(e)=>setQuote({...quote,revisionId:e.target.value})}/></label>
        <label>Recipe hash<input value={quote.recipeHash} onChange={(e)=>setQuote({...quote,recipeHash:e.target.value})} placeholder="64-character SHA-256"/></label>
        <div className="productionPair">
          <label>Currency<input value={quote.currency} maxLength={3} onChange={(e)=>setQuote({...quote,currency:e.target.value.toUpperCase()})}/></label>
          <label>Adjustment<input type="number" step=".01" value={quote.adjustment} onChange={(e)=>setQuote({...quote,adjustment:e.target.value})}/></label>
        </div>
        <div className="productionPair">
          <label>Line 1<label><input value={quote.line1Label} onChange={(e)=>setQuote({...quote,line1Label:e.target.value})} placeholder="Label"/></label><input type="number" min="0" step=".01" value={quote.line1Amount} onChange={(e)=>setQuote({...quote,line1Amount:e.target.value})} placeholder="Amount"/></label>
          <label>Line 2<label><input value={quote.line2Label} onChange={(e)=>setQuote({...quote,line2Label:e.target.value})} placeholder="Label"/></label><input type="number" min="0" step=".01" value={quote.line2Amount} onChange={(e)=>setQuote({...quote,line2Amount:e.target.value})} placeholder="Amount"/></label>
        </div>
        <label>Note<textarea rows={2} value={quote.note} onChange={(e)=>setQuote({...quote,note:e.target.value})}/></label>
        <button disabled={busy||!configured||!canQuote} onClick={()=>void post({action:"create_quote",revisionId:quote.revisionId,recipeHash:quote.recipeHash,currency:quote.currency,lineItems:quoteItems,adjustment:Number(quote.adjustment||0),note:quote.note},"Quote created.")}>Create quote</button>
      </article>

      <article className="productionPanel">
        <span>02 / ORDER</span><h2>Create production order.</h2>
        <label>Revision ID<input value={order.revisionId} onChange={(e)=>setOrder({...order,revisionId:e.target.value})}/></label>
        <label>Recipe hash<input value={order.recipeHash} onChange={(e)=>setOrder({...order,recipeHash:e.target.value})}/></label>
        <label>Accepted quote UUID (optional)<input value={order.quoteId} onChange={(e)=>setOrder({...order,quoteId:e.target.value})}/></label>
        <label>Note<textarea rows={2} value={order.note} onChange={(e)=>setOrder({...order,note:e.target.value})}/></label>
        <button disabled={busy||!configured||order.revisionId.length<12||!/^[a-f0-9]{64}$/i.test(order.recipeHash)} onClick={()=>void post({action:"create_order",...order},"Production order created.")}>Create order</button>
      </article>
    </section>

    {message&&<p className="productionMessage">{message}</p>}

    <section className="productionRecords">
      <article>
        <div><span>QUOTES</span><h2>Quote history.</h2></div>
        {!quotes.length&&<p>No quotes recorded yet.</p>}
        {quotes.map((item)=><section key={item.quote_id} className="productionRecord">
          <div><b>{item.revision_id}</b><small>{new Date(item.created_at).toLocaleString("en-IN")}</small></div>
          <strong>{item.currency} {Number(item.total).toFixed(2)} · {item.status.toUpperCase()}</strong>
          <small>{item.quote_id}</small>
          <div className="productionRecordActions">
            {item.status==="draft"&&<button disabled={busy} onClick={()=>void post({action:"quote_status",quoteId:item.quote_id,status:"sent"},"Quote marked sent.")}>Mark sent</button>}
            {item.status!=="accepted"&&item.status!=="void"&&<button disabled={busy} onClick={()=>void post({action:"quote_status",quoteId:item.quote_id,status:"accepted"},"Quote accepted.")}>Accept</button>}
            {item.status!=="void"&&<button disabled={busy} onClick={()=>void post({action:"quote_status",quoteId:item.quote_id,status:"void"},"Quote voided.")}>Void</button>}
          </div>
        </section>)}
      </article>

      <article>
        <div><span>ORDERS</span><h2>Production status.</h2></div>
        {!orders.length&&<p>No production orders recorded yet.</p>}
        {orders.map((item)=><section key={item.order_id} className="productionRecord">
          <div><b>{item.revision_id}</b><small>{new Date(item.created_at).toLocaleString("en-IN")}</small></div>
          <strong>{item.status.replaceAll("_"," ").toUpperCase()}</strong>
          <small>{item.order_id}</small>
          {!["delivered","cancelled"].includes(item.status)&&<select defaultValue="" onChange={(e)=>{if(e.target.value) void post({action:"order_status",orderId:item.order_id,status:e.target.value},"Order status updated.");}}>
            <option value="">Update status…</option>
            {["cloth_reserved","cutting","stitching","fitting","ready","delivered","cancelled"].map((status)=><option key={status} value={status}>{status.replaceAll("_"," ")}</option>)}
          </select>}
        </section>)}
      </article>
    </section>
  </main>;
}
