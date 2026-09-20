"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AnimatePresence, motion } from "motion/react";
import type { StyleDirectorAnswers, StyleDirectorLook } from "@/lib/style-director-agent";
import { createStyleSessionId, recordStyleMemoryEvent } from "@/lib/browser-style-memory";
import "./style-director.css";

type StepKey = keyof StyleDirectorAnswers;
type RenderSet = { renders?: Array<{ view: string; src: string; label: string; provider?: string }>; providerLabel?: string; status?: string };

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
  { key:"colorDirection", eyebrow:"THE COLOUR INSTINCT", title:"Which direction pulls you in?", note:"We’ll match this against real LLinen Earth stock.", options:[
    {value:"Light",label:"Light",hint:"Creams, soft neutrals",symbol:"□"},{value:"Earthy",label:"Earthy",hint:"Taupe, sand, warm tones",symbol:"◫"},
    {value:"Blue",label:"Blue",hint:"Sky to slate",symbol:"▧"},{value:"Dark",label:"Dark",hint:"Charcoal, black, deep tones",symbol:"■"},
    {value:"Surprise me",label:"Surprise me",hint:"Let the director choose",symbol:"✦"}
  ]},
];

export default function StyleDirectorPage() {
  const [sessionId] = useState(createStyleSessionId);
  const [index,setIndex] = useState(0);
  const [answers,setAnswers] = useState<Partial<StyleDirectorAnswers>>({});
  const [looks,setLooks] = useState<StyleDirectorLook[]>([]);
  const [selected,setSelected] = useState(0);
  const [loading,setLoading] = useState(false);
  const [rendering,setRendering] = useState<"preview"|"photo"|null>(null);
  const [renderSet,setRenderSet] = useState<RenderSet|null>(null);
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
      recordStyleMemoryEvent(sessionId,"looks_generated",{looks:data.looks.map((look:StyleDirectorLook)=>({id:look.id,title:look.title,fabricId:look.fabric.id,fabric:look.fabric.colorName,tier:look.candidate.tier}))});
    } catch(e) {
      setError(e instanceof Error ? e.message : "Could not create looks.");
    } finally { setLoading(false); }
  }

  async function visualize(mode:"preview"|"photo") {
    if (!selectedLook) return;
    setRendering(mode); setError("");
    recordStyleMemoryEvent(sessionId,"render_requested",{mode,lookId:selectedLook.id,fabricId:selectedLook.fabric.id});
    try {
      const endpoint = mode === "photo" ? "/api/visualization/fashn" : "/api/visualization/render";
      const response = await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({brief:selectedLook.brief,version:selectedLook.version})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create the visual.");
      setRenderSet(data.renderSet);
      const front = data.renderSet?.renders?.find((render:{view?:string;src?:string})=>render.view==="front") ?? data.renderSet?.renders?.[0];
      const imageUrl = typeof front?.src === "string" && /^https:\/\/(cdn|media)\.fashn\.ai\//i.test(front.src) ? front.src : undefined;
      recordStyleMemoryEvent(sessionId,"render_completed",{
        mode,
        lookId:selectedLook.id,
        fabricId:selectedLook.fabric.id,
        fabric:selectedLook.fabric.colorName,
        line:selectedLook.fabric.line,
        provider:data.renderSet?.providerLabel || data.renderSet?.provider || "development",
        imageUrl,
        label:front?.label || "Generated visual",
        generatedAt:data.renderSet?.generatedAt || new Date().toISOString(),
      });
    } catch(e) {
      setError(e instanceof Error ? e.message : "Could not create the visual.");
    } finally { setRendering(null); }
  }

  function reset() {
    setIndex(0); setAnswers({}); setLooks([]); setSelected(0); setRenderSet(null); setError("");
  }

  const heroRender = useMemo(()=>renderSet?.renders?.find((r)=>r.view==="front") ?? renderSet?.renders?.[0], [renderSet]);
  useEffect(()=>{
    recordStyleMemoryEvent(sessionId,"session_started",{experience:"style-director-v1"});
  },[sessionId]);

  const whatsapp = selectedLook ? `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919226338282"}?text=${encodeURIComponent(`Hi LLinen Earth, I created “${selectedLook.title}” in the Style Director. Fabric: ${selectedLook.fabric.line} — ${selectedLook.fabric.colorName}. I’d like to explore this look in store.`)}` : "#";

  return <AppShell>
    <main className="director">
      <header className="directorTop">
        <a href="/" className="directorBrand"><span>LE</span><b>LLINEN EARTH</b></a>
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
          <span>Built from your choices + live LLinen Earth fabric stock.</span>
        </div>

        <div className="lookTabs">
          {looks.map((look,i)=><button className={selected===i?"active":""} onClick={()=>{setSelected(i);setRenderSet(null);recordStyleMemoryEvent(sessionId,"look_selected",{lookId:look.id,title:look.title,fabricId:look.fabric.id,fabric:look.fabric.colorName});}} key={look.id}>
            <span>0{i+1}</span><strong>{look.title}</strong><small>{look.fabric.colorName}</small>
          </button>)}
        </div>

        <motion.div key={selectedLook.id} className="lookStage" initial={{opacity:0,x:14}} animate={{opacity:1,x:0}} transition={{duration:.3,ease:[.2,.8,.2,1]}}>
          <div className="lookVisual" style={{"--fabric":selectedLook.fabric.hex} as React.CSSProperties}>
            {heroRender ? <img src={heroRender.src} alt={heroRender.label} /> : <>
              <div className="abstractLook"><i/><i/><i/></div>
              <div className="swatchCard" style={{backgroundImage:`url('${selectedLook.fabric.swatchImageUrl}')`}}><span>REAL STOCK</span></div>
            </>}
            <div className="visualBadge">{heroRender ? (renderSet?.providerLabel || "Rendered look") : "Concept view"}</div>
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
            <div className="whyBlock"><small>WHY THIS WORKS</small>{selectedLook.why.slice(0,2).map((w,i)=><p key={i}><span>0{i+1}</span>{w}</p>)}</div>
            <div className="directorActions">
              <button onClick={()=>visualize("preview")} disabled={Boolean(rendering)}>{rendering==="preview"?"Building…":"See mannequin"} <b>↗</b></button>
              <button className="photoAction" onClick={()=>visualize("photo")} disabled={Boolean(rendering)}>{rendering==="photo"?"Rendering…":"Make photoreal"} <b>✦</b></button>
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
