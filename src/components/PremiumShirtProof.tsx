"use client";

import { useMemo, useRef, useState } from "react";
import { PREMIUM_SHIRT_PROOF_FABRICS, expectedPeriodPx, passesScaleGate, scaleErrorPct } from "@/lib/designer/proof-scale";

type Collar="spread"|"button-down"|"band";
type Cuff="round"|"square"|"french";
const DEFAULT_PX_PER_MM=900/1780;

export function PremiumShirtProof(){
  const [fabricId,setFabricId]=useState("stripe-5");
  const [collar,setCollar]=useState<Collar>("spread");
  const [cuff,setCuff]=useState<Cuff>("round");
  const [pxPerMm,setPxPerMm]=useState(DEFAULT_PX_PER_MM);
  const [measuredPx,setMeasuredPx]=useState<number|null>(null);
  const [latencyMs,setLatencyMs]=useState<number|null>(null);
  const startedRef=useRef(0);
  const fabric=PREMIUM_SHIRT_PROOF_FABRICS.find((item)=>item.id===fabricId) || PREMIUM_SHIRT_PROOF_FABRICS[0];
  const repeatPx=fabric.repeatMm ? expectedPeriodPx(fabric.repeatMm,pxPerMm) : null;
  const error=fabric.repeatMm && measuredPx ? scaleErrorPct(measuredPx,fabric.repeatMm,pxPerMm) : null;
  const pass=fabric.repeatMm && measuredPx ? passesScaleGate(measuredPx,fabric.repeatMm,pxPerMm) : null;
  const stripePattern=useMemo(()=>repeatPx?{period:repeatPx,dark:Math.max(.75,repeatPx*.18)}:null,[repeatPx]);

  function markChange(run:()=>void){
    startedRef.current=performance.now();
    run();
    requestAnimationFrame(()=>setLatencyMs(performance.now()-startedRef.current));
  }

  const collarPaths=collar==="band"
    ? ["M 276 175 Q 320 194 364 175 L 362 201 Q 320 216 278 201 Z"]
    : collar==="button-down"
      ? ["M 278 172 L 320 206 L 288 250 L 264 194 Z","M 362 172 L 320 206 L 352 250 L 376 194 Z"]
      : ["M 278 172 L 320 206 L 270 244 L 258 190 Z","M 362 172 L 320 206 L 370 244 L 382 190 Z"];
  const cuffHeight=cuff==="french"?34:22;
  const cuffRadius=cuff==="round"?10:1;
  const clothFill=fabric.repeatMm?"url(#proofStripe)":"url(#proofPlain)";

  return <div className="proofShell">
    <header className="proofHead">
      <div><span>ROADMAP V2 · PHASE 1</span><h1>Premium Shirt Proof</h1><p>Isolated true-scale test. No AI calls. The ruler and stripe fixtures share the same px/mm calibration.</p></div>
      <div className="proofStatus"><b>{fabric.repeatMm?String(fabric.repeatMm)+" mm repeat":"Plain fixture"}</b><span>{pxPerMm.toFixed(4)} px/mm</span><span>{latencyMs===null?"Edit latency not measured":"Last edit "+latencyMs.toFixed(1)+" ms"}</span></div>
    </header>

    <main className="proofGrid">
      <section className="proofStage">
        <svg viewBox="0 0 640 960" role="img" aria-label="True-scale shirt proof fixture">
          <defs>
            <pattern id="proofPlain" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#d8d0bf"/><path d="M0 6 H24 M0 18 H24" stroke="#b9af9d" strokeOpacity=".22" strokeWidth=".7"/><path d="M6 0 V24 M18 0 V24" stroke="#f5f0e7" strokeOpacity=".3" strokeWidth=".6"/></pattern>
            {stripePattern&&<pattern id="proofStripe" width={stripePattern.period} height={stripePattern.period} patternUnits="userSpaceOnUse"><rect width={stripePattern.period} height={stripePattern.period} fill="#e9e5dc"/><rect width={stripePattern.dark} height={stripePattern.period} fill="#26324b"/></pattern>}
            <linearGradient id="proofShade" x1="0" x2="1"><stop stopColor="#0d1721" stopOpacity=".25"/><stop offset=".28" stopColor="#fff" stopOpacity=".12"/><stop offset=".62" stopColor="#fff" stopOpacity=".03"/><stop offset="1" stopColor="#111827" stopOpacity=".25"/></linearGradient>
          </defs>
          <ellipse cx="320" cy="910" rx="160" ry="18" fill="#000" opacity=".08"/>
          <path d="M 274 80 Q 320 44 366 80 L 356 150 Q 320 176 284 150 Z" fill="#cbb6a3"/>
          <path d="M 292 146 L 286 182 Q 320 203 354 182 L 348 146 Z" fill="#cbb6a3"/>
          <path d="M 234 190 Q 276 164 286 177 L 320 207 L 354 177 Q 364 164 406 190 L 432 306 L 420 706 Q 320 736 220 706 L 208 306 Z" fill={clothFill} stroke="#5e6367" strokeWidth="2"/>
          <path d="M 234 190 Q 180 206 166 286 L 148 520 Q 150 566 190 570 L 218 548 L 236 314 Z" fill={clothFill} stroke="#5e6367" strokeWidth="2"/>
          <path d="M 406 190 Q 460 206 474 286 L 492 520 Q 490 566 450 570 L 422 548 L 404 314 Z" fill={clothFill} stroke="#5e6367" strokeWidth="2"/>
          <path d="M 234 190 Q 276 164 286 177 L 320 207 L 354 177 Q 364 164 406 190 L 432 306 L 420 706 Q 320 736 220 706 L 208 306 Z" fill="url(#proofShade)" pointerEvents="none"/>
          {collarPaths.map((path,index)=><path key={index} d={path} fill={clothFill} stroke="#545a60" strokeWidth="2"/>)}
          <rect x="320" y="210" width="3" height="480" fill="#3a4148" opacity=".35"/>
          {[250,292,334,376,418,460,502].map((y)=><circle key={y} cx="321.5" cy={y} r="3.1" fill="#e7e0d3" stroke="#56595d" strokeWidth=".8"/>)}
          <rect x="151" y={548-cuffHeight} width="66" height={cuffHeight} rx={cuffRadius} fill={clothFill} stroke="#545a60"/>
          <rect x="423" y={548-cuffHeight} width="66" height={cuffHeight} rx={cuffRadius} fill={clothFill} stroke="#545a60"/>
          <g transform="translate(72 820)"><line x1="0" y1="0" x2={50*pxPerMm} y2="0" stroke="#1d2730" strokeWidth="3"/><line x1="0" y1="-8" x2="0" y2="8" stroke="#1d2730" strokeWidth="2"/><line x1={50*pxPerMm} y1="-8" x2={50*pxPerMm} y2="8" stroke="#1d2730" strokeWidth="2"/><text x={(50*pxPerMm)/2} y="-14" textAnchor="middle" fontSize="13" fill="#1d2730">50 mm ruler</text></g>
        </svg>
        <span className="proofTag">SYNTHETIC SCALE FIXTURE · NOT A CUSTOMER RENDER</span>
      </section>

      <aside className="proofControls">
        <section><h2>Fabric fixture</h2>{PREMIUM_SHIRT_PROOF_FABRICS.map((item)=><button key={item.id} type="button" data-active={fabric.id===item.id} onClick={()=>markChange(()=>{setFabricId(item.id);setMeasuredPx(null);})}>{item.label}</button>)}</section>
        <section><h2>Collar</h2>{(["spread","button-down","band"] as Collar[]).map((item)=><button key={item} type="button" data-active={collar===item} onClick={()=>markChange(()=>setCollar(item))}>{item}</button>)}</section>
        <section><h2>Cuff</h2>{(["round","square","french"] as Cuff[]).map((item)=><button key={item} type="button" data-active={cuff===item} onClick={()=>markChange(()=>setCuff(item))}>{item}</button>)}</section>
        <section><h2>Calibration</h2><label>px per mm<input type="number" min=".1" step=".0001" value={pxPerMm} onChange={(event)=>setPxPerMm(Math.max(.1,Number(event.target.value)||DEFAULT_PX_PER_MM))}/></label>{repeatPx&&<p>Expected stripe period: <b>{repeatPx.toFixed(2)} px</b></p>}{fabric.repeatMm&&<label>Measured stripe period (px)<input type="number" min=".01" step=".01" value={measuredPx??""} onChange={(event)=>setMeasuredPx(event.target.value?Number(event.target.value):null)}/></label>}{error!==null&&<div className="proofGate" data-pass={pass?"yes":"no"}><b>{pass?"PASS":"FAIL"} · {error.toFixed(2)}% error</b><span>Roadmap gate: ≤ 8% scale error.</span></div>}</section>
      </aside>
    </main>
  </div>;
}
