"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CreativeResearchLibrary, CreativeResearchSignal } from "@/lib/designer/creative-research";
import type { FashionResearchSource, FashionResearchTopic } from "@/lib/designer/fashion-research-source-pool";

type Payload={
  configured:boolean;
  library:CreativeResearchLibrary;
  pool:{websites:number;topics:number;targets:number;highAuthorityWebsites:number};
  sources:FashionResearchSource[];
  topics:FashionResearchTopic[];
};

type DiscoveryPayload={
  source:string;
  requested:number;
  discovered:number;
  sources:FashionResearchSource[];
};

const ZONES=["collar","cuff","placket","shirt-body","pocket","waistband","pleat","trouser-leg"] as const;
const SOURCE_TYPES=["museum","designer","runway","tailoring","archive","operator"] as const;
const BUILDABILITY=["supported","atelier","experimental"] as const;
const PATTERN_FAMILIES=["none","stripe","geometric","border","tonal","placement"] as const;
const SCALES=["micro","fine","medium"] as const;

type Draft={
  researchId:string; title:string; sourceUrl:string; sourceType:typeof SOURCE_TYPES[number];
  principle:string; transformedIdea:string; zone:typeof ZONES[number]; secondaryZone:string;
  treatmentLabel:string; treatmentInstruction:string; visualPurpose:string; intensity:number;
  buildability:typeof BUILDABILITY[number]; patternFamily:typeof PATTERN_FAMILIES[number];
  patternName:string; patternLayout:string; patternPlacement:string; patternScale:string; patternCoverage:number;
  active:boolean; note:string;
};

function emptyDraft():Draft {
  return {
    researchId:"research-"+Date.now(),title:"",sourceUrl:"",sourceType:"archive",
    principle:"",transformedIdea:"",zone:"cuff",secondaryZone:"",
    treatmentLabel:"",treatmentInstruction:"",visualPurpose:"",intensity:50,
    buildability:"atelier",patternFamily:"none",patternName:"",patternLayout:"",
    patternPlacement:"",patternScale:"fine",patternCoverage:24,active:true,note:"",
  };
}

function toDraft(signal:CreativeResearchSignal):Draft {
  return {
    researchId:signal.id,title:signal.title,sourceUrl:signal.sourceUrl,sourceType:signal.sourceType,
    principle:signal.principle,transformedIdea:signal.transformedIdea,zone:signal.zone,
    secondaryZone:signal.secondaryZone || "",treatmentLabel:signal.treatmentLabel,
    treatmentInstruction:signal.treatmentInstruction,visualPurpose:signal.visualPurpose,
    intensity:signal.intensity,buildability:signal.buildability,patternFamily:signal.patternFamily,
    patternName:signal.patternName || "",patternLayout:signal.patternLayout || "",
    patternPlacement:signal.patternPlacement || "",patternScale:signal.patternScale || "fine",
    patternCoverage:signal.patternCoverage ?? 24,active:signal.active,note:signal.note || "",
  };
}

export default function DesignerResearchClient(){
  const [data,setData]=useState<Payload|null>(null);
  const [draft,setDraft]=useState<Draft>(emptyDraft);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [sourceSearch,setSourceSearch]=useState("");
  const [discoveredSources,setDiscoveredSources]=useState<FashionResearchSource[]>([]);
  const [discovering,setDiscovering]=useState(false);

  async function load(){
    const response=await fetch("/api/operator/designer-research",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/designer-research";return;}
    const next=await response.json() as Payload&{error?:string};
    if(!response.ok) throw new Error(next.error||"Research library could not be loaded.");
    setData(next);
  }

  useEffect(()=>{void load().catch((error)=>setMessage(error instanceof Error?error.message:"Unable to load research library."));},[]);

  const combinedSources=useMemo(()=>{
    const map=new Map<string,FashionResearchSource>();
    for(const source of [...(data?.sources || []),...discoveredSources]) {
      try {
        const domain=new URL(source.baseUrl).hostname.toLowerCase().replace(/^www\./,"");
        if(!map.has(domain)) map.set(domain,source);
      } catch { /* Ignore malformed external research URLs. */ }
    }
    return [...map.values()];
  },[data,discoveredSources]);

  const filteredSources=useMemo(()=>{
    const q=sourceSearch.trim().toLowerCase();
    return combinedSources.filter((source)=>!q || [source.name,source.baseUrl,source.category,source.authority].some((value)=>value.toLowerCase().includes(q)));
  },[combinedSources,sourceSearch]);

  async function discover1000(){
    setDiscovering(true); setMessage("");
    try{
      const response=await fetch("/api/operator/designer-research/discover?limit=1000",{cache:"no-store"});
      if(response.status===401){window.location.href="/operator/login?next=/operator/designer-research";return;}
      const result=await response.json() as DiscoveryPayload&{error?:string};
      if(!response.ok) throw new Error(result.error||"Website discovery failed.");
      setDiscoveredSources(result.sources||[]);
      setMessage(`Discovered ${result.discovered.toLocaleString("en-IN")} distinct official fashion/textile websites. They are available for research selection below.`);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Website discovery failed.");
    }finally{setDiscovering(false);}
  }

  function useSource(source:FashionResearchSource){
    const sourceType:Draft["sourceType"]=source.category==="museum"?"museum":source.category==="runway"?"runway":source.category==="menswear"?"tailoring":source.category==="academic"||source.category==="university"?"archive":"designer";
    setDraft((current)=>({...current,sourceUrl:source.baseUrl,sourceType,title:current.title || source.name}));
  }

  async function save(){
    if(!data?.configured) {setMessage("Cloud memory must be configured before research signals can be activated.");return;}
    if(!draft.title.trim()||!draft.sourceUrl.trim()||!draft.principle.trim()||!draft.transformedIdea.trim()||!draft.treatmentLabel.trim()||!draft.treatmentInstruction.trim()||!draft.visualPurpose.trim()){
      setMessage("Complete the source, principle, transformed idea and design-move fields.");
      return;
    }
    setSaving(true); setMessage("");
    try{
      const event={
        id:"EV-DESIGNER-RESEARCH-"+crypto.randomUUID(),
        sessionId:"DESIGNER-RESEARCH",
        type:"operator_note",
        at:new Date().toISOString(),
        payload:{
          subtype:"designer_creative_research",
          ...draft,
          createdAt:new Date().toISOString(),
        },
      };
      const response=await fetch("/api/memory/event",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(event)});
      const result=await response.json() as {stored?:boolean;error?:string};
      if(!response.ok||!result.stored) throw new Error(result.error||"Research signal was not stored.");
      await load();
      setDraft(emptyDraft());
      setMessage("Research principle activated. V5 can now mutate it into future concepts.");
    }catch(error){
      setMessage(error instanceof Error?error.message:"Unable to save research signal.");
    }finally{setSaving(false);}
  }

  if(!data) return <main className="designerResearch"><div className="researchLoading">Loading V5 Research Desk…</div></main>;

  return <main className="designerResearch">
    <header className="researchHeader">
      <div><span>LINEN EARTH / V5</span><h1>Creative Research Desk</h1><p>Turn external fashion and fashion-science research into reusable design principles. Sources inspire the engine only after the principle and transformation are explicitly recorded.</p></div>
      <div><b>{data.pool.targets.toLocaleString("en-IN")} TARGETS</b><Link href="/operator/designer-data">Fabric Data</Link><Link href="/operator">Operator Desk</Link></div>
    </header>

    <section className="researchStats">
      <article><span>CURATED WEBSITES</span><strong>{data.pool.websites}</strong><p>High-signal academic, museum, runway and industry domains.</p></article>
      <article><span>RESEARCH TARGETS</span><strong>{data.pool.targets.toLocaleString("en-IN")}</strong><p>Source × topic combinations spanning fashion and fashion science.</p></article>
      <article><span>HIGH AUTHORITY</span><strong>{data.pool.highAuthorityWebsites}</strong><p>Primary or scholarly sources.</p></article>
      <article><span>DISCOVERED NOW</span><strong>{discoveredSources.length || "—"}</strong><p>Distinct official fashion/textile websites from live source discovery.</p></article>
    </section>

    <section className="researchLayout">
      <aside className="researchSources">
        <button className="researchDiscoverButton" type="button" onClick={()=>void discover1000()} disabled={discovering}>{discovering?"Discovering…":"Discover up to 1,000 websites"}</button>
        <div className="researchSourceSearch"><input value={sourceSearch} onChange={(event)=>setSourceSearch(event.target.value)} placeholder="Search research source" /><span>{filteredSources.length}</span></div>
        <div className="researchTopicChips">{data.topics.map((topic)=><span key={topic.id}>{topic.id}</span>)}</div>
        <div className="researchSourceList">{filteredSources.map((source)=><button key={source.id} type="button" onClick={()=>useSource(source)}>
          <strong>{source.name}</strong><span>{source.category} · {source.authority}</span><small>{source.baseUrl}</small>
        </button>)}</div>
      </aside>

      <section className="researchEditor">
        <div className="researchEditorHead"><div><span>RESEARCH → DESIGN TRANSLATOR</span><h2>{draft.title || "New research signal"}</h2></div><button type="button" onClick={()=>setDraft(emptyDraft())}>New signal</button></div>

        <div className="researchForm">
          <label><span>Research title</span><input value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})} placeholder="e.g. Stripe spacing and body perception" /></label>
          <label><span>Source URL</span><input value={draft.sourceUrl} onChange={(e)=>setDraft({...draft,sourceUrl:e.target.value})} placeholder="https://…" /></label>
          <label><span>Source role</span><select value={draft.sourceType} onChange={(e)=>setDraft({...draft,sourceType:e.target.value as Draft["sourceType"]})}>{SOURCE_TYPES.map((item)=><option key={item}>{item}</option>)}</select></label>
          <label><span>Primary zone</span><select value={draft.zone} onChange={(e)=>setDraft({...draft,zone:e.target.value as Draft["zone"]})}>{ZONES.map((item)=><option key={item}>{item}</option>)}</select></label>
          <label><span>Secondary echo zone</span><select value={draft.secondaryZone} onChange={(e)=>setDraft({...draft,secondaryZone:e.target.value})}><option value="">None</option>{ZONES.map((item)=><option key={item}>{item}</option>)}</select></label>
          <label><span>Buildability</span><select value={draft.buildability} onChange={(e)=>setDraft({...draft,buildability:e.target.value as Draft["buildability"]})}>{BUILDABILITY.map((item)=><option key={item}>{item}</option>)}</select></label>

          <label className="wide"><span>What did the source actually teach?</span><textarea value={draft.principle} onChange={(e)=>setDraft({...draft,principle:e.target.value})} placeholder="State the source principle without copying a finished garment." /></label>
          <label className="wide"><span>How should Linen Earth transform it?</span><textarea value={draft.transformedIdea} onChange={(e)=>setDraft({...draft,transformedIdea:e.target.value})} placeholder="Turn the principle into a new design direction rather than a copy." /></label>
          <label><span>Design move name</span><input value={draft.treatmentLabel} onChange={(e)=>setDraft({...draft,treatmentLabel:e.target.value})} placeholder="e.g. Graduated cuff frame" /></label>
          <label className="wide"><span>Design instruction</span><textarea value={draft.treatmentInstruction} onChange={(e)=>setDraft({...draft,treatmentInstruction:e.target.value})} placeholder="Specific geometry, placement or proportion instruction." /></label>
          <label className="wide"><span>Visual purpose</span><textarea value={draft.visualPurpose} onChange={(e)=>setDraft({...draft,visualPurpose:e.target.value})} placeholder="Why this move helps the look." /></label>

          <label><span>Visual intensity · {draft.intensity}</span><input type="range" min="1" max="100" value={draft.intensity} onChange={(e)=>setDraft({...draft,intensity:Number(e.target.value)})} /></label>
          <label><span>Pattern family</span><select value={draft.patternFamily} onChange={(e)=>setDraft({...draft,patternFamily:e.target.value as Draft["patternFamily"]})}>{PATTERN_FAMILIES.map((item)=><option key={item}>{item}</option>)}</select></label>
          {draft.patternFamily!=="none" && <>
            <label><span>Pattern name</span><input value={draft.patternName} onChange={(e)=>setDraft({...draft,patternName:e.target.value})} /></label>
            <label><span>Pattern scale</span><select value={draft.patternScale} onChange={(e)=>setDraft({...draft,patternScale:e.target.value})}>{SCALES.map((item)=><option key={item}>{item}</option>)}</select></label>
            <label><span>Coverage · {draft.patternCoverage}%</span><input type="range" min="0" max="60" value={draft.patternCoverage} onChange={(e)=>setDraft({...draft,patternCoverage:Number(e.target.value)})} /></label>
            <label className="wide"><span>Pattern logic</span><textarea value={draft.patternLayout} onChange={(e)=>setDraft({...draft,patternLayout:e.target.value})} placeholder="Repeat, spacing, interruption or placement logic." /></label>
            <label className="wide"><span>Pattern placement</span><textarea value={draft.patternPlacement} onChange={(e)=>setDraft({...draft,patternPlacement:e.target.value})} placeholder="Where the motif appears and where it must stay quiet." /></label>
          </>}
          <label className="wide"><span>Research note</span><textarea value={draft.note} onChange={(e)=>setDraft({...draft,note:e.target.value})} placeholder="What to verify, sample or compare later." /></label>
          <label className="researchActive"><input type="checkbox" checked={draft.active} onChange={(e)=>setDraft({...draft,active:e.target.checked})} /><span>Allow this reviewed signal to influence V5 now</span></label>
        </div>

        <div className="researchSave"><p>Runway/editorial sources are treated as inspiration. Scientific and primary sources can support physical/design claims, but no single source becomes a permanent rule automatically.</p><button type="button" disabled={saving||!data.configured} onClick={()=>void save()}>{saving?"Saving…":"Save research signal"}</button></div>
        {message && <div className="researchMessage">{message}</div>}

        <section className="researchLibrary">
          <div><span>CURATED LIBRARY</span><strong>{data.library.total} signals · {data.library.active} active</strong></div>
          {data.library.signals.length===0 ? <p>No operator-curated signals yet. Built-in V5 research still runs.</p> : data.library.signals.map((signal)=><button type="button" key={signal.id} onClick={()=>setDraft(toDraft(signal))}>
            <span>{signal.active?"ACTIVE":"PAUSED"} · {signal.sourceType.toUpperCase()}</span><strong>{signal.title}</strong><p>{signal.principle}</p><small>{signal.zone} · {signal.patternFamily}</small>
          </button>)}
        </section>
      </section>
    </section>
  </main>;
}
