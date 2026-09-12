"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listHandoffs, updateHandoff, type AtelierHandoff, type HandoffStatus } from "@/lib/handoff";

const statusLabel: Record<HandoffStatus,string> = {requested:"Requested",in_review:"In review",fabric_check:"Fabric check",ready_for_consultation:"Ready for consultation"};

export function AtelierQueueClient(){
  const [items,setItems]=useState<AtelierHandoff[]>([]); const [activeId,setActiveId]=useState<string|null>(null); const [note,setNote]=useState("");
  useEffect(()=>{const loaded=listHandoffs();setItems(loaded);setActiveId(loaded[0]?.id||null)},[]);
  const active=useMemo(()=>items.find((x)=>x.id===activeId)||items[0],[items,activeId]);
  function save(status:HandoffStatus){if(!active)return;updateHandoff(active.id,{status,staffNote:note});setItems((prev)=>prev.map((x)=>x.id===active.id?{...x,status,staffNote:note}:x));}

  if(!items.length)return <section className="queueEmpty"><p className="eyebrow">PHASE 8 · HUMAN DESIGNER HANDOFF</p><h1>The atelier queue is empty.</h1><p>Save a finalized customer design first, then use “Send to LLinen Earth atelier”. The exact specification and fabric intelligence will arrive here as a review packet.</p><Link className="button light" href="/designs">Open saved designs</Link></section>;

  return <section className="atelierPage"><div className="atelierHero"><div><p className="eyebrow">PHASE 8 · STORE / HUMAN DESIGNER HANDOFF</p><h1>Digital intent, preserved at the counter.</h1></div><p>Staff review the same locked design the customer approved. Fabric suitability, ideal alternatives and the exact specification hash travel with the request, so a human override is deliberate rather than accidental.</p></div>
    <div className="queueGrid"><div className="queueList">{items.map((item)=><button key={item.id} className={active?.id===item.id?"queueItem active":"queueItem"} onClick={()=>{setActiveId(item.id);setNote(item.staffNote||"")}}><span>{item.specHash}</span><div><strong>{item.title}</strong><span>{item.occasion} · {item.venue}</span></div><em>{statusLabel[item.status]}</em></button>)}</div>
    {active&&<aside className="queueDetail"><span className="micro">HANDOFF · {active.id}</span><h2>{active.title}</h2><div className="queueMeta"><span>{active.occasion}</span><span>{active.aesthetic}</span><span>{active.specHash}</span></div>
      <dl className="queueSpec"><div><dt>Shirt</dt><dd>{active.garmentSpec.shirt}</dd></div><div><dt>Trouser</dt><dd>{active.garmentSpec.trouser}</dd></div><div><dt>Layer</dt><dd>{active.garmentSpec.layer}</dd></div><div><dt>Footwear</dt><dd>{active.garmentSpec.footwear}</dd></div></dl>
      <div className="fabricReview"><span>FABRIC REVIEW · {active.fabricAssessment.verdict.toUpperCase()} · {active.fabricAssessment.score}/100</span><h3>{active.uploadedFabric}</h3><p>{active.fabricAssessment.reasons.join(" ")}</p><div className="idealFabrics">{active.idealStoreFabrics.map((fabric)=><div key={fabric.id}><strong>{fabric.name}</strong><span>{fabric.reason}</span></div>)}</div></div>
      {active.customerNote&&<div className="fabricReview"><span>CUSTOMER NOTE</span><p>{active.customerNote}</p></div>}
      <div className="staffControls"><select defaultValue={active.status} onChange={(e)=>save(e.target.value as HandoffStatus)}><option value="requested">Requested</option><option value="in_review">In review</option><option value="fabric_check">Fabric check</option><option value="ready_for_consultation">Ready for consultation</option></select><textarea value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Human designer note: inventory match, construction change, fitting consideration…"/><button onClick={()=>save(active.status)}>Save staff note</button></div>
    </aside>}</div></section>;
}
