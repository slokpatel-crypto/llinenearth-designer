"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { expectedPeriodPx, passesScaleGate, phase1ProofAcceptance, scaleErrorPct } from "@/lib/designer/proof-scale";
import { applyRuntimeFabricScale, photoExpectedRepeatPx, type FabricRenderAsset } from "@/lib/designer/live-preview";
import { DESIGNER_PANTS, DESIGNER_SHIRTS, designerStyleForOccasion } from "@/lib/designer/engine";
import { StyleDirectorRealModelPreview } from "@/components/PhotoOutfitPreview";
import { LiveConstructionPreview } from "@/components/LiveConstructionPreview";
import fabricTileManifest from "../../public/fabric-tiles/manifest.json";

type Collar="spread"|"button-down"|"band";
type Cuff="round"|"square"|"french";
const DEFAULT_PX_PER_MM=900/1780;
const APPROX_TILE_PX=96;
const REALISM_STORAGE_KEY="linen-earth:phase1-proof-realism:v1";

export function PremiumShirtProof(){
  const [shirtId,setShirtId]=useState(DESIGNER_SHIRTS[0]?.id||"");
  const [runtimeShirts,setRuntimeShirts]=useState(DESIGNER_SHIRTS);
  const [runtimePants,setRuntimePants]=useState(DESIGNER_PANTS);
  const [collar,setCollar]=useState<Collar>("spread");
  const [cuff,setCuff]=useState<Cuff>("round");
  const [pxPerMm,setPxPerMm]=useState(DEFAULT_PX_PER_MM);
  const [declaredTileMm,setDeclaredTileMm]=useState<number|null>(null);
  const [declaredRepeatMm,setDeclaredRepeatMm]=useState<number|null>(null);
  const [measuredPx,setMeasuredPx]=useState<number|null>(null);
  const [latencyMs,setLatencyMs]=useState<number|null>(null);
  const [latencySamples,setLatencySamples]=useState<number[]>([]);
  const [realRenderSamples,setRealRenderSamples]=useState<number[]>([]);
  const [realismRatings,setRealismRatings]=useState<number[]>([]);
  const [recordBusy,setRecordBusy]=useState(false);
  const [recordMessage,setRecordMessage]=useState("");
  const startedRef=useRef(0);

  const realShirt=runtimeShirts.find((item)=>item.id===shirtId) || runtimeShirts[0];
  const realPant=runtimePants.find((item)=>item.id==="linen-suiting-beige") || runtimePants[0];
  const realModelStyle=designerStyleForOccasion("Semi-Formal");
  const proofConstructionStyle={
    ...realModelStyle,
    collar:collar==="spread" ? "Spread Collar" : collar==="button-down" ? "Button-Down Collar" : "Mandarin / Band Collar",
    cuff:cuff==="french" ? "French / Double Cuff" : cuff==="round" ? "Rounded/Soft Cuff" : "Barrel Cuff (1-button)",
  };
  const fabric={
    label:realShirt?.name||"Fabric",
    image:realShirt?.image||"",
    cataloguePattern:realShirt?.patternType||"Unknown",
  };
  const storedRepeatMm=realShirt?.renderScale?.physicalScaleStatus==="declared_repeat" ? realShirt.renderScale.repeatMm : null;
  const effectiveRepeatMm=declaredRepeatMm ?? storedRepeatMm;
  const proofRealShirt=realShirt ? {
    ...realShirt,
    renderScale: effectiveRepeatMm ? {
      physicalScaleStatus:"declared_repeat" as const,
      repeatMm:effectiveRepeatMm,
      stripeWidthMm:realShirt.renderScale?.stripeWidthMm??null,
    } : realShirt.renderScale,
  } : realShirt;
  const proofAsset=realShirt ? (fabricTileManifest.assets as Record<string,FabricRenderAsset>)[realShirt.image.split("/").pop()?.replace(/\.webp(?:\?.*)?$/,"")||""] || null : null;
  const calibratedProofAsset=proofRealShirt ? applyRuntimeFabricScale(proofAsset,proofRealShirt.renderScale) : proofAsset;
  const photoRepeatAuditPx=photoExpectedRepeatPx(calibratedProofAsset);

  const tilePx=declaredTileMm ? Math.max(18,Math.min(260,declaredTileMm*pxPerMm)) : APPROX_TILE_PX;
  const repeatPx=effectiveRepeatMm ? expectedPeriodPx(effectiveRepeatMm,pxPerMm) : null;
  const error=effectiveRepeatMm && measuredPx ? scaleErrorPct(measuredPx,effectiveRepeatMm,pxPerMm) : null;
  const pass=effectiveRepeatMm && measuredPx ? passesScaleGate(measuredPx,effectiveRepeatMm,pxPerMm) : null;
  const calibrationState=storedRepeatMm ? "VERIFIED CATALOGUE SCALE EVIDENCE"
    : declaredTileMm||declaredRepeatMm ? "PHYSICAL EVIDENCE ENTERED"
    : "APPROXIMATE SCALE";
  const p95=useMemo(()=>{
    if(!latencySamples.length) return null;
    const ordered=[...latencySamples].sort((a,b)=>a-b);
    return ordered[Math.min(ordered.length-1,Math.ceil(ordered.length*.95)-1)];
  },[latencySamples]);
  const realP95=useMemo(()=>{
    if(!realRenderSamples.length) return null;
    const ordered=[...realRenderSamples].sort((a,b)=>a-b);
    return ordered[Math.min(ordered.length-1,Math.ceil(ordered.length*.95)-1)];
  },[realRenderSamples]);
  const strongRealism=realismRatings.filter((rating)=>rating>=4).length;
  const realismGate=realismRatings.length>=8 && strongRealism>=6;
  const proofAcceptance=useMemo(()=>phase1ProofAcceptance({
    repeatMm:effectiveRepeatMm,
    scaleGatePass:pass,
    realModelSamples:realRenderSamples.length,
    realModelP95Ms:realP95,
    realismRatings,
  }),[effectiveRepeatMm,pass,realRenderSamples.length,realP95,realismRatings]);

  useEffect(()=>{
    let cancelled=false;
    fetch("/api/designer/catalog",{cache:"no-store"})
      .then((response)=>response.ok?response.json():null)
      .then((data:{shirts?:typeof DESIGNER_SHIRTS;pants?:typeof DESIGNER_PANTS}|null)=>{
        if(cancelled||!data) return;
        if(Array.isArray(data.shirts)&&data.shirts.length) {
          setRuntimeShirts(data.shirts);
          setShirtId((current)=>data.shirts?.some((item)=>item.id===current)?current:data.shirts?.[0]?.id||current);
        }
        if(Array.isArray(data.pants)&&data.pants.length) setRuntimePants(data.pants);
      })
      .catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    try {
      const raw=localStorage.getItem(REALISM_STORAGE_KEY);
      if(!raw) return;
      const parsed=JSON.parse(raw);
      if(Array.isArray(parsed)) setRealismRatings(parsed.filter((item)=>Number.isInteger(item)&&item>=1&&item<=5).slice(-30));
    } catch {}
  },[]);

  function markChange(run:()=>void){
    startedRef.current=performance.now();
    run();
    requestAnimationFrame(()=>{
      const sample=performance.now()-startedRef.current;
      setLatencyMs(sample);
      setLatencySamples((current)=>[...current.slice(-29),sample]);
    });
  }

  function chooseFabric(id:string){
    markChange(()=>{
      setShirtId(id);
      setDeclaredTileMm(null);
      setDeclaredRepeatMm(null);
      setMeasuredPx(null);
    });
  }

  function addRealismRating(rating:number){
    setRealismRatings((current)=>{
      const next=[...current,rating].slice(-30);
      try { localStorage.setItem(REALISM_STORAGE_KEY,JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function clearRealismRatings(){
    setRealismRatings([]);
    try { localStorage.removeItem(REALISM_STORAGE_KEY); } catch {}
  }

  async function recordProofEvidence(){
    if(recordBusy) return;
    setRecordBusy(true);setRecordMessage("");
    try{
      const response=await fetch("/api/memory/event",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          id:"EV-PHASE1-"+crypto.randomUUID(),
          sessionId:"ROADMAP-V2-PHASE1-PROOF",
          type:"operator_note",
          at:new Date().toISOString(),
          payload:{
            subtype:"roadmap_phase1_proof",
            version:"linen-earth-phase1-proof-v1",
            status:proofAcceptance.accepted?"accepted":"review",
            fabricId:realShirt?.id||"",
            fabricName:realShirt?.name||"",
            pattern:realShirt?.patternType||"",
            repeatMm:effectiveRepeatMm,
            measuredPreviewRepeatPx:measuredPx,
            scaleErrorPct:error,
            scaleGatePass:pass===true,
            realModelSamples:realRenderSamples.length,
            realModelP95Ms:realP95,
            realismRatings,
            strongRatings:proofAcceptance.strongRatings,
            realismPass:proofAcceptance.realismReady,
            note:proofAcceptance.reasons.join(" "),
          },
        }),
      });
      const result=await response.json() as {stored?:boolean;error?:string};
      if(response.status===403||response.status===401) {
        setRecordMessage("Operator login is required to record this proof.");
        return;
      }
      if(!response.ok||!result.stored) throw new Error(result.error||"Proof evidence could not be stored.");
      setRecordMessage(proofAcceptance.accepted?"Accepted Phase 1 proof recorded.":"Review evidence recorded; remaining gates are preserved.");
    }catch(error){
      setRecordMessage(error instanceof Error?error.message:"Proof evidence could not be stored.");
    }finally{
      setRecordBusy(false);
    }
  }

  function exportProofEvidence(){
    const payload={
      version:"linen-earth-phase1-proof-v1",
      recordedAt:new Date().toISOString(),
      fabric:{
        id:realShirt?.id||null,
        name:realShirt?.name||null,
        line:realShirt?.line||null,
        pattern:realShirt?.patternType||null,
      },
      calibration:{
        pxPerMm,
        sourceTileWidthMm:declaredTileMm,
        storedRepeatMm,
        enteredRepeatMm:declaredRepeatMm,
        effectiveRepeatMm,
        measuredPreviewRepeatPx:measuredPx,
        scaleErrorPct:error,
        scaleGatePass:pass,
      },
      performance:{
        geometrySamplesMs:latencySamples,
        geometryP95Ms:p95,
        realModelSamplesMs:realRenderSamples,
        realModelP95Ms:realP95,
        targetMs:300,
      },
      realism:{
        ratings:realismRatings,
        strongRatings:strongRealism,
        target:"at least 6 of 8 ratings >= 4",
        pass:realismGate,
      },
      construction:{collar,cuff},
      caveats:[
        "Catalogue imagery is not physical scale evidence by itself.",
        "Synthetic collar/cuff geometry is a proof control, not a photographed finished garment.",
        "Final tailoring fit requires physical verification.",
      ],
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=url;
    anchor.download="linen-earth-phase1-proof-"+(realShirt?.id||"fabric")+".json";
    anchor.click();
    URL.revokeObjectURL(url);
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
        <p>Uses the current Linen Earth catalogue fabric pictures and the existing studio mannequin. No AI call is used when changing fabric, collar or cuff.</p>
      </div>
      <div className="proofStatus">
        <b>{fabric.label}</b>
        <span>{fabric.cataloguePattern}</span>
        <span>{calibrationState}</span>
        <span>{latencyMs===null?"Edit latency not measured":"Last edit "+latencyMs.toFixed(1)+" ms"}</span>
        <span>{p95===null?"Geometry p95 waiting":"Geometry p95 "+p95.toFixed(1)+" ms · "+(p95<300?"PASS":"REVIEW")}</span>
        <span>{realP95===null?"Real model p95 waiting":"Real model p95 "+realP95.toFixed(1)+" ms · "+(realP95<300?"PASS":"REVIEW")}</span>
      </div>
    </header>

    <main className="proofGrid">
      <section className="proofStage">
        <svg viewBox="0 0 640 960" role="img" aria-label={"Linen Earth shirt proof using "+fabric.label}>
          <defs>
            <pattern id="proofFabric" width={tilePx} height={tilePx} patternUnits="userSpaceOnUse">
              <rect width={tilePx} height={tilePx} fill="#d9d4ca"/>
              {fabric.image&&<image href={fabric.image} width={tilePx} height={tilePx} preserveAspectRatio="xMidYMid slice"/>}
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
          <label>Shirting fabric
            <select value={realShirt?.id||""} onChange={(event)=>chooseFabric(event.target.value)}>
              {runtimeShirts.map((item)=><option key={item.id} value={item.id}>{item.name} · {item.line}</option>)}
            </select>
          </label>
          <p>{runtimeShirts.length} current shirting fabrics are available in this proof. Reviewed Analyzer evidence is loaded when available.</p>
          {realShirt&&<Link className="proofOperatorLink" href={"/operator/fabric-analyzer?fabricId="+encodeURIComponent(realShirt.id)}>Open selected fabric in Analyzer →</Link>}
        </section>
        <section><h2>Collar</h2>{(["spread","button-down","band"] as Collar[]).map((item)=><button key={item} type="button" data-active={collar===item} onClick={()=>markChange(()=>setCollar(item))}>{item}</button>)}</section>
        <section><h2>Cuff</h2>{(["round","square","french"] as Cuff[]).map((item)=><button key={item} type="button" data-active={cuff===item} onClick={()=>markChange(()=>setCuff(item))}>{item}</button>)}</section>
        <section>
          <h2>Physical calibration</h2>
          <label>px per mm<input type="number" min=".1" step=".0001" value={pxPerMm} onChange={(event)=>setPxPerMm(Math.max(.1,Number(event.target.value)||DEFAULT_PX_PER_MM))}/></label>
          <label>Visible source tile width (mm)<input type="number" min=".1" step=".1" placeholder="Enter after measuring swatch" value={declaredTileMm??""} onChange={(event)=>setDeclaredTileMm(event.target.value?Number(event.target.value):null)}/></label>
          <label>Known pattern repeat (mm)<input type="number" min=".1" step=".1" placeholder={storedRepeatMm?"Using stored verified repeat":"Optional measured repeat"} value={declaredRepeatMm??""} onChange={(event)=>setDeclaredRepeatMm(event.target.value?Number(event.target.value):null)}/></label>
          {storedRepeatMm&&<p>Stored reviewed repeat: <b>{storedRepeatMm} mm</b>. Leave the field blank to use it.</p>}
          {repeatPx&&<p>Expected repeat on model: <b>{repeatPx.toFixed(2)} px</b></p>}
          {effectiveRepeatMm&&<label>Measured repeat on preview (px)<input type="number" min=".01" step=".01" value={measuredPx??""} onChange={(event)=>setMeasuredPx(event.target.value?Number(event.target.value):null)}/></label>}
          {error!==null&&<div className="proofGate" data-pass={pass?"yes":"no"}><b>{pass?"PASS":"FAIL"} · {error.toFixed(2)}% error</b><span>Roadmap gate: ≤ 8% scale error.</span></div>}
          {!declaredTileMm&&!effectiveRepeatMm&&<p><b>Important:</b> the current photo is used now, but it stays labelled approximate until the photographed swatch width or pattern repeat is physically measured.</p>}
        </section>
        <section>
          <h2>Viewer realism gate</h2>
          <p>Ask each viewer to rate the real mannequin below from 1–5. Roadmap target: at least 6 of 8 viewers rate it 4 or 5.</p>
          <div className="proofRatingButtons">{[1,2,3,4,5].map((rating)=><button key={rating} type="button" onClick={()=>addRealismRating(rating)}>{rating}</button>)}</div>
          <div className="proofGate" data-pass={realismGate?"yes":"no"}>
            <b>{realismRatings.length} ratings · {strongRealism} strong</b>
            <span>{realismGate?"PASS · realism gate met":"Need 6 strong ratings from at least 8 viewers"}</span>
          </div>
          {realismRatings.length>0&&<button type="button" onClick={clearRealismRatings}>Clear ratings</button>}
          <button type="button" onClick={exportProofEvidence}>Export proof evidence JSON</button>
          <div className="proofGate" data-pass={proofAcceptance.accepted?"yes":"no"}>
            <b>{proofAcceptance.accepted?"PHASE 1 ACCEPTED":"PHASE 1 REVIEW"}</b>
            <span>{proofAcceptance.accepted?"Scale, real-model latency and viewer realism gates all pass.":proofAcceptance.reasons.join(" ")}</span>
          </div>
          <button type="button" onClick={()=>void recordProofEvidence()} disabled={recordBusy}>{recordBusy?"Recording…":proofAcceptance.accepted?"Record accepted proof":"Record review evidence"}</button>
          {recordMessage&&<p className="proofRecordMessage">{recordMessage}</p>}
        </section>
      </aside>
    </main>

    {proofRealShirt&&realPant&&<section className="proofRealism">
      <div className="proofRealismCopy">
        <span>REAL MANNEQUIN TRACK</span>
        <h2>Same catalogue fabric on our existing photographic model.</h2>
        <p>This reuses the current Linen Earth mannequin/photo compositor so cloth believability can be judged separately from construction geometry. The photographed collar/cuff shape stays the base photographed construction until matching photographed option assets exist.</p>
        <div className="proofRealismFacts">
          <b>{proofRealShirt.name}</b>
          <span>Real catalogue swatch</span>
          <span>Existing studio mannequin</span>
          <span>No AI per edit</span>
          <span>{declaredTileMm||effectiveRepeatMm?"Physical evidence entered":"Scale still approximate"}</span>
          {photoRepeatAuditPx!==null&&<span>Expected repeat on photo · {photoRepeatAuditPx.toFixed(2)} px</span>}
          <span>{realP95===null?"Real model latency awaiting edits":realP95<300?"Real model latency gate passing":"Real model latency needs review"}</span>
        </div>
      </div>
      <div className="proofRealModel">
        <StyleDirectorRealModelPreview shirt={proofRealShirt} pant={realPant} style={realModelStyle} onRenderMeasured={(milliseconds)=>setRealRenderSamples((current)=>[...current.slice(-29),milliseconds])}/>
      </div>
    </section>}

    {proofRealShirt&&realPant&&<section className="proofConstructionEngine">
      <div className="proofConstructionEngineHead">
        <span>CURRENT LIVE ENGINE · MULTI-VIEW</span>
        <h2>Check the same proof through the deterministic construction renderer.</h2>
        <p>Use Front and 3/4 as the Phase 1 comparison views. Side and Back remain available for regression checks. Fabric changes and construction edits stay local; no AI image call is made.</p>
      </div>
      <LiveConstructionPreview
        shirt={proofRealShirt}
        pant={realPant}
        style={proofConstructionStyle}
        occasion="Semi-Formal"
        climate="Not specified"
      />
  </div>;
}
