"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AnimatePresence, motion } from "motion/react";
import type { StyleDirectorAnswers, StyleDirectorLook } from "@/lib/style-director-agent";
import { StyleDirectorRealModelPreview } from "@/components/PhotoOutfitPreview";
import { createStyleSessionId, flushPendingStyleMemoryEvents, recordStyleMemoryEvent } from "@/lib/browser-style-memory";
import { customerPhotoCalibrationIdentity, fetchCustomerPhotoCalibration } from "@/lib/designer/photo-calibration-client";
import { createPreviewRequestScope } from "@/lib/designer/preview-request-scope";
import { selectedLookQaPassed } from "@/lib/designer/selected-look-qa";
import "./style-director.css";

type StepKey = keyof StyleDirectorAnswers;
type RenderSet = { renders?: Array<{ view: string; src: string; label: string; provider?: string }>; providerLabel?: string; status?: string };
type PhotorealResult = {image:string;jobId:string;generatedAt:string};
type PhotorealQaStatus = "checking"|"review"|"unavailable";
type StyleDirectorClientLook = StyleDirectorLook & {handoffToken?:string|null};

const steps: Array<{ key: StepKey; eyebrow: string; title: string; note: string; options: Array<{ value: string; label: string; hint: string; symbol: string }> }> = [
  { key:"occasion", eyebrow:"THE MOMENT", title:"Where are you going?", note:"Don’t think about clothes yet. Start with the moment.", options:[
    {value:"Wedding",label:"Wedding",hint:"Guest, family or reception",symbol:"✦"},{value:"Work",label:"Work",hint:"Office, meeting or event",symbol:"▦"},
    {value:"Date",label:"Date",hint:"Dinner or city evening",symbol:"◐"},{value:"Celebration",label:"Celebration",hint:"Festive or social",symbol:"✺"},
    {value:"Travel",label:"Travel",hint:"Resort, holiday or escape",symbol:"⌁"},{value:"Everyday",label:"Everyday",hint:"Smart casual, upgraded",symbol:"○"}
  ]},
  { key:"mood", eyebrow:"THE ENERGY", title:"How should you feel in it?", note:"Pick the feeling, not a fashion word.", options:[
    {value:"Quiet",label:"Quiet",hint:"Understated. Expensive.",symbol:"—"},{value:"Sharp",label:"Sharp",hint:"Clean. Confident.",symbol:"↗"},
    {value:"Relaxed",label:"Relaxed",hint:"Easy. Natural.",symbol:"≈"},{value:"Statement",label:"Statement",hint:"Memorable. Directional.",symbol:"◆"}
  ]},
  { key:"time", eyebrow:"THE LIGHT", title:"When does the outfit live?", note:"Light changes how colour and texture read.", options:[
    {value:"Day",label:"Day",hint:"Natural light",symbol:"☼"},{value:"Evening",label:"Evening",hint:"Artificial / low light",symbol:"◑"}
  ]},
  { key:"climate", eyebrow:"THE REAL WORLD", title:"What will the environment feel like?", note:"Comfort is part of good design.", options:[
    {value:"Hot",label:"Hot / Outdoor",hint:"Breathability matters",symbol:"☀"},{value:"Indoor",label:"Indoor / AC",hint:"Structure can work",symbol:"▣"},
    {value:"Mixed",label:"Mixed",hint:"Moving between both",symbol:"↔"}
  ]},
  { key:"garment", eyebrow:"THE HERO", title:"What should lead the look?", note:"We’ll build the rest around the hero piece.", options:[
    {value:"shirt",label:"Shirt",hint:"Fabric close to the face",symbol:"♙"},{value:"trouser",label:"Trouser",hint:"Shape and proportion",symbol:"Ⅱ"},
    {value:"suit",label:"Suit",hint:"One complete statement",symbol:"♜"},{value:"blazer",label:"Blazer",hint:"Layered tailoring",symbol:"▰"}
  ]},
  { key:"colorDirection", eyebrow:"THE COLOUR INSTINCT", title:"Which direction pulls you in?", note:"We’ll match this against real Linen Earth stock.", options:[
    {value:"Light",label:"Light",hint:"Creams, soft neutrals",symbol:"□"},{value:"Earthy",label:"Earthy",hint:"Taupe, sand, warm tones",symbol:"◫"},
    {value:"Blue",label:"Blue",hint:"Sky to slate",symbol:"▧"},{value:"Dark",label:"Dark",hint:"Charcoal, black, deep tones",symbol:"■"},
    {value:"Surprise me",label:"Surprise me",hint:"Let the director choose",symbol:"✦"}
  ]},
];

export default function StyleDirectorPage() {
  const [sessionId] = useState(createStyleSessionId);
  const [index,setIndex] = useState(0);
  const [journeyEpoch,setJourneyEpoch] = useState(0);
  const [answers,setAnswers] = useState<Partial<StyleDirectorAnswers>>({});
  const [looks,setLooks] = useState<StyleDirectorClientLook[]>([]);
  const [selected,setSelected] = useState(0);
  const [loading,setLoading] = useState(false);
  const [rendering,setRendering] = useState(false);
  const [renderSet,setRenderSet] = useState<RenderSet|null>(null);
  const [photoreal,setPhotoreal] = useState<PhotorealResult|null>(null);
  const [photorealQaStatus,setPhotorealQaStatus] = useState<PhotorealQaStatus|null>(null);
  const [lockedPreviewImage,setLockedPreviewImage] = useState("");
  const [lockedPreviewCalibrationIdentity,setLockedPreviewCalibrationIdentity] = useState("");
  const [renderCalibrationIdentity,setRenderCalibrationIdentity] = useState<string|null>(null);
  const [currentCalibrationIdentity,setCurrentCalibrationIdentity] = useState<string|null>(null);
  const [error,setError] = useState("");
  const step = steps[index];
  const complete = looks.length > 0;
  const selectedLook = looks[selected];
  const progress = complete ? 100 : Math.round((index / steps.length) * 100);
  const journeyScope = useMemo(()=>createPreviewRequestScope(),[index,journeyEpoch]);
  const renderScope = useMemo(()=>createPreviewRequestScope(),[selectedLook,currentCalibrationIdentity,journeyEpoch]);

  useLayoutEffect(()=>{
    journeyScope.activate();
    setLoading(false);
    return ()=>journeyScope.invalidate();
  },[journeyScope]);

  useLayoutEffect(()=>{
    renderScope.activate();
    setRendering(false);
    // Look/calibration changes invalidate the old request before paint, even
    // if the server continues rendering after the browser cancels its fetch.
    return ()=>renderScope.invalidate();
  },[renderScope]);

  async function choose(value:string) {
    const request=journeyScope.begin();
    if(!request) return;
    const next = {...answers,[step.key]:value} as Partial<StyleDirectorAnswers>;
    setAnswers(next);
    setError("");
    recordStyleMemoryEvent(sessionId,"answer_selected",{step:step.key,value});
    if (index < steps.length - 1) {
      // Keep this question locked until the next committed question owns it.
      setIndex(index+1);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/style-director",{method:"POST",signal:request.signal,headers:{"content-type":"application/json"},body:JSON.stringify(next)});
      if(!request.isCurrent()) return;
      const data = await response.json();
      if(!request.isCurrent()) return;
      if (!response.ok) throw new Error(data.error || "Could not create looks.");
      setLooks(data.looks);
      setSelected(0);
      setRenderSet(null);
      setPhotoreal(null); setPhotorealQaStatus(null);
      setRenderCalibrationIdentity(null);
      setLockedPreviewImage("");
      setLockedPreviewCalibrationIdentity("");
      recordStyleMemoryEvent(sessionId,"looks_generated",{looks:data.looks.map((look:StyleDirectorClientLook)=>({id:look.id,title:look.title,fabricId:look.fabric.id,fabric:look.fabric.colorName,tier:look.candidate.tier}))});
      const firstLook = data.looks?.[0] as StyleDirectorClientLook | undefined;
      if (firstLook) recordStyleMemoryEvent(sessionId,"look_selected",{lookId:firstLook.id,title:firstLook.title,fabricId:firstLook.fabric.id,fabric:firstLook.fabric.colorName,automatic:true});
    } catch(e) {
      if(request.isCurrent()) setError(e instanceof Error ? e.message : "Could not create looks.");
    } finally {
      if(request.isCurrent()) setLoading(false);
      request.finish();
    }
  }

  async function visualizePhotoreal() {
    if (!selectedLook?.realModel || renderSet || !lockedPreviewImage || !lockedPreviewCalibrationIdentity || lockedPreviewCalibrationIdentity!==currentCalibrationIdentity) return;
    const request=renderScope.begin();
    if(!request) return;
    const sourceCalibrationIdentity=lockedPreviewCalibrationIdentity;
    const lockedLook={shirt:{id:selectedLook.realModel.shirtId},pant:{id:selectedLook.realModel.pantId},style:selectedLook.realModel.style,locked:true};
    let result=renderCalibrationIdentity===sourceCalibrationIdentity ? photoreal : null;
    setRendering(true); setError("");
    try {
      if(!result) {
        recordStyleMemoryEvent(sessionId,"render_requested",{mode:"photo",lookId:selectedLook.id,fabricId:selectedLook.fabric.id});
        const response = await fetch("/api/designer/look-render",{
          method:"POST",
          signal:request.signal,
          headers:{"content-type":"application/json"},
          body:JSON.stringify({
            ...lockedLook,
            lookKey:`style-director:${selectedLook.id}`,
            lockedPreviewImage:lockedPreviewImage || undefined,
          }),
        });
        if(!request.isCurrent()) return;
        const data = await response.json() as {result?:PhotorealResult;error?:string};
        if(!request.isCurrent()) return;
        if (!response.ok || !data.result?.image || !data.result.jobId) throw new Error(data.error || "Could not create the photoreal visual.");
        result=data.result;
        // Keep the generated result for QA retries without another paid render.
        // It cannot become the hero or completed memory until inspection passes.
        setPhotoreal(result);
        setRenderCalibrationIdentity(sourceCalibrationIdentity);
      }
      setPhotorealQaStatus("checking");
      const inspection=await fetch("/api/designer/look-inspect",{
        method:"POST",signal:request.signal,headers:{"content-type":"application/json"},
        body:JSON.stringify({image:result.image,jobId:result.jobId,view:"front",look:lockedLook}),
      });
      if(!request.isCurrent()) return;
      const inspected=await inspection.json() as {check?:{available?:boolean}};
      if(!request.isCurrent()) return;
      if(!inspection.ok || !selectedLookQaPassed(inspected.check)) {
        setPhotorealQaStatus(inspection.ok && inspected.check?.available===true ? "review" : "unavailable");
        return;
      }
      const nextRenderSet:RenderSet={
        renders:[{view:"front",src:result.image,label:"Photoreal front view",provider:"fashn-edit"}],
        providerLabel:"Linen Earth photoreal refinement",
        status:"qa-passed",
      };
      setRenderSet(nextRenderSet);
      setPhotorealQaStatus(null);
      setRenderCalibrationIdentity(sourceCalibrationIdentity);
      const imageUrl = /^https:\/\/(cdn|media)\.fashn\.ai\//i.test(result.image) ? result.image : undefined;
      recordStyleMemoryEvent(sessionId,"render_completed",{
        mode:"photo",
        lookId:selectedLook.id,
        fabricId:selectedLook.fabric.id,
        fabric:selectedLook.fabric.colorName,
        line:selectedLook.fabric.line,
        provider:"Linen Earth photoreal refinement",
        imageUrl,
        label:"Photoreal front view",
        generatedAt:result.generatedAt,
      });
    } catch(e) {
      if(request.isCurrent()) {
        if(result) setPhotorealQaStatus("unavailable");
        else setError(e instanceof Error ? e.message : "Could not create the photoreal visual.");
      }
    } finally {
      if(request.isCurrent()) setRendering(false);
      request.finish();
    }
  }

  function reset() {
    journeyScope.invalidate(); renderScope.invalidate();
    setJourneyEpoch((epoch)=>epoch+1);
    setIndex(0); setAnswers({}); setLooks([]); setSelected(0);
    setLoading(false); setRendering(false);
    setRenderSet(null); setRenderCalibrationIdentity(null);
    setPhotoreal(null); setPhotorealQaStatus(null);
    setLockedPreviewImage(""); setLockedPreviewCalibrationIdentity("");
    setError("");
  }

  function acceptLockedPreview(dataUrl:string,calibrationIdentity:string) {
    if(!renderScope.isEnabled() || !selectedLook?.realModel) return;
    if(currentCalibrationIdentity && calibrationIdentity!==currentCalibrationIdentity) return;
    setLockedPreviewImage(dataUrl);
    setLockedPreviewCalibrationIdentity(calibrationIdentity);
    setCurrentCalibrationIdentity(calibrationIdentity);
  }

  function selectLook(i:number) {
    if(!renderScope.isEnabled() || i===selected) return;
    const look=looks[i];
    renderScope.invalidate();
    setSelected(i); setRendering(false); setError("");
    setRenderSet(null); setRenderCalibrationIdentity(null);
    setPhotoreal(null); setPhotorealQaStatus(null);
    setLockedPreviewImage(""); setLockedPreviewCalibrationIdentity("");
    recordStyleMemoryEvent(sessionId,"look_selected",{lookId:look.id,title:look.title,fabricId:look.fabric.id,fabric:look.fabric.colorName});
  }

  const heroRender = useMemo(()=>renderCalibrationIdentity===currentCalibrationIdentity ? renderSet?.renders?.find((r)=>r.view==="front") ?? renderSet?.renders?.[0] : undefined, [renderSet,renderCalibrationIdentity,currentCalibrationIdentity]);

  useEffect(()=>{
    let cancelled=false;
    const refresh=()=>void fetchCustomerPhotoCalibration().then((value)=>{
      if(!cancelled) setCurrentCalibrationIdentity(customerPhotoCalibrationIdentity(value));
    });
    const onVisibility=()=>{if(document.visibilityState==="visible") refresh();};
    refresh();
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",onVisibility);
    return ()=>{
      cancelled=true;
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[]);

  useEffect(()=>{
    if(!currentCalibrationIdentity) return;
    if((renderSet || photoreal) && renderCalibrationIdentity && renderCalibrationIdentity!==currentCalibrationIdentity) {
      setRenderSet(null);
      setPhotoreal(null); setPhotorealQaStatus(null);
      setRenderCalibrationIdentity(null);
      setLockedPreviewImage("");
      setLockedPreviewCalibrationIdentity("");
      return;
    }
    if(lockedPreviewImage && lockedPreviewCalibrationIdentity && lockedPreviewCalibrationIdentity!==currentCalibrationIdentity) {
      setLockedPreviewImage("");
      setLockedPreviewCalibrationIdentity("");
    }
  },[currentCalibrationIdentity,renderSet,photoreal,renderCalibrationIdentity,lockedPreviewImage,lockedPreviewCalibrationIdentity]);

  useEffect(()=>{
    recordStyleMemoryEvent(sessionId,"session_started",{experience:"style-director-v1"});

    const flush = () => void flushPendingStyleMemoryEvents();
    const visibility = () => {
      if (document.visibilityState === "visible") flush();
    };

    flush();
    window.addEventListener("online",flush);
    document.addEventListener("visibilitychange",visibility);
    return () => {
      window.removeEventListener("online",flush);
      document.removeEventListener("visibilitychange",visibility);
    };
  },[sessionId]);

  const whatsapp = selectedLook ? `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919226338282"}?text=${encodeURIComponent(`Hi Linen Earth, I created “${selectedLook.title}” in the Style Director. Fabric: ${selectedLook.fabric.line} — ${selectedLook.fabric.colorName}. I’d like to explore this look in store.`)}` : "#";

  const designerHandoff = selectedLook?.realModel
    ? (() => {
        const params = new URLSearchParams({
          shirt:selectedLook.realModel.shirtId,
          pant:selectedLook.realModel.pantId,
          occasion:selectedLook.realModel.occasion,
          climate:selectedLook.realModel.climate,
          intention:selectedLook.realModel.intention,
          style:JSON.stringify(selectedLook.realModel.style),
          sourceLook:selectedLook.id,
          sourceTitle:selectedLook.title,
          sourceTier:selectedLook.candidate.tier,
          sourceReason:selectedLook.realModel.reason,
          from:"style-director",
          ...(selectedLook.handoffToken?{handoffToken:selectedLook.handoffToken}:{}),
        });
        return `/designer-studio?${params.toString()}#designerPhotoTitle`;
      })()
    : null;

  return <AppShell>
    <main className="director">
      <header className="directorTop">
        <a href="/" className="directorBrand"><span>LE</span><b>LINEN EARTH</b></a>
        <div className="directorMode"><i/> STYLE DIRECTOR / LIVE</div>
        <button onClick={reset}>Start over ↺</button>
      </header>

      <div className="directorProgress"><span style={{width:`${progress}%`}} /></div>

      <AnimatePresence mode="wait" initial={false}>
      {!complete && <motion.section key={step.key} className="directorJourney" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:.32,ease:[.2,.8,.2,1]}}>
        <div className="directorIntro">
          <p>{step.eyebrow} · {String(index+1).padStart(2,"0")}/{String(steps.length).padStart(2,"0")}</p>
          <h1>{index===0 ? <>No forms.<br/><em>Just instinct.</em></> : step.title}</h1>
          {index===0 && <h2>{step.title}</h2>}
          <span>{step.note}</span>
        </div>

        <div className="directorOptions">
          {step.options.map((option)=>(
            <motion.button key={option.value} onClick={()=>choose(option.value)} disabled={loading} className="directorOption" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} whileHover={{y:-5}} whileTap={{scale:.985}} transition={{duration:.24}}>
              <i>{option.symbol}</i>
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
              <b>↗</b>
            </motion.button>
          ))}
        </div>

        <aside className="directorMemory">
          <span>YOUR STORY SO FAR</span>
          <div>{Object.entries(answers).map(([key,value])=><p key={key}><small>{key}</small><b>{String(value)}</b></p>)}</div>
        </aside>
        {loading && <div className="directorLoading"><i/><span>Reading the moment, cloth and proportion…</span></div>}
      </motion.section>}

      {complete && selectedLook && <motion.section key="results" className="directorResults" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:.4,ease:[.2,.8,.2,1]}}>
        <div className="resultHeader">
          <div><p>YOUR THREE DIRECTIONS</p><h1>Not recommendations.<br/><em>Three different versions of you.</em></h1></div>
          <span>Built from your choices + current Linen Earth cloth, with verified ledger availability enforced where recorded.</span>
        </div>

        <div className="lookTabs">
          {looks.map((look,i)=><button className={selected===i?"active":""} onClick={()=>selectLook(i)} key={look.id}>
            <span>{look.candidate.tier.toUpperCase()}</span><strong>{look.title}</strong><small>{look.fabric.colorName}</small>
          </button>)}
        </div>

        <motion.div key={selectedLook.id} className="lookStage" initial={{opacity:0,x:14}} animate={{opacity:1,x:0}} transition={{duration:.3,ease:[.2,.8,.2,1]}}>
          <div className="lookVisual" style={{"--fabric":selectedLook.fabric.hex} as React.CSSProperties}>
            {heroRender ? <img src={heroRender.src} alt={heroRender.label} /> : selectedLook.realModel ? <>
              <StyleDirectorRealModelPreview shirt={selectedLook.realModel.shirtFabric} pant={selectedLook.realModel.pantFabric} style={selectedLook.realModel.style} onPreviewReady={acceptLockedPreview} />
              <div className="swatchCard" style={{backgroundImage:`url('${selectedLook.fabric.swatchImageUrl}')`}}><span>REAL STOCK</span></div>
            </> : <div className="directorFabricFallback" style={{backgroundImage:`linear-gradient(180deg,rgba(8,24,39,.06),rgba(8,24,39,.76)),url('${selectedLook.fabric.swatchImageUrl}')`}}>
              <div>
                <span>REAL STOCK / PHOTO TEMPLATE PENDING</span>
                <strong>{selectedLook.fabric.colorName}</strong>
                <small>Fabric is real. Garment geometry stays unvisualized until a photographed template supports this category.</small>
              </div>
            </div>}
            <div className="visualBadge">{heroRender ? (renderSet?.providerLabel || "Rendered look") : selectedLook.realModel ? "Existing real model · live outfit" : "Real fabric · no simulated mannequin"}</div>
          </div>

          <div className="lookCopy">
            <p className="lookEyebrow">{selectedLook.candidate.tier} DIRECTION</p>
            <h2>{selectedLook.candidate.name}</h2>
            <h3>{selectedLook.strapline}</h3>
            <div className="fabricIdentity"><span style={{background:selectedLook.fabric.hex}}/><div><small>FABRIC</small><b>{selectedLook.fabric.line}</b><em>{selectedLook.fabric.colorName} · {selectedLook.fabric.pattern}</em></div></div>
            <div className="garmentGrid">
              <p><small>SHIRT</small><b>{selectedLook.candidate.garments.shirt}</b></p>
              <p><small>TROUSER</small><b>{selectedLook.candidate.garments.trouser}</b></p>
              <p><small>LAYER</small><b>{selectedLook.candidate.garments.layer}</b></p>
              <p><small>FOOTWEAR</small><b>{selectedLook.candidate.garments.footwear}</b></p>
            </div>
            <div className="whyBlock"><small>WHY THIS WORKS</small>{selectedLook.why.slice(0,2).map((w,i)=><p key={i}><span>•</span>{w}</p>)}</div>
            {selectedLook.realModel && <div className="directorRealModelSpec">
              <span>REAL MODEL OUTFIT</span>
              <strong>{selectedLook.realModel.shirtName} shirt + {selectedLook.realModel.pantName} trousers</strong>
              <p>{selectedLook.realModel.style.shirtWear} · {selectedLook.realModel.style.trouser} · {selectedLook.realModel.style.collar}</p>
            </div>}
            <div className="directorActions">
              {selectedLook.realModel
                ? <button className="photoAction" onClick={()=>void visualizePhotoreal()} disabled={rendering || !!heroRender || !lockedPreviewImage || lockedPreviewCalibrationIdentity!==currentCalibrationIdentity}>{rendering?(photorealQaStatus==="checking"?"Checking photoreal…":"Rendering…"):heroRender?"Photoreal ready":photoreal?"Retry photoreal check":lockedPreviewImage?"Make photoreal":"Preparing real model…"} <b>✦</b></button>
                : <span className="directorPhotoPending">Photoreal unlocks when a photographed garment template supports this category.</span>}
              {designerHandoff && <a href={designerHandoff} onClick={()=>recordStyleMemoryEvent(sessionId,"render_requested",{mode:"real-model-handoff",lookId:selectedLook.id,fabricId:selectedLook.fabric.id})}>Open Linen Earth Real Model Designer <b>↗</b></a>}
              <a href={whatsapp} target="_blank" rel="noreferrer" onClick={()=>recordStyleMemoryEvent(sessionId,"whatsapp_clicked",{lookId:selectedLook.id,fabricId:selectedLook.fabric.id,fabric:selectedLook.fabric.colorName})}>Book this look <b>↗</b></a>
            </div>
            {photorealQaStatus && <p className="directorQaStatus" role="status">{photorealQaStatus==="checking"
              ? "Checking fabric, construction and model fidelity before showing this image."
              : photorealQaStatus==="review"
                ? "Photoreal needs review. Your live outfit stays visible; retry checks the same generated image."
                : "Photoreal checks are unavailable. Your live outfit stays visible; retry checks the same generated image."}</p>}
            <p className="tradeoff"><b>Director note:</b> {selectedLook.candidate.tradeoff}</p>
          </div>
        </motion.div>
      </motion.section>}
      </AnimatePresence>

      {error && <div className="directorError">{error}<button onClick={()=>setError("")}>×</button></div>}
    </main>
  </AppShell>;
}
