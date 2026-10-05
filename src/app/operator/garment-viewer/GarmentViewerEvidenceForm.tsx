"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GARMENT_VIEWER_LATENCY_STORAGE_KEY,
  GARMENT_VIEWER_REALISM_STORAGE_KEY,
  garmentViewerAssetIdentityKey,
  type GarmentViewerAssetIdentity,
} from "@/lib/garment-viewer-readiness";
import { summarizeIndependentRealism, summarizeLatencySamples, type RealismAssessment } from "@/lib/designer/proof-scale";

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
  const [stripeError,setStripeError]=useState("");
  const [stripeVerified,setStripeVerified]=useState(false);
  const [checkFabricId,setCheckFabricId]=useState("");
  const [checkError,setCheckError]=useState("");
  const [checkVerified,setCheckVerified]=useState(false);
  const [boundaryChecks,setBoundaryChecks]=useState<Boundaries>({neck:false,cuffs:false,waist:false,trouserGap:false});
  const [note,setNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  function refreshLocalEvidence(){
    if(!assetKey){setLatencies([]);setAssessments([]);return;}
    const localLatencies=readStored<number[]>(GARMENT_VIEWER_LATENCY_STORAGE_KEY,assetKey,[])
      .map(Number).filter((value)=>Number.isFinite(value)&&value>=0&&value<=10000).slice(-120);
    const localAssessments=readStored<RealismAssessment[]>(GARMENT_VIEWER_REALISM_STORAGE_KEY,assetKey,[])
      .flatMap((item)=>{
        const code=String(item.viewerId||"").trim().toLowerCase().slice(0,80);
        const score=Math.round(Number(item.rating));
        return code.length>=2&&score>=1&&score<=5?[{viewerId:code,rating:score,recordedAt:String(item.recordedAt||"").slice(0,80)}]:[];
      }).slice(-50);
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

  function scaleSample(fabricId:string,error:string,pattern:"stripe"|"check",verified:boolean){
    const value=Number(error);
    if(!fabricId.trim()||!Number.isFinite(value)||value<0||value>100) return null;
    return {fabricId:fabricId.trim().slice(0,160),pattern,errorPct:Math.round(value*100)/100,verified};
  }

  async function recordEvidence(){
    if(!assetIdentity||!assetKey){setMessage("Configure and validate the production GLB + manifest first.");return;}
    const patternScaleSamples=[
      scaleSample(stripeFabricId,stripeError,"stripe",stripeVerified),
      scaleSample(checkFabricId,checkError,"check",checkVerified),
    ].filter(Boolean);
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
      <div className="garmentQaEvidenceGrid">
        <label><span>Stripe fabric ID</span><input value={stripeFabricId} onChange={(event)=>setStripeFabricId(event.target.value)} placeholder="Exact tested fabric ID"/></label>
        <label><span>Stripe scale error %</span><input type="number" min="0" max="100" step=".1" value={stripeError} onChange={(event)=>setStripeError(event.target.value)} placeholder="≤ 8"/></label>
        <label className="garmentQaCheck"><input type="checkbox" checked={stripeVerified} onChange={(event)=>setStripeVerified(event.target.checked)}/><span>Measured against verified physical repeat</span></label>
        <label><span>Check fabric ID</span><input value={checkFabricId} onChange={(event)=>setCheckFabricId(event.target.value)} placeholder="Exact tested fabric ID"/></label>
        <label><span>Check scale error %</span><input type="number" min="0" max="100" step=".1" value={checkError} onChange={(event)=>setCheckError(event.target.value)} placeholder="≤ 8"/></label>
        <label className="garmentQaCheck"><input type="checkbox" checked={checkVerified} onChange={(event)=>setCheckVerified(event.target.checked)}/><span>Measured against verified physical repeat</span></label>
      </div>
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
