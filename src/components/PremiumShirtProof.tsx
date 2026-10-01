"use client";

import { useMemo, useRef, useState } from "react";
import { PREMIUM_SHIRT_PROOF_FABRICS, expectedPeriodPx, passesScaleGate, scaleErrorPct } from "@/lib/designer/proof-scale";
import { DESIGNER_PANTS, DESIGNER_SHIRTS, designerStyleForOccasion } from "@/lib/designer/engine";
import { StyleDirectorRealModelPreview } from "@/components/PhotoOutfitPreview";

type Collar="spread"|"button-down"|"band";
type Cuff="round"|"square"|"french";
const DEFAULT_PX_PER_MM=900/1780;
const APPROX_TILE_PX=96;

export function PremiumShirtProof(){
  const [fabricId,setFabricId]=useState(PREMIUM_SHIRT_PROOF_FABRICS[0].id);
  const [collar,setCollar]=useState<Collar>("spread");
  const [cuff,setCuff]=useState<Cuff>("round");
  const [pxPerMm,setPxPerMm]=useState(DEFAULT_PX_PER_MM);
  const [declaredTileMm,setDeclaredTileMm]=useState<number|null>(null);
  const [declaredRepeatMm,setDeclaredRepeatMm]=useState<number|null>(null);
  const [measuredPx,setMeasuredPx]=useState<number|null>(null);
  const [latencyMs,setLatencyMs]=useState<number|null>(null);
  const startedRef=useRef(0);

  const fabric=PREMIUM_SHIRT_PROOF_FABRICS.find((item)=>item.id===fabricId) || PREMIUM_SHIRT_PROOF_FABRICS[0];
  const tilePx=declaredTileMm ? Math.max(18,Math.min(260,declaredTileMm*pxPerMm)) : APPROX_TILE_PX;
  const repeatPx=declaredRepeatMm ? expectedPeriodPx(declaredRepeatMm,pxPerMm) : null;
  const error=declaredRepeatMm && measuredPx ? scaleErrorPct(measuredPx,declaredRepeatMm,pxPerMm) : null;
  const pass=declaredRepeatMm && measuredPx ? passesScaleGate(measuredPx,declaredRepeatMm,pxPerMm) : null;
  const calibrationState=declaredTileMm ? "DECLARED PHYSICAL SCALE" : "APPROXIMATE SCALE";
  const stockIdByProofId={
    "plain-sky":"linen-plain-60-sky-blue",
    "stripe-formal-03":"formal-shirting-03",
    "check-formal-04":"formal-shirting-04",
  } as const;
  const realShirt=DESIGNER_SHIRTS.find((item)=>item.id===stockIdByProofId[fabric.id]) || DESIGNER_SHIRTS[0];
  const realPant=DESIGNER_PANTS.find((item)=>item.id==="linen-suiting-beige") || DESIGNER_PANTS[0];
  const realModelStyle=designerStyleForOccasion("Semi-Formal");

  function markChange(run:()=>void){
    startedRef.current=performance.now();
    run();
    requestAnimationFrame(()=>setLatencyMs(performance.now()-startedRef.current));
  }

  function chooseFabric(id:typeof fabric.id){
    markChange(()=>{
      setFabricId(id);
      setDeclaredTileMm(null);
      setDeclaredRepeatMm(null);
      setMeasuredPx(null);
    });
  }

  const collarPaths=useMemo(()=>collar==="band"
    ? ["M 276 175 Q 320 194 364 175 L 362 201 Q 320 216 278 201 Z"]
    : collar==="button-down"
      ? ["M 278 172 L 320 206 L 288 250 L 264 194 Z","M 362 172 L 320 206 L 352 250 L 376 194 Z"]
      : ["M 278 172 L 320 206 L 270 244 L 258 190 Z","M 362 172 L 320 206 L 370 244 L 382 190 Z"],[collar]);
  const cuffHeight=cuff==="french"?34:22;
  const cuffRadius=cuff==="round"?10:1;

  return <div className="proofShell">
    <header className="proofHead">
      <div>
        <span>ROADMAP V2 · PHASE 1</span>
        <h1>Premium Shirt Proof</h1>
        <p>Using the Linen Earth fabric pictures already in the catalogue. No AI call is used when changing fabric, collar or cuff.</p>
      </div>
      <div className="proofStatus">
        <b>{fabric.label}</b>
        <span>{fabric.cataloguePattern}</span>
        <span>{calibrationState}</span>
        <span>{latencyMs===null?"Edit latency not measured":"Last edit "+latencyMs.toFixed(1)+" ms"}</span>
      </div>
    </header>

    <main className="proofGrid">
      <section className="proofStage">
        <svg viewBox="0 0 640 960" role="img" aria-label={"Linen Earth shirt proof using "+fabric.label}>
          <defs>
            <pattern id="proofFabric" width={tilePx} height={tilePx} patternUnits="userSpaceOnUse">
              <rect width={tilePx} height={tilePx} fill="#d9d4ca"/>
              <image href={fabric.image} width={tilePx} height={tilePx} preserveAspectRatio="xMidYMid slice"/>
            </pattern>
            <linearGradient id="proofShade" x1="0" x2="1"><stop stopColor="#0d1721" stopOpacity=".25"/><stop offset=".28" stopColor="#fff" stopOpacity=".12"/><stop offset=".62" stopColor="#fff" stopOpacity=".03"/><stop offset="1" stopColor="#111827" stopOpacity=".25"/></linearGradient>
          </defs>
          <ellipse cx="320" cy="910" rx="160" ry="18" fill="#000" opacity=".08"/>
          <path d="M 274 80 Q 320 44 366 80 L 356 150 Q 320 176 284 150 Z" fill="#cbb6a3"/>
          <path d="M 292 146 L 286 182 Q 320 203 354 182 L 348 146 Z" fill="#cbb6a3"/>
          <path d="M 234 190 Q 276 164 286 177 L 320 207 L 354 177 Q 364 164 406 190 L 432 306 L 420 706 Q 320 736 220 706 L 208 306 Z" fill="url(#proofFabric)" stroke="#5e6367" strokeWidth="2"/>
          <path d="M 234 190 Q 180 206 166 286 L 148 520 Q 150 566 190 570 L 218 548 L 236 314 Z" fill="url(#proofFabric)" stroke="#5e6367" strokeWidth="2"/>
          <path d="M 406 190 Q 460 206 474 286 L 492 520 Q 490 566 450 570 L 422 548 L 404 314 Z" fill="url(#proofFabric)" stroke="#5e6367" strokeWidth="2"/>
          <path d="M 234 190 Q 276 164 286 177 L 320 207 L 354 177 Q 364 164 406 190 L 432 306 L 420 706 Q 320 736 220 706 L 208 306 Z" fill="url(#proofShade)" pointerEvents="none"/>
          {collarPaths.map((path,index)=><path key={index} d={path} fill="url(#proofFabric)" stroke="#545a60" strokeWidth="2"/>)}
          <rect x="320" y="210" width="3" height="480" fill="#3a4148" opacity=".35"/>
          {[250,292,334,376,418,460,502].map((y)=><circle key={y} cx="321.5" cy={y} r="3.1" fill="#e7e0d3" stroke="#56595d" strokeWidth=".8"/>)}
          <rect x="151" y={548-cuffHeight} width="66" height={cuffHeight} rx={cuffRadius} fill="url(#proofFabric)" stroke="#545a60"/>
          <rect x="423" y={548-cuffHeight} width="66" height={cuffHeight} rx={cuffRadius} fill="url(#proofFabric)" stroke="#545a60"/>
          <g transform="translate(72 820)">
            <line x1="0" y1="0" x2={50*pxPerMm} y2="0" stroke="#1d2730" strokeWidth="3"/>
            <line x1="0" y1="-8" x2="0" y2="8" stroke="#1d2730" strokeWidth="2"/>
            <line x1={50*pxPerMm} y1="-8" x2={50*pxPerMm} y2="8" stroke="#1d2730" strokeWidth="2"/>
            <text x={(50*pxPerMm)/2} y="-14" textAnchor="middle" fontSize="13" fill="#1d2730">50 mm ruler</text>
          </g>
        </svg>
        <span className="proofTag">{calibrationState} · CURRENT CATALOGUE PHOTO</span>
      </section>

      <aside className="proofControls">
        <section>
          <h2>Current Linen Earth fabrics</h2>
          {PREMIUM_SHIRT_PROOF_FABRICS.map((item)=><button key={item.id} type="button" data-active={fabric.id===item.id} onClick={()=>chooseFabric(item.id)}>{item.label}</button>)}
        </section>
        <section><h2>Collar</h2>{(["spread","button-down","band"] as Collar[]).map((item)=><button key={item} type="button" data-active={collar===item} onClick={()=>markChange(()=>setCollar(item))}>{item}</button>)}</section>
        <section><h2>Cuff</h2>{(["round","square","french"] as Cuff[]).map((item)=><button key={item} type="button" data-active={cuff===item} onClick={()=>markChange(()=>setCuff(item))}>{item}</button>)}</section>
        <section>
          <h2>Physical calibration</h2>
          <label>px per mm<input type="number" min=".1" step=".0001" value={pxPerMm} onChange={(event)=>setPxPerMm(Math.max(.1,Number(event.target.value)||DEFAULT_PX_PER_MM))}/></label>
          <label>Visible source tile width (mm)<input type="number" min=".1" step=".1" placeholder="Enter after measuring swatch" value={declaredTileMm??""} onChange={(event)=>setDeclaredTileMm(event.target.value?Number(event.target.value):null)}/></label>
          <label>Known pattern repeat (mm)<input type="number" min=".1" step=".1" placeholder="Optional measured repeat" value={declaredRepeatMm??""} onChange={(event)=>setDeclaredRepeatMm(event.target.value?Number(event.target.value):null)}/></label>
          {repeatPx&&<p>Expected repeat on model: <b>{repeatPx.toFixed(2)} px</b></p>}
          {declaredRepeatMm&&<label>Measured repeat on preview (px)<input type="number" min=".01" step=".01" value={measuredPx??""} onChange={(event)=>setMeasuredPx(event.target.value?Number(event.target.value):null)}/></label>}
          {error!==null&&<div className="proofGate" data-pass={pass?"yes":"no"}><b>{pass?"PASS":"FAIL"} · {error.toFixed(2)}% error</b><span>Roadmap gate: ≤ 8% scale error.</span></div>}
          {!declaredTileMm&&<p><b>Important:</b> the current photo is used now, but it stays labelled approximate until we physically measure the photographed swatch or pattern repeat.</p>}
        </section>
      </aside>
    </main>

    {realShirt&&realPant&&<section className="proofRealism">
      <div className="proofRealismCopy">
        <span>REAL MANNEQUIN TRACK</span>
        <h2>Same catalogue fabric on our existing photographic model.</h2>
        <p>This reuses the current Linen Earth mannequin/photo compositor so we can judge cloth believability separately from construction geometry. The photographed collar/cuff shape stays the base photographed construction; the Phase 1 cut controls above remain the geometry test until matching photographed option assets exist.</p>
        <div className="proofRealismFacts">
          <b>{realShirt.name}</b>
          <span>Real catalogue swatch</span>
          <span>Existing studio mannequin</span>
          <span>No AI per edit</span>
          <span>{declaredTileMm?"Scale evidence entered":"Scale still approximate"}</span>
        </div>
      </div>
      <div className="proofRealModel">
        <StyleDirectorRealModelPreview shirt={realShirt} pant={realPant} style={realModelStyle}/>
      </div>
    </section>}
  </div>;
}
