"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StatsPayload={
  engine?:string;
  visibleOnCustomerWeb?:boolean;
  corpus?:{materials:number;patterns:number;colors:number;sources:number;realExamples:number};
  database?:Record<string,number|null>|null;
};

type AnalyzerProfile={
  version:string;
  summary:string;
  observed:{
    dominantColor:string;
    colorFamily:string;
    patternFamily:string;
    patternScale:string;
    patternDensity:string;
    patternContrast:string;
    orientation:string;
    visibleTexture:string[];
    weaveAppearance:string[];
    sheen:string;
    visualWeight:string;
  };
  confidence:{color:number;pattern:number;texture:number;styling:number};
  measured?:{
    colour?:{hex:string;deltaE:number;mappedColorFamily:string};
    pattern?:{
      repeatMm:number|null;
      stripeWidthMm:number|null;
      physicalScaleStatus:string;
      contrastDeltaE:number|null;
      orientation:string;
      scale:string;
      density:string;
    };
    imageQuality?:{score:number;issues:string[]};
  }|null;
  verifiedPhysical?:{
    gsm:number|null;
    drape:string|null;
    fiberContent:string|null;
    sourceUrl:string|null;
  };
  captureSet?:Array<{role:string;imageUrl:string;contentSha256:string|null}>;
  reviewNeeded?:string[];
};

type AnalyzerRun={
  profile:AnalyzerProfile;
  profileId:string|null;
  cached:boolean;
  reviewStatus:string|null;
  reviewPriority:"low"|"normal"|"high";
  reviewReasons:string[];
};

type ReviewRow={
  id:string;
  image_source:string;
  review_status:string;
  review_notes:string;
  profile:AnalyzerProfile;
  created_at:string;
  updated_at:string;
};

const initial={
  imageUrl:"",
  macroImageUrl:"",
  foldImageUrl:"",
  sourcePageUrl:"",
  sourceId:"",
  declaredMaterial:"",
  declaredFabricType:"",
  supplierColorName:"",
  supplierPatternName:"",
  swatchRealWidthMm:"",
  repeatRealMm:"",
  verifiedGsm:"",
  verifiedDrape:"",
  verifiedFiberContent:"",
  verifiedPhysicalSourceUrl:"",
  notes:"",
};

function pct(value:number|undefined){return typeof value==="number"?`${Math.round(value*100)}%`:"—";}
function nice(value:string|undefined){return value?value.replaceAll("_"," "):"—";}

export default function FabricAnalyzerClient(){
  const [form,setForm]=useState(initial);
  const [stats,setStats]=useState<StatsPayload|null>(null);
  const [run,setRun]=useState<AnalyzerRun|null>(null);
  const [queue,setQueue]=useState<ReviewRow[]>([]);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [queueLoading,setQueueLoading]=useState(false);

  async function loadStats(){
    const response=await fetch("/api/operator/fabric-analyzer/stats",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/fabric-analyzer";return;}
    const data=await response.json();
    if(response.ok) setStats(data);
  }

  async function loadQueue(){
    setQueueLoading(true);
    try{
      const response=await fetch("/api/operator/fabric-analyzer/review?limit=40",{cache:"no-store"});
      if(response.status===401){window.location.href="/operator/login?next=/operator/fabric-analyzer";return;}
      const data=await response.json() as {profiles?:ReviewRow[];error?:string};
      if(!response.ok) throw new Error(data.error||"Review queue could not be loaded.");
      setQueue(Array.isArray(data.profiles)?data.profiles:[]);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Review queue could not be loaded.");
    }finally{setQueueLoading(false);}
  }

  useEffect(()=>{void loadStats();void loadQueue();},[]);

  const captureCount=useMemo(()=>[form.imageUrl,form.macroImageUrl,form.foldImageUrl].filter(Boolean).length,[form]);
  const physicalCount=useMemo(()=>[form.verifiedGsm,form.verifiedDrape,form.verifiedFiberContent,form.repeatRealMm,form.swatchRealWidthMm].filter(Boolean).length,[form]);

  function field<K extends keyof typeof initial>(key:K,value:string){setForm((current)=>({...current,[key]:value}));}

  async function analyze(){
    if(!form.imageUrl.trim()||loading) return;
    setLoading(true);setMessage("");setRun(null);
    try{
      const body={
        ...form,
        swatchRealWidthMm:form.swatchRealWidthMm?Number(form.swatchRealWidthMm):undefined,
        repeatRealMm:form.repeatRealMm?Number(form.repeatRealMm):undefined,
        verifiedGsm:form.verifiedGsm?Number(form.verifiedGsm):undefined,
      };
      const response=await fetch("/api/operator/fabric-analyzer/analyze",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify(body),
      });
      if(response.status===401){window.location.href="/operator/login?next=/operator/fabric-analyzer";return;}
      const data=await response.json() as {run?:AnalyzerRun;error?:string};
      if(!response.ok||!data.run) throw new Error(data.error||"Fabric Analyzer failed.");
      setRun(data.run);
      setMessage(data.run.cached?"Reviewed profile reused from cache.":"New private Analyzer profile created.");
      await Promise.all([loadStats(),loadQueue()]);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Fabric Analyzer failed.");
    }finally{setLoading(false);}
  }

  async function review(profileId:string,status:"approved"|"rejected"){
    try{
      const response=await fetch("/api/operator/fabric-analyzer/review",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({profileId,status,notes:status==="approved"?"Operator accepted the profile as-is.":"Operator rejected the profile for correction."}),
      });
      const data=await response.json() as {ok?:boolean;error?:string};
      if(!response.ok||!data.ok) throw new Error(data.error||"Profile review failed.");
      setMessage(`Profile marked ${status}.`);
      await Promise.all([loadStats(),loadQueue()]);
    }catch(error){setMessage(error instanceof Error?error.message:"Profile review failed.");}
  }

  return <main className="analyzerDesk">
    <header className="analyzerHero">
      <div>
        <span>LINEN EARTH / PRIVATE OPERATOR TOOL</span>
        <h1>Fabric Analyzer Desk</h1>
        <p>Capture measurable cloth evidence first, then let the private model classify styling signals. Nothing here is exposed to customers.</p>
      </div>
      <nav><Link href="/operator">Operator Desk</Link><Link href="/operator/designer-data">Designer Data</Link></nav>
    </header>

    <section className="analyzerPrivacy">
      <strong>BACKEND ONLY</strong>
      <p>Flat photo drives colour and pattern measurement. Macro is for texture/weave appearance. Fold is for visual fall only. GSM, fibre and physical drape remain owner/supplier verified facts.</p>
    </section>

    <section className="analyzerStats">
      <article><small>REFERENCE SOURCES</small><strong>{stats?.corpus?.sources ?? "—"}</strong></article>
      <article><small>MATERIAL TERMS</small><strong>{stats?.corpus?.materials ?? "—"}</strong></article>
      <article><small>PATTERN TERMS</small><strong>{stats?.corpus?.patterns ?? "—"}</strong></article>
      <article><small>COLOUR TERMS</small><strong>{stats?.corpus?.colors ?? "—"}</strong></article>
      <article><small>REAL EXAMPLES</small><strong>{stats?.corpus?.realExamples ?? "—"}</strong></article>
    </section>

    <section className="analyzerGrid">
      <article className="analyzerPanel analyzerForm">
        <div className="panelTitle"><span>01 / CAPTURE PROTOCOL</span><h2>Analyze one fabric.</h2><b>{captureCount}/3 captures</b></div>
        <div className="captureGrid">
          <label className="wide"><span>Flat photo URL *</span><input value={form.imageUrl} onChange={(e)=>field("imageUrl",e.target.value)} placeholder="Trusted HTTPS image URL" /><small>Sharp, evenly lit and cloth filling the frame.</small></label>
          <label><span>Macro photo URL</span><input value={form.macroImageUrl} onChange={(e)=>field("macroImageUrl",e.target.value)} placeholder="Optional macro texture photo" /></label>
          <label><span>Fold photo URL</span><input value={form.foldImageUrl} onChange={(e)=>field("foldImageUrl",e.target.value)} placeholder="Optional fold / fall photo" /></label>
        </div>

        <details open>
          <summary>Declared catalogue context</summary>
          <div className="formGrid">
            <label><span>Material</span><input value={form.declaredMaterial} onChange={(e)=>field("declaredMaterial",e.target.value)} /></label>
            <label><span>Fabric type</span><input value={form.declaredFabricType} onChange={(e)=>field("declaredFabricType",e.target.value)} /></label>
            <label><span>Supplier colour</span><input value={form.supplierColorName} onChange={(e)=>field("supplierColorName",e.target.value)} /></label>
            <label><span>Supplier pattern</span><input value={form.supplierPatternName} onChange={(e)=>field("supplierPatternName",e.target.value)} /></label>
            <label><span>Source ID</span><input value={form.sourceId} onChange={(e)=>field("sourceId",e.target.value)} /></label>
            <label><span>Source page URL</span><input value={form.sourcePageUrl} onChange={(e)=>field("sourcePageUrl",e.target.value)} /></label>
          </div>
        </details>

        <details>
          <summary>Verified physical facts · {physicalCount} supplied</summary>
          <div className="formGrid">
            <label><span>Swatch width (mm)</span><input type="number" min="1" value={form.swatchRealWidthMm} onChange={(e)=>field("swatchRealWidthMm",e.target.value)} /><small>Only if the photographed width is physically known.</small></label>
            <label><span>Pattern repeat (mm)</span><input type="number" min="1" value={form.repeatRealMm} onChange={(e)=>field("repeatRealMm",e.target.value)} /></label>
            <label><span>Verified GSM</span><input type="number" min="20" max="1000" value={form.verifiedGsm} onChange={(e)=>field("verifiedGsm",e.target.value)} /></label>
            <label><span>Verified drape</span><select value={form.verifiedDrape} onChange={(e)=>field("verifiedDrape",e.target.value)}><option value="">Unknown</option><option>Fluid</option><option>Balanced</option><option>Structured</option></select></label>
            <label className="wide"><span>Verified fibre content</span><input value={form.verifiedFiberContent} onChange={(e)=>field("verifiedFiberContent",e.target.value)} placeholder="Only from supplier/owner evidence" /></label>
            <label className="wide"><span>Physical evidence source URL</span><input value={form.verifiedPhysicalSourceUrl} onChange={(e)=>field("verifiedPhysicalSourceUrl",e.target.value)} /></label>
          </div>
        </details>

        <label className="wide notes"><span>Operator notes</span><textarea rows={3} value={form.notes} onChange={(e)=>field("notes",e.target.value)} placeholder="Anything relevant to this exact fabric record" /></label>
        <button className="analyzeButton" disabled={!form.imageUrl.trim()||loading} onClick={()=>void analyze()}>{loading?"Measuring + analyzing…":"Run private Analyzer"}</button>
      </article>

      <aside className="analyzerPanel analyzerResult">
        <div className="panelTitle"><span>02 / RESULT</span><h2>{run?"Measured profile":"Waiting for fabric"}</h2>{run&&<b data-priority={run.reviewPriority}>{run.reviewPriority} review</b>}</div>
        {!run ? <div className="emptyResult">Run a flat photo first. Macro and fold captures strengthen appearance evidence but never create physical facts.</div> : <>
          <div className="resultLead"><i style={{background:run.profile.measured?.colour?.hex || run.profile.observed.dominantColor}}/><div><strong>{run.profile.measured?.colour?.hex || run.profile.observed.dominantColor}</strong><span>{nice(run.profile.observed.colorFamily)} · ΔE {run.profile.measured?.colour?.deltaE ?? "—"}</span></div></div>
          <div className="resultGrid">
            <span><small>PATTERN</small><b>{nice(run.profile.observed.patternFamily)}</b></span>
            <span><small>SCALE</small><b>{nice(run.profile.observed.patternScale)}</b></span>
            <span><small>DENSITY</small><b>{nice(run.profile.observed.patternDensity)}</b></span>
            <span><small>ORIENTATION</small><b>{nice(run.profile.observed.orientation)}</b></span>
            <span><small>IMAGE QUALITY</small><b>{run.profile.measured?.imageQuality?.score ?? "—"}/100</b></span>
            <span><small>PHYSICAL SCALE</small><b>{nice(run.profile.measured?.pattern?.physicalScaleStatus)}</b></span>
          </div>
          <div className="confidence">
            <span>Colour <b>{pct(run.profile.confidence.color)}</b></span>
            <span>Pattern <b>{pct(run.profile.confidence.pattern)}</b></span>
            <span>Texture <b>{pct(run.profile.confidence.texture)}</b></span>
            <span>Styling <b>{pct(run.profile.confidence.styling)}</b></span>
          </div>
          <div className="physicalTruth"><small>VERIFIED PHYSICAL</small><p>GSM <b>{run.profile.verifiedPhysical?.gsm ?? "unknown"}</b> · Drape <b>{run.profile.verifiedPhysical?.drape || "unknown"}</b></p><p>Fibre <b>{run.profile.verifiedPhysical?.fiberContent || "unknown"}</b></p></div>
          <div className="captures"><small>CAPTURES USED</small>{(run.profile.captureSet||[]).map((item)=><span key={item.role}>{item.role}<b>{item.contentSha256?"measured":"unmeasured"}</b></span>)}</div>
          <div className="summary"><small>ANALYZER SUMMARY</small><p>{run.profile.summary}</p></div>
          {!!run.reviewReasons?.length&&<div className="reviewReasons"><small>WHY REVIEW</small>{run.reviewReasons.map((item)=><p key={item}>{item}</p>)}</div>}
          {run.profileId&&<div className="resultActions"><button onClick={()=>void review(run.profileId!,"approved")}>Approve profile</button><button onClick={()=>void review(run.profileId!,"rejected")}>Reject</button></div>}
        </>}
      </aside>
    </section>

    <section className="reviewQueue analyzerPanel">
      <div className="panelTitle"><span>03 / HUMAN REVIEW</span><h2>Analyzer review queue.</h2><button onClick={()=>void loadQueue()} disabled={queueLoading}>{queueLoading?"Refreshing…":"Refresh"}</button></div>
      {!queue.length ? <div className="emptyResult">No profiles are waiting for review.</div> : <div className="reviewRows">{queue.map((row)=><article key={row.id}>
        <div><small>{row.review_status.toUpperCase()}</small><strong>{row.profile?.observed?.dominantColor || "Fabric profile"}</strong><span>{nice(row.profile?.observed?.patternFamily)} · {new Date(row.updated_at||row.created_at).toLocaleString("en-IN")}</span></div>
        <p>{row.profile?.summary || "No summary."}</p>
        <div className="rowActions"><button onClick={()=>void review(row.id,"approved")}>Approve</button><button onClick={()=>void review(row.id,"rejected")}>Reject</button></div>
      </article>)}</div>}
    </section>
    {message&&<button className="analyzerToast" onClick={()=>setMessage("")}>{message}<b>×</b></button>}
  </main>;
}
