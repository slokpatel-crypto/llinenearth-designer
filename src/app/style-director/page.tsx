"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AnimatePresence, motion } from "motion/react";
import type { StyleDirectorAnswers, StyleDirectorLook } from "@/lib/style-director-agent";
import { StyleDirectorRealModelPreview } from "@/components/PhotoOutfitPreview";
import { createStyleSessionId, flushPendingStyleMemoryEvents, recordStyleMemoryEvent } from "@/lib/browser-style-memory";
import "./style-director.css";

type StepKey = keyof StyleDirectorAnswers;
type RenderSet = { renders?: Array<{ view: string; src: string; label: string; provider?: string }>; providerLabel?: string; status?: string };
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
  const [answers,setAnswers] = useState<Partial<StyleDirectorAnswers>>({});
  const [looks,setLooks] = useState<StyleDirectorClientLook[]>([]);
  const [selected,setSelected] = useState(0);
  const [loading,setLoading] = useState(false);
  const [rendering,setRendering] = useState(false);
  const [renderSet,setRenderSet] = useState<RenderSet|null>(null);
  const [lockedPreviewImage,setLockedPreviewImage] = useState("");
  const [error,setError] = useState("");
  const step = steps[index];
  const complete = looks.length > 0;
  const selectedLook = looks[selected];
  const progress = complete ? 100 : Math.round((index / steps.length) * 100);

  async function choose(value:string) {
    const next = {...answers,[step.key]:value} as Partial<StyleDirectorAnswers>;
    setAnswers(next);
    setError("");
    recordStyleMemoryEvent(sessionId,"answer_selected",{step:step.key,value});
    if (index < steps.length - 1) {
      setIndex((n)=>n+1);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/style-director",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(next)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create looks.");
      setLooks(data.looks);
      setSelected(0);
      setRenderSet(null);
      setLockedPreviewImage("");
      recordStyleMemoryEvent(sessionId,"looks_generated",{looks:data.looks.map((look:StyleDirectorClientLook)=>({id:look.id,title:look.title,fabricId:look.fabric.id,fabric:look.fabric.colorName,tier:look.candidate.tier}))});
      const firstLook = data.looks?.[0] as StyleDirectorClientLook | undefined;
      if (firstLook) recordStyleMemoryEvent(sessionId,"look_selected",{lookId:firstLook.id,title:firstLook.title,fabricId:firstLook.fabric.id,fabric:firstLook.fabric.colorName,automatic:true});
    } catch(e) {
      setError(e instanceof Error ? e.message : "Could not create looks.");
    } finally { setLoading(false); }
  }

  async function visualizePhotoreal() {
    if (!selectedLook?.realModel) return;
    setRendering(true); setError("");
    recordStyleMemoryEvent(sessionId,"render_requested",{mode:"photo",lookId:selectedLook.id,fabricId:selectedLook.fabric.id});
    try {
      const response = await fetch("/api/designer/look-render",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          shirt:{id:selectedLook.realModel.shirtId},
          pant:{id:selectedLook.realModel.pantId},
          style:selectedLook.realModel.style,
          locked:true,
          lookKey:`style-director:${selectedLook.id}`,
          lockedPreviewImage:lockedPreviewImage || undefined,
        }),
      });
      const data = await response.json() as {result?:{image:string;jobId:string;creditsUsed:number;conceptId:string;generatedAt:string};error?:string};
      if (!response.ok || !data.result) throw new Error(data.error || "Could not create the photoreal visual.");
      const nextRenderSet:RenderSet={
        renders:[{view:"front",src:data.result.image,label:"Photoreal front view",provider:"fashn-edit"}],
        providerLabel:"Linen Earth photoreal refinement",
        status:"generated",
      };
      setRenderSet(nextRenderSet);
      const imageUrl = /^https:\/\/(cdn|media)\.fashn\.ai\//i.test(data.result.image) ? data.result.image : undefined;
      recordStyleMemoryEvent(sessionId,"render_completed",{
        mode:"photo",
        lookId:selectedLook.id,
        fabricId:selectedLook.fabric.id,
        fabric:selectedLook.fabric.colorName,
        line:selectedLook.fabric.line,
        provider:"Linen Earth photoreal refinement",
        imageUrl,
        label:"Photoreal front view",
        generatedAt:data.result.generatedAt,
      });
    } catch(e) {
      setError(e instanceof Error ? e.message : "Could not create the photoreal visual.");
    } finally { setRendering(false); }
  }

  function reset() {
    setIndex(0); setAnswers({}); setLooks([]); setSelected(0); setRenderSet(null); setLockedPreviewImage(""); setError("");
  }

  const heroRender = useMemo(()=>renderSet?.renders?.find((r)=>r.view==="front") ?? renderSet?.renders?.[0], [renderSet]);
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
          {looks.map((look,i)=><button className={selected===i?"active":""} onClick={()=>{setSelected(i);setRenderSet(null);setLockedPreviewImage("");recordStyleMemoryEvent(sessionId,"look_selected",{lookId:look.id,title:look.title,fabricId:look.fabric.id,fabric:look.fabric.colorName});}} key={look.id}>
            <span>{look.candidate.tier.toUpperCase()}</span><strong>{look.title}</strong><small>{look.fabric.colorName}</small>
          </button>)}
        </div>

        <motion.div key={selectedLook.id} className="lookStage" initial={{opacity:0,x:14}} animate={{opacity:1,x:0}} transition={{duration:.3,ease:[.2,.8,.2,1]}}>
          <div className="lookVisual" style={{"--fabric":selectedLook.fabric.hex} as React.CSSProperties}>
            {heroRender ? <img src={heroRender.src} alt={heroRender.label} /> : selectedLook.realModel ? <>
              <StyleDirectorRealModelPreview shirt={selectedLook.realModel.shirtFabric} pant={selectedLook.realModel.pantFabric} style={selectedLook.realModel.style} onPreviewReady={setLockedPreviewImage} />
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
                ? <button className="photoAction" onClick={()=>void visualizePhotoreal()} disabled={rendering || !lockedPreviewImage}>{rendering?"Rendering…":lockedPreviewImage?"Make photoreal":"Preparing real model…"} <b>✦</b></button>
                : <span className="directorPhotoPending">Photoreal unlocks when a photographed garment template supports this category.</span>}
              {designerHandoff && <a href={designerHandoff} onClick={()=>recordStyleMemoryEvent(sessionId,"render_requested",{mode:"real-model-handoff",lookId:selectedLook.id,fabricId:selectedLook.fabric.id})}>Open Linen Earth Real Model Designer <b>↗</b></a>}
              <a href={whatsapp} target="_blank" rel="noreferrer" onClick={()=>recordStyleMemoryEvent(sessionId,"whatsapp_clicked",{lookId:selectedLook.id,fabricId:selectedLook.fabric.id,fabric:selectedLook.fabric.colorName})}>Book this look <b>↗</b></a>
            </div>
            <p className="tradeoff"><b>Director note:</b> {selectedLook.candidate.tradeoff}</p>
          </div>
        </motion.div>
      </motion.section>}
      </AnimatePresence>

      {error && <div className="directorError">{error}<button onClick={()=>setError("")}>×</button></div>}
    </main>
  </AppShell>;
}
