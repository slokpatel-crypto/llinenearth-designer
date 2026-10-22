"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GARMENT_VIEWER_LATENCY_STORAGE_KEY,
  GARMENT_VIEWER_REALISM_STORAGE_KEY,
  GARMENT_VIEWER_REALISM_RUBRIC_VERSION,
  garmentViewerAssetIdentityKey,
  calibratedGarmentScaleErrorPct,
  type GarmentViewerAssetIdentity,
} from "@/lib/garment-viewer-readiness";
import { ROADMAP_SCALE_TOLERANCE_PCT, normalizeIndependentViewerCode, summarizeIndependentRealism, summarizeLatencySamples, type RealismAssessment } from "@/lib/designer/proof-scale";
import {
  parseGarmentLatencySamples,
  parseGarmentRealismAssessments,
  garmentLatencySubmissionIsLossless,
  garmentRealismSubmissionIsLossless,
  parseMeasuredScaleInput,
  readGarmentViewerScopedCache,
} from "@/lib/garment-viewer-evidence-validation";

type Boundaries={neck:boolean;cuffs:boolean;waist:boolean;trouserGap:boolean};
function readStored<T>(key:string,assetKey:string,fallback:T):T|null {
  try {
    return readGarmentViewerScopedCache(localStorage.getItem(key),key,assetKey,fallback);
  } catch {
    // Block evidence acceptance if browser storage fails at all.
    return null;
  }
}

export default function GarmentViewerEvidenceForm({assetIdentity}:{assetIdentity:GarmentViewerAssetIdentity|null}){
  const assetKey=useMemo(()=>garmentViewerAssetIdentityKey(assetIdentity),[assetIdentity]);
  const [latencies,setLatencies]=useState<number[]>([]);
  const [assessments,setAssessments]=useState<RealismAssessment[]>([]);
  const [viewerCode,setViewerCode]=useState("");
  const [rating,setRating]=useState("4");
  const [stripeFabricId,setStripeFabricId]=useState("");
  const [stripePhysicalMm,setStripePhysicalMm]=useState("");
  const [stripeRepeatPx,setStripeRepeatPx]=useState("");
  const [stripeMarkerMm,setStripeMarkerMm]=useState("");
  const [stripeMarkerPx,setStripeMarkerPx]=useState("");
  const [stripeReference,setStripeReference]=useState("");
  const [stripeVerified,setStripeVerified]=useState(false);
  const [checkFabricId,setCheckFabricId]=useState("");
  const [checkPhysicalMm,setCheckPhysicalMm]=useState("");
  const [checkRepeatPx,setCheckRepeatPx]=useState("");
  const [checkMarkerMm,setCheckMarkerMm]=useState("");
  const [checkMarkerPx,setCheckMarkerPx]=useState("");
  const [checkReference,setCheckReference]=useState("");
  const [checkVerified,setCheckVerified]=useState(false);
  const [boundaryChecks,setBoundaryChecks]=useState<Boundaries>({neck:false,cuffs:false,waist:false,trouserGap:false});
  const [note,setNote]=useState("");
  // Never accept a readiness record merely by opening/reloading the QA desk.
  // This is operator acceptance of technical observations, not a production sign-off.
  const [acceptTechnicalEvidence,setAcceptTechnicalEvidence]=useState(false);
  const [localEvidenceCorrupt,setLocalEvidenceCorrupt]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  function refreshLocalEvidence(){
    // Refresh means the operator must explicitly review again, even if the
    // new samples happen to produce the same aggregate scores.
    setAcceptTechnicalEvidence(false);
    if(!assetKey){setLatencies([]);setAssessments([]);setLocalEvidenceCorrupt(false);return;}
    const savedLatencies=readStored<unknown>(GARMENT_VIEWER_LATENCY_STORAGE_KEY,assetKey,[]);
    const savedRatings=readStored<unknown>(GARMENT_VIEWER_REALISM_STORAGE_KEY,assetKey,[]);
    setLocalEvidenceCorrupt(!garmentLatencySubmissionIsLossless(savedLatencies)
      || !garmentRealismSubmissionIsLossless(savedRatings));
    const localLatencies=parseGarmentLatencySamples(savedLatencies);
    const localAssessments=parseGarmentRealismAssessments(savedRatings);
    setLatencies(localLatencies);
    setAssessments(localAssessments);
  }

  useEffect(()=>{
    refreshLocalEvidence();
    // Changing the GLB/manifest identity also invalidates the old physical
    // measurements, boundary ticks and reviewed note; none is transferable.
    setStripeFabricId("");setStripePhysicalMm("");setStripeRepeatPx("");
    setStripeMarkerMm("");setStripeMarkerPx("");setStripeReference("");setStripeVerified(false);
    setCheckFabricId("");setCheckPhysicalMm("");setCheckRepeatPx("");
    setCheckMarkerMm("");setCheckMarkerPx("");setCheckReference("");setCheckVerified(false);
    setBoundaryChecks({neck:false,cuffs:false,waist:false,trouserGap:false});
    setNote("");setMessage("");
  },[assetKey]);

  const latencySummary=useMemo(()=>summarizeLatencySamples(latencies),[latencies]);
  const realismSummary=useMemo(()=>summarizeIndependentRealism(assessments),[assessments]);

  function saveAssessments(next:RealismAssessment[]):boolean {
    if(!assetKey) return false;
    try {
      // Reject overflow rather than silently dropping an independent reviewer.
      localStorage.setItem(GARMENT_VIEWER_REALISM_STORAGE_KEY,JSON.stringify({assetKey,value:next}));
      return true;
    } catch {
      return false;
    }
  }

  function addRating(){
    const code=normalizeIndependentViewerCode(viewerCode);
    const score=Number(rating);
    if(!code||!Number.isInteger(score)||score<1||score>5){
      setMessage("Use a 2–80 character reviewer code with letters, numbers, dots, underscores or hyphens and an integer 1–5 rating.");
      return;
    }
    const next=[...assessments.filter((item)=>item.viewerId.toLowerCase()!==code),{viewerId:code,rating:score,recordedAt:new Date().toISOString()}];
    if(!garmentRealismSubmissionIsLossless(next)){
      setMessage("Cannot add this rating: the lab allows at most 50 distinct valid viewer codes. Replace an existing code if needed.");
      return;
    }
    if(!saveAssessments(next)){
      setMessage("Rating could not be saved to the model-scoped lab cache. Check browser storage before recording QA.");
      return;
    }
    refreshLocalEvidence();
    setViewerCode("");
    setMessage("");
  }

  async function recordEvidence(){
    if(!assetIdentity||!assetKey){setMessage("Configure and validate the production GLB + manifest first.");return;}
    // The lab cache is a transport staging area, not a trusted source. Reject
    // raw malformed samples before filtered UI summaries can hide bad timings
    // or ratings from the operator event submitted to the server.
    const savedLatencies=readStored<unknown>(GARMENT_VIEWER_LATENCY_STORAGE_KEY,assetKey,[]);
    const savedRatings=readStored<unknown>(GARMENT_VIEWER_REALISM_STORAGE_KEY,assetKey,[]);
    if(!garmentLatencySubmissionIsLossless(savedLatencies)
      || !garmentRealismSubmissionIsLossless(savedRatings)){
      setLocalEvidenceCorrupt(true);
      setAcceptTechnicalEvidence(false);
      setMessage("Lab evidence contains invalid, duplicated or truncated measurements. Re-capture the timing samples in 3D Lab or replace the invalid ratings before recording QA.");
      return;
    }
    const currentLatencies=parseGarmentLatencySamples(savedLatencies);
    const currentAssessments=parseGarmentRealismAssessments(savedRatings);
    // Never submit observations silently replaced in another tab since the
    // operator reviewed this page. Refresh the UI and require re-acceptance.
    if(JSON.stringify(currentLatencies)!==JSON.stringify(latencies)
      || JSON.stringify(currentAssessments)!==JSON.stringify(assessments)){
      setLatencies(currentLatencies);
      setAssessments(currentAssessments);
      setAcceptTechnicalEvidence(false);
      setMessage("Lab evidence changed since this review. Check the refreshed latency and viewer metrics, then accept the technical QA again.");
      return;
    }
    setLocalEvidenceCorrupt(false);
    const stripeSample=parseMeasuredScaleInput(stripeFabricId,stripePhysicalMm,stripeRepeatPx,stripeMarkerMm,stripeMarkerPx,stripeReference,"stripe",stripeVerified);
    const checkSample=parseMeasuredScaleInput(checkFabricId,checkPhysicalMm,checkRepeatPx,checkMarkerMm,checkMarkerPx,checkReference,"check",checkVerified);
    if((stripeVerified&&!stripeSample)||(checkVerified&&!checkSample)){
      setMessage("For each verified fabric, enter real cloth repeat (mm), rendered repeat (px), same-plane calibration marker (mm + px), and traceable reference. Claimed error percentages are not accepted.");
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
            status:acceptTechnicalEvidence?"accepted":"review",
            realismRubricVersion:GARMENT_VIEWER_REALISM_RUBRIC_VERSION,
            ...assetIdentity,
            patternScaleSamples,
            interactionLatencyMs:currentLatencies,
            realismAssessments:summarizeIndependentRealism(currentAssessments).assessments,
            boundaryChecks,
            note:note.trim(),
          },
        }),
      });
      const result=await response.json() as {stored?:boolean;error?:string};
      if(!response.ok||!result.stored) throw new Error(result.error||"GarmentViewer evidence could not be stored.");
      setMessage(acceptTechnicalEvidence
        ?"Technical QA evidence accepted against this exact asset. Production release still requires separate independent physical and owner/tailor approval."
        :"QA evidence recorded for operator review; it cannot pass the acceptance gate until explicitly accepted.");
      setAcceptTechnicalEvidence(false);
      window.setTimeout(()=>window.location.reload(),350);
    }catch(error){
      setMessage(error instanceof Error?error.message:"GarmentViewer evidence could not be stored.");
    }finally{setBusy(false);}
  }

  const stripePreview=parseMeasuredScaleInput(stripeFabricId,stripePhysicalMm,stripeRepeatPx,stripeMarkerMm,stripeMarkerPx,stripeReference,"stripe",stripeVerified);
  const checkPreview=parseMeasuredScaleInput(checkFabricId,checkPhysicalMm,checkRepeatPx,checkMarkerMm,checkMarkerPx,checkReference,"check",checkVerified);
  const stripeExactError=stripePreview?calibratedGarmentScaleErrorPct(stripePreview):null;
  const checkExactError=checkPreview?calibratedGarmentScaleErrorPct(checkPreview):null;
  const duplicateSubject=Boolean(stripeFabricId.trim()&&checkFabricId.trim()
    && stripeFabricId.trim().toLowerCase()===checkFabricId.trim().toLowerCase());
  const checks=Object.entries(boundaryChecks) as Array<[keyof Boundaries,boolean]>;
  return <section className="garmentQaPanel garmentQaEvidenceForm">
    <div className="garmentQaPanelHead"><div><small>RECORD QA EVIDENCE</small><h2>Evidence stays tied to this exact model revision</h2></div><button type="button" onClick={refreshLocalEvidence}>Refresh lab samples</button></div>
    {!assetIdentity?<p className="garmentQaReasons">Production asset identity is unavailable, so evidence recording is locked.</p>:<>
      <div className="garmentQaEvidenceMeta"><span><small>MODEL</small><b>{assetIdentity.modelId}</b></span><span><small>GLB HASH</small><b>{assetIdentity.modelSha256.slice(0,12)}…</b></span><span><small>MANIFEST HASH</small><b>{assetIdentity.manifestSha256.slice(0,12)}…</b></span></div>
      {localEvidenceCorrupt&&<p className="garmentQaAuditWarning" role="alert">A saved lab timing or realism rating is invalid or lossy. Recording is locked until the affected asset-scoped lab evidence is replaced and refreshed.</p>}
      <div className="garmentQaEvidenceMetrics"><span><small>LAB LATENCY</small><b>{latencySummary.count}</b><em>{latencySummary.p95Ms===null?"p95 pending":`p95 ${latencySummary.p95Ms} ms`}</em></span><span><small>REALISM VIEWERS</small><b>{realismSummary.uniqueViewers}</b><em>{realismSummary.strongRatings} strong ratings</em></span></div>
      <div className="garmentQaRubric"><small>PHYSICAL REPEAT CALIBRATION</small><p>Measure the actual fabric repeat in mm. On one rendered screenshot, measure the repeat in pixels and a known-size reference marker in both mm and pixels, at the same depth. The system computes the scale error; include an identifiable measurement photo or worksheet reference. No pre-filled or manually asserted error % is accepted.</p></div>
      <div className="garmentQaEvidenceGrid">
        <label><span>Stripe fabric ID</span><input value={stripeFabricId} onChange={(event)=>setStripeFabricId(event.target.value)} placeholder="Exact tested fabric ID"/></label>
        <label><span>Physical stripe repeat · mm</span><input type="number" min="0.001" max="1000" step="any" value={stripePhysicalMm} onChange={(event)=>setStripePhysicalMm(event.target.value)} placeholder="Measured on cloth"/></label>
        <label><span>Rendered stripe repeat · px</span><input type="number" min="0.001" max="10000" step="any" value={stripeRepeatPx} onChange={(event)=>setStripeRepeatPx(event.target.value)} placeholder="Measured in screenshot"/></label>
        <label><span>Rendered reference length · mm</span><input type="number" min="0.001" max="3000" step="any" value={stripeMarkerMm} onChange={(event)=>setStripeMarkerMm(event.target.value)} placeholder="Known size on model"/></label>
        <label><span>Rendered reference length · px</span><input type="number" min="0.001" max="10000" step="any" value={stripeMarkerPx} onChange={(event)=>setStripeMarkerPx(event.target.value)} placeholder="Same-plane marker pixels"/></label>
        <label><span>Stripe evidence reference</span><input value={stripeReference} onChange={(event)=>setStripeReference(event.target.value)} placeholder="Photo/worksheet reference"/></label>
        <label className="garmentQaCheck"><input type="checkbox" checked={stripeVerified} onChange={(event)=>setStripeVerified(event.target.checked)}/><span>Stripe values measured and traceable (independent sign-off still required)</span></label>
        <label><span>Check fabric ID</span><input value={checkFabricId} onChange={(event)=>setCheckFabricId(event.target.value)} placeholder="Exact tested fabric ID"/></label>
        <label><span>Physical check repeat · mm</span><input type="number" min="0.001" max="1000" step="any" value={checkPhysicalMm} onChange={(event)=>setCheckPhysicalMm(event.target.value)} placeholder="Measured on cloth"/></label>
        <label><span>Rendered check repeat · px</span><input type="number" min="0.001" max="10000" step="any" value={checkRepeatPx} onChange={(event)=>setCheckRepeatPx(event.target.value)} placeholder="Measured in screenshot"/></label>
        <label><span>Rendered reference length · mm</span><input type="number" min="0.001" max="3000" step="any" value={checkMarkerMm} onChange={(event)=>setCheckMarkerMm(event.target.value)} placeholder="Known size on model"/></label>
        <label><span>Rendered reference length · px</span><input type="number" min="0.001" max="10000" step="any" value={checkMarkerPx} onChange={(event)=>setCheckMarkerPx(event.target.value)} placeholder="Same-plane marker pixels"/></label>
        <label><span>Check evidence reference</span><input value={checkReference} onChange={(event)=>setCheckReference(event.target.value)} placeholder="Photo/worksheet reference"/></label>
        <label className="garmentQaCheck"><input type="checkbox" checked={checkVerified} onChange={(event)=>setCheckVerified(event.target.checked)}/><span>Check values measured and traceable (independent sign-off still required)</span></label>
      </div>
      <div className="garmentQaScalePreview" aria-live="polite">
        {([
          ["Stripe",stripeVerified,stripeExactError],
          ["Check",checkVerified,checkExactError],
        ] as const).map(([pattern,verified,error])=><div key={pattern} data-ready={verified&&error!==null&&error<=ROADMAP_SCALE_TOLERANCE_PCT}>
          <small>{pattern.toUpperCase()} · COMPUTED SCALE</small>
          <strong>{error===null?"Needs full calibration":error.toFixed(3)+"% error"}</strong>
          <span>{error===null?"Enter all measurements and a traceable source.":!verified?"Measurement recorded but not verified.":error<=ROADMAP_SCALE_TOLERANCE_PCT?"Within technical tolerance; physical review still required.":"Outside tolerance; scale gate cannot pass."}</span>
        </div>)}
      </div>
      {duplicateSubject&&<p className="garmentQaAuditWarning">Stripe and check must use distinct physical fabric IDs, including letter case.</p>}
      <div className="garmentQaRubric"><small>REALISM RUBRIC · V1</small><p>Rate the same five things every time: officewear silhouette/proportions, cloth drape and body fit, collar/neck junction, hands + waist/trouser boundaries, and overall photographic believability against the studio-tucked reference. Give 4/5 or 5/5 only when there is no major mismatch.</p></div>
      <div className="garmentQaRating">
        <label><span>Independent viewer code</span><input value={viewerCode} onChange={(event)=>setViewerCode(event.target.value)} placeholder="e.g. viewer-07"/></label>
        <label><span>Realism rating</span><select value={rating} onChange={(event)=>setRating(event.target.value)}>{[1,2,3,4,5].map((value)=><option key={value} value={value}>{value}/5</option>)}</select></label>
        <button type="button" onClick={addRating}>Add / replace rating</button>
      </div>
      <div className="garmentQaBoundary"><small>VISUAL BOUNDARIES</small>{checks.map(([key,value])=><label key={key}><input type="checkbox" checked={value} onChange={(event)=>setBoundaryChecks((current)=>({...current,[key]:event.target.checked}))}/><span>{key==="trouserGap"?"Trouser gap":key}</span></label>)}</div>
      <label className="garmentQaNote"><span>QA note</span><textarea value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Reference, test conditions, reviewer context…"/></label>
      <label className="garmentQaCheck"><input type="checkbox" checked={acceptTechnicalEvidence} onChange={(event)=>setAcceptTechnicalEvidence(event.target.checked)}/><span>Accept this exact-asset technical QA record after operator review. This is NOT owner/tailor approval, physical garment acceptance, customer 3D activation or permission to deploy.</span></label>
      <div className="garmentQaRecord"><p>Latency comes only from real fabric changes performed in the 3D Lab on this exact asset hash. Ratings are deduplicated by viewer code. Unchecked records remain in review and cannot pass the acceptance gate.</p><button type="button" disabled={busy} onClick={()=>void recordEvidence()}>{busy?"Recording…":acceptTechnicalEvidence?"Accept and record technical QA":"Record QA for review"}</button></div>
      {message&&<p className="garmentQaMessage">{message}</p>}
    </>}
  </section>;
}
