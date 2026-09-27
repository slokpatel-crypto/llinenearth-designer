"use client";

import Link from "next/link";
import { useEffect,useState } from "react";

type Insights={
  configured:boolean;days?:number;generatedAt?:string;
  summary:{recommendations:number;feedbackUp:number;feedbackDown:number;approvals:number;wrong:number;safeFallbacks:number};
  modes:Array<{name:string;recommended:number;up:number;down:number;approve:number;wrong:number;safeFallback:number}>;
  rules:Array<{id:string;count:number}>;
  pairings:Array<{pairingId:string;label:string;mode:string;up:number;down:number;approve:number;wrong:number;safeFallback:number;negative:number;positive:number}>;
  versions:Array<{name:string;count:number}>;
};

export default function DesignerInsightsClient(){
  const [data,setData]=useState<Insights|null>(null);
  const [loading,setLoading]=useState(true);
  const [days,setDays]=useState(180);
  const [error,setError]=useState("");

  async function load(nextDays=days){
    setLoading(true);setError("");
    try{
      const response=await fetch(`/api/operator/designer-insights?days=${nextDays}`,{cache:"no-store"});
      if(response.status===401){window.location.href="/operator/login?next=/operator/designer-insights";return;}
      const next=await response.json() as Insights&{error?:string};
      if(!response.ok)throw new Error(next.error||"Designer insights could not be loaded.");
      setData(next);
    }catch(cause){setError(cause instanceof Error?cause.message:"Designer insights could not be loaded.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{void load(180);},[]);

  return <main className="designerInsights">
    <header className="insightsHeader">
      <div><span>LLINEN EARTH / OPERATOR</span><h1>Designer Evidence</h1><p>Observe real feedback before changing any ranking weights. This page reports evidence; it does not self-tune the Designer.</p></div>
      <div><select value={days} onChange={(e)=>{const value=Number(e.target.value);setDays(value);void load(value);}}><option value={30}>30 days</option><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>365 days</option></select><Link href="/operator/designer-qa">Designer QA</Link><Link href="/operator">Operator Desk</Link></div>
    </header>

    {error&&<div className="insightsError">{error}</div>}
    {loading&&!data&&<div className="insightsLoading">Loading Designer evidence…</div>}

    {data&&!data.configured&&<section className="noCloud"><strong>Cloud memory is not connected.</strong><p>The evidence dashboard is ready, but it will remain empty until the production Supabase project is connected and Designer events begin persisting.</p></section>}

    {data&&data.configured&&<>
      <section className="insightCards">
        <article><span>RECOMMENDATIONS</span><strong>{data.summary.recommendations}</strong></article>
        <article><span>LOOKS RIGHT</span><strong>{data.summary.feedbackUp}</strong></article>
        <article><span>WRONG</span><strong>{data.summary.feedbackDown}</strong></article>
        <article><span>OPERATOR APPROVE</span><strong>{data.summary.approvals}</strong></article>
        <article><span>OPERATOR WRONG</span><strong>{data.summary.wrong}</strong></article>
        <article><span>SAFE FALLBACKS</span><strong>{data.summary.safeFallbacks}</strong></article>
      </section>

      <section className="insightSection">
        <div className="insightTitle"><span>MODE EVIDENCE</span><h2>Safe, Elevated and Statement in real use.</h2></div>
        <div className="modeGrid">{data.modes.length?data.modes.map((item)=><article key={item.name}><h3>{item.name}</h3><div><span>Shown <b>{item.recommended}</b></span><span>Right <b>{item.up}</b></span><span>Wrong <b>{item.down}</b></span><span>Approved <b>{item.approve}</b></span><span>Operator wrong <b>{item.wrong}</b></span><span>Fallback <b>{item.safeFallback}</b></span></div></article>):<p>No mode evidence yet.</p>}</div>
      </section>

      <section className="insightSection">
        <div className="insightTitle"><span>RULE EVIDENCE</span><h2>Which compatibility rules are producing warnings.</h2></div>
        <div className="ruleGrid">{["CR-1","CR-2","CR-3","CR-4","CR-5","CR-6","CR-7"].map((id)=><article key={id}><span>{id}</span><strong>{data.rules.find((item)=>item.id===id)?.count||0}</strong></article>)}</div>
      </section>

      <section className="insightSection">
        <div className="insightTitle"><span>PAIRING EVIDENCE</span><h2>Pairings with the strongest negative signal first.</h2></div>
        <div className="pairTable"><table><thead><tr><th>Pairing</th><th>Mode</th><th>Positive</th><th>Negative</th><th>Customer</th><th>Operator</th></tr></thead><tbody>{data.pairings.map((item)=><tr key={item.pairingId}><td><b>{item.label}</b><small>{item.pairingId}</small></td><td>{item.mode}</td><td>{item.positive}</td><td className={item.negative?"negative":""}>{item.negative}</td><td>↑ {item.up} / ↓ {item.down}</td><td>✓ {item.approve} · × {item.wrong} · fallback {item.safeFallback}</td></tr>)}</tbody></table></div>
      </section>

      <footer className="insightFoot">No ranking weights change automatically from these metrics. Calibration remains a deliberate human decision.</footer>
    </>}
  </main>;
}
