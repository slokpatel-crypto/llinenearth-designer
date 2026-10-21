"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GARMENT_VIEWER_LATENCY_STORAGE_KEY,
  GARMENT_VIEWER_REALISM_STORAGE_KEY,
  GARMENT_VIEWER_REALISM_RUBRIC_VERSION,
  garmentViewerAssetIdentityKey,
  type GarmentViewerAssetIdentity,
} from "@/lib/garment-viewer-readiness";
import { summarizeIndependentRealism, summarizeLatencySamples, type RealismAssessment } from "@/lib/designer/proof-scale";
import {
  parseGarmentLatencySamples,
  parseGarmentRealismAssessments,
  parseCalibratedScaleInput,
} from "@/lib/garment-viewer-evidence-validation";

type Boundaries={neck:boolean;cuffs:boolean;waist:boolean;trouserGap:boolean};
type StoredEvidence<T>={assetKey:string;value:T};

function readStored<T>(key:string,assetKey:string,fallback:T):T{
  try{
    const raw=localStorage.getItem(key);
    if(!raw) return fallback;
    const parsed=JSON.parse(raw) as StoredEvidence<T>|{assetKey?:unknown;samples?:unknown};
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)||String((parsed as {assetKey?:unknown}).assetKey||"")!==assetKey) return fallback;
    if(key===GARMENT_VIEWER_LATENCY_STORAGE_KEY){
      const samples=(parsed as {samples?:unknown}).samples;
      return (Array.isArray(samples)?samples:fallback) as T;
    }
    return ((parsed as StoredEvidence<T>).value ?? fallback) as T;
  }catch{return fallback;}
}

export default function GarmentViewerEvidenceForm({assetIdentity}:{assetIdentity:GarmentViewerAssetIdentity|null}){
  const assetKey=useMemo(()=>garmentViewerAssetIdentityKey(assetIdentity),[assetIdentity]);
  const [latencies,setLatencies]=useState<number[]>([]);
  const [assessments,setAssessments]=useState<RealismAssessment[]>([]);
  const [viewerCode,setViewerCode]=useState("");
  const [rating,setRating]=useState("4");
  const [stripeFabricId,setStripeFabricId]=useState("");
  const [stripeRepeatMm,setStripeRepeatMm]=useState("");
  const [stripeObservedPx,setStripeObservedPx]=useState("");
  const [stripeReferenceMm,setStripeReferenceMm]=useState("");
  const [stripeReferencePx,setStripeReferencePx]=useState("");
  const [stripeEvidenceNote,setStripeEvidenceNote]=useState("");
  const [stripeVerified,setStripeVerified]=useState(false);
  const [checkFabricId,setCheckFabricId]=useState("");
  const [checkRepeatMm,setCheckRepeatMm]=useState("");
  const [checkObservedPx,setCheckObservedPx]=useState("");
  const [checkReferenceMm,setCheckReferenceMm]=useState("");
  const [checkReferencePx,setCheckReferencePx]=useState("");
  const [checkEvidenceNote,setCheckEvidenceNote]=useState("");
  const [checkVerified,setCheckVerified]=useState(false);
  const [boundaryChecks,setBoundaryChecks]=useState<Boundaries>({neck:false,cuffs:false,waist:false,trouserGap:false});
  const [note,setNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  function refreshLocalEvidence(){
    if(!assetKey){setLatencies([]);setAssessments([]);return;}
    const localLatencies=parseGarmentLatencySamples(
      readStored<unknown>(GARMENT_VIEWER_LATENCY_STORAGE_KEY,assetKey,[]),
    );
    const localAssessments=parseGarmentRealismAssessments(
      readStored<unknown>(GARMENT_VIEWER_REALISM_STORAGE_KEY,assetKey,[]),
    );
    setLatencies(localLatencies);
    setAssessments(localAssessments);
  }

  useEffect(()=>{refreshLocalEvidence();},[assetKey]);

  const latencySummary=useMemo(()=>summarizeLatencySamples(latencies),[latencies]);
  const realismSummary=useMemo(()=>summarizeIndependentRealism(assessments),[assessments]);

  function saveAssessments(next:RealismAssessment[]){
    setAssessments(next);
    if(!assetKey) return;
    try{localStorage.setItem(GARMENT_VIEWER_REALISM_STORAGE_KEY,JSON.stringify({assetKey,value:next.slice(-50)}));}catch{}
  }

  function addRating(){
    const code=viewerCode.trim().toLowerCase();
    const score=Math.round(Number(rating));
    if(code.length<2||score<1||score>5){setMessage("Add a viewer code and a 1–5 rating.");return;}
    const next=[...assessments.filter((item)=>item.viewerId.toLowerCase()!==code),{viewerId:code,rating:score,recordedAt:new Date().toISOString()}];
    saveAssessments(next);
    setViewerCode("");
    setMessage("");
  }

  async function recordEvidence(){
    if(!assetIdentity||!assetKey){setMessage("Configure and validate the production GLB + manifest first.");return;}
    const stripeSample=parseCalibratedScaleInput(stripeFabricId,"stripe",stripeRepeatMm,stripeObservedPx,stripeReferenceMm,stripeReferencePx,stripeEvidenceNote,stripeVerified);
    const checkSample=parseCalibratedScaleInput(checkFabricId,"check",checkRepeatMm,checkObservedPx,checkReferenceMm,checkReferencePx,checkEvidenceNote,checkVerified);
    if((stripeVerified&&!stripeSample)||(checkVerified&&!checkSample)){
      setMessage("Verified scale requires fabric ID, physical repeat (mm), observed preview repeat (px), same-plane ruler dimensions (mm/px), and a measurement source note (12+ characters).");
      return;
    }
    const patternScaleSamples=[stripeSample,checkSample].filter((sample)=>sample!==null);
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/memory/event",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          id:"EV-GARMENT-VIEWER-"+crypto.randomUUID(),
          sessionId:"GARMENT-VIEWER-M2-QA",
          type:"operator_note",
          at:new Date().toISOString(),
          payload:{
            subtype:"garment_viewer_readiness",
            version:"linen-earth-garment-viewer-readiness-v1",
            status:"review",
            realismRubricVersion:GARMENT_VIEWER_REALISM_RUBRIC_VERSION,
            ...assetIdentity,
            patternScaleSamples,
            interactionLatencyMs:latencies,
            realismAssessments:realismSummary.assessments,
            boundaryChecks,
            note:note.trim(),
          },
        }),
      });
      const result=await response.json() as {stored?:boolean;error?:string};
      if(!response.ok||!result.stored) throw new Error(result.error||"GarmentViewer evidence could not be stored.");
      setMessage("Evidence recorded against this exact GLB + manifest revision.");
      window.setTimeout(()=>window.location.reload(),350);
    }catch(error){
      setMessage(error instanceof Error?error.message:"GarmentViewer evidence could not be stored.");
    }finally{setBusy(false);}
  }

  const checks=Object.entries(boundaryChecks) as Array<[keyof Boundaries,boolean]>;
  return <section className="garmentQaPanel garmentQaEvidenceForm">
    <div className="garmentQaPanelHead"><div><small>RECORD QA EVIDENCE</small><h2>Evidence stays tied to this exact model revision</h2></div><button type="button" onClick={refreshLocalEvidence}>Refresh lab samples</button></div>
    {!assetIdentity?<p className="garmentQaReasons">Production asset identity is unavailable, so evidence recording is locked.</p>:<>
      <div className="garmentQaEvidenceMeta"><span><small>MODEL</small><b>{assetIdentity.modelId}</b></span><span><small>GLB HASH</small><b>{assetIdentity.modelSha256.slice(0,12)}…</b></span><span><small>MANIFEST HASH</small><b>{assetIdentity.manifestSha256.slice(0,12)}…</b></span></div>
      <div className="garmentQaEvidenceMetrics"><span><small>LAB LATENCY</small><b>{latencySummary.count}</b><em>{latencySummary.p95Ms===null?"p95 pending":`p95 ${latencySummary.p95Ms} ms`}</em></span><span><small>REALISM VIEWERS</small><b>{realismSummary.uniqueViewers}</b><em>{realismSummary.strongRatings} strong ratings</em></span></div>
      <div className="garmentQaRubric"><small>CALIBRATED PHYSICAL SCALE · AUDIT INPUTS</small><p>For each cloth pattern, measure the actual repeat on the physical fabric. In the same image/plane as the 3D preview repeat, measure the on-screen repeat in pixels and a known millimetre ruler in pixels. Error is calculated, never manually asserted. Record the source and measurement setup; estimates are not physical verification.</p></div>
      <div className="garmentQaEvidenceGrid">
        <label><span>Stripe fabric ID</span><input value={stripeFabricId} onChange={(event)=>setStripeFabricId(event.target.value)} placeholder="Exact tested fabric ID"/></label>
        <label><span>Physical stripe repeat (mm)</span><input type="number" min=".001" step="any" value={stripeRepeatMm} onChange={(event)=>setStripeRepeatMm(event.target.value)} placeholder="Measured mm"/></label>
        <label><span>Observed stripe repeat (px)</span><input type="number" min=".001" step="any" value={stripeObservedPx} onChange={(event)=>setStripeObservedPx(event.target.value)} placeholder="Rendered px"/></label>
        <label><span>Stripe ruler length (mm)</span><input type="number" min=".001" step="any" value={stripeReferenceMm} onChange={(event)=>setStripeReferenceMm(event.target.value)} placeholder="Known mm"/></label>
        <label><span>Stripe ruler length (px)</span><input type="number" min=".001" step="any" value={stripeReferencePx} onChange={(event)=>setStripeReferencePx(event.target.value)} placeholder="Measured px"/></label>
        <label><span>Stripe evidence source/method</span><input value={stripeEvidenceNote} onChange={(event)=>setStripeEvidenceNote(event.target.value)} placeholder="Cloth ruler/source, camera setup"/></label>
        <label className="garmentQaCheck"><input type="checkbox" checked={stripeVerified} onChange={(event)=>setStripeVerified(event.target.checked)}/><span>Observed against real physical repeat</span></label>
        <label><span>Check fabric ID</span><input value={checkFabricId} onChange={(event)=>setCheckFabricId(event.target.value)} placeholder="Exact tested fabric ID"/></label>
        <label><span>Physical check repeat (mm)</span><input type="number" min=".001" step="any" value={checkRepeatMm} onChange={(event)=>setCheckRepeatMm(event.target.value)} placeholder="Measured mm"/></label>
        <label><span>Observed check repeat (px)</span><input type="number" min=".001" step="any" value={checkObservedPx} onChange={(event)=>setCheckObservedPx(event.target.value)} placeholder="Rendered px"/></label>
        <label><span>Check ruler length (mm)</span><input type="number" min=".001" step="any" value={checkReferenceMm} onChange={(event)=>setCheckReferenceMm(event.target.value)} placeholder="Known mm"/></label>
        <label><span>Check ruler length (px)</span><input type="number" min=".001" step="any" value={checkReferencePx} onChange={(event)=>setCheckReferencePx(event.target.value)} placeholder="Measured px"/></label>
        <label><span>Check evidence source/method</span><input value={checkEvidenceNote} onChange={(event)=>setCheckEvidenceNote(event.target.value)} placeholder="Cloth ruler/source, camera setup"/></label>
        <label className="garmentQaCheck"><input type="checkbox" checked={checkVerified} onChange={(event)=>setCheckVerified(event.target.checked)}/><span>Observed against real physical repeat</span></label>
      </div>
      <div className="garmentQaRubric"><small>REALISM RUBRIC · V1</small><p>Rate the same five things every time: officewear silhouette/proportions, cloth drape and body fit, collar/neck junction, hands + waist/trouser boundaries, and overall photographic believability against the studio-tucked reference. Give 4/5 or 5/5 only when there is no major mismatch.</p></div>
      <div className="garmentQaRating">
        <label><span>Independent viewer code</span><input value={viewerCode} onChange={(event)=>setViewerCode(event.target.value)} placeholder="e.g. viewer-07"/></label>
        <label><span>Realism rating</span><select value={rating} onChange={(event)=>setRating(event.target.value)}>{[1,2,3,4,5].map((value)=><option key={value} value={value}>{value}/5</option>)}</select></label>
        <button type="button" onClick={addRating}>Add / replace rating</button>
      </div>
      <div className="garmentQaBoundary"><small>VISUAL BOUNDARIES</small>{checks.map(([key,value])=><label key={key}><input type="checkbox" checked={value} onChange={(event)=>setBoundaryChecks((current)=>({...current,[key]:event.target.checked}))}/><span>{key==="trouserGap"?"Trouser gap":key}</span></label>)}</div>
      <label className="garmentQaNote"><span>QA note</span><textarea value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Reference, test conditions, reviewer context…"/></label>
      <div className="garmentQaRecord"><p>Latency comes only from real fabric changes performed in the 3D Lab on this exact asset hash. Ratings are deduplicated by viewer code.</p><button type="button" disabled={busy} onClick={()=>void recordEvidence()}>{busy?"Recording…":"Record current QA evidence"}</button></div>
      {message&&<p className="garmentQaMessage">{message}</p>}
    </>}
  </section>;
}
