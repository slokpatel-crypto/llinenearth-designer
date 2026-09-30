"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { colorFamilies } from "@/lib/vocab/colors";

type AnalyzerProfile={
  summary:string;
  observed:{
    dominantColor:string;
    colorFamily:string|null;
    patternFamily:string;
    patternScale:string;
    patternDensity:string;
    orientation:string;
    sheen:string;
    visualWeight:string;
  };
  inferredStyle?:{
    formality:number;
    statementLevel:number;
  };
  confidence?:{color:number;pattern:number;texture:number;styling:number};
  measured?:{
    colour?:{hex:string;deltaE:number};
    pattern?:{physicalScaleStatus:string;repeatMm:number|null;stripeWidthMm:number|null};
    imageQuality?:{score:number;issues:string[]};
  }|null;
};

type ReviewRow={
  id:string;
  image_source:string;
  review_status:"unreviewed"|"approved"|"corrected"|"rejected";
  review_notes:string;
  profile:AnalyzerProfile;
  created_at:string;
  updated_at:string;
};

type StatsPayload={
  database?:{
    profiles:number;
    pending_review:number;
    approved:number;
    corrected:number;
    rejected:number;
    feedback:number;
  }|null;
};

type TruthState={
  colorFamily:string;
  patternFamily:string;
  patternScale:string;
  patternDensity:string;
  orientation:string;
  sheen:string;
  visualWeight:string;
  formality:string;
  statementLevel:string;
};

const PATTERNS=["solid","stripe","check","dot","botanical","floral","geometric","paisley","abstract","melange","textured","other"] as const;
const SCALES=["none","fine","medium","bold"] as const;
const DENSITIES=["none","sparse","balanced","dense"] as const;
const ORIENTATIONS=["none","vertical","horizontal","grid","all-over","directional","uncertain"] as const;
const SHEENS=["matte","low","medium","high","uncertain"] as const;
const WEIGHTS=["light-looking","medium-looking","heavy-looking","uncertain"] as const;

function toTruth(row:ReviewRow):TruthState {
  return {
    colorFamily:row.profile.observed.colorFamily || "",
    patternFamily:row.profile.observed.patternFamily || "other",
    patternScale:row.profile.observed.patternScale || "medium",
    patternDensity:row.profile.observed.patternDensity || "balanced",
    orientation:row.profile.observed.orientation || "uncertain",
    sheen:row.profile.observed.sheen || "uncertain",
    visualWeight:row.profile.observed.visualWeight || "uncertain",
    formality:String(row.profile.inferredStyle?.formality ?? 3),
    statementLevel:String(row.profile.inferredStyle?.statementLevel ?? 2),
  };
}

function pct(value:number|undefined){return typeof value==="number"?`${Math.round(value*100)}%`:"—";}

export default function FabricGroundTruthClient(){
  const [rows,setRows]=useState<ReviewRow[]>([]);
  const [stats,setStats]=useState<StatsPayload|null>(null);
  const [selectedId,setSelectedId]=useState("");
  const [truth,setTruth]=useState<TruthState|null>(null);
  const [reason,setReason]=useState("");
  const [filter,setFilter]=useState<"unreviewed"|"all">("unreviewed");
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  async function load(preferNext=false){
    setLoading(true);
    try{
      const [queueResponse,statsResponse]=await Promise.all([
        fetch("/api/operator/fabric-analyzer/review?limit=100",{cache:"no-store"}),
        fetch("/api/operator/fabric-analyzer/stats",{cache:"no-store"}),
      ]);
      if(queueResponse.status===401 || statsResponse.status===401){
        window.location.href="/operator/login?next=/operator/fabric-ground-truth";
        return;
      }
      const queue=await queueResponse.json() as {profiles?:ReviewRow[];error?:string};
      const stat=await statsResponse.json() as StatsPayload & {error?:string};
      if(!queueResponse.ok) throw new Error(queue.error||"Ground-truth queue could not be loaded.");
      if(!statsResponse.ok) throw new Error(stat.error||"Analyzer stats could not be loaded.");
      const nextRows=Array.isArray(queue.profiles)?queue.profiles:[];
      setRows(nextRows);setStats(stat);

      const current=nextRows.find((row)=>row.id===selectedId);
      const next=(preferNext
        ? nextRows.find((row)=>row.review_status==="unreviewed" && row.id!==selectedId)
        : current) || nextRows.find((row)=>row.review_status==="unreviewed") || nextRows[0];
      if(next){
        setSelectedId(next.id);
        setTruth(toTruth(next));
        setReason("");
      }
    }catch(error){
      setMessage(error instanceof Error?error.message:"Ground-truth queue could not be loaded.");
    }finally{setLoading(false);}
  }

  useEffect(()=>{void load(false);},[]);

  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return rows.filter((row)=>(filter==="all" || row.review_status==="unreviewed") && (!q || [
      row.profile.summary,row.profile.observed.colorFamily,row.profile.observed.patternFamily,row.id,
    ].some((value)=>String(value||"").toLowerCase().includes(q))));
  },[rows,filter,search]);

  const selected=rows.find((row)=>row.id===selectedId)||null;
  const reviewed=(stats?.database?.approved||0)+(stats?.database?.corrected||0);
  const target=50;

  function selectRow(row:ReviewRow){
    setSelectedId(row.id);setTruth(toTruth(row));setReason("");setMessage("");
  }

  async function submit(mode:"approve"|"correct"){
    if(!selected || !truth || saving) return;
    setSaving(true);setMessage("");
    try{
      const original=toTruth(selected);
      const fields:Array<[keyof TruthState,string]>=[
        ["colorFamily","observed.colorFamily"],
        ["patternFamily","observed.patternFamily"],
        ["patternScale","observed.patternScale"],
        ["patternDensity","observed.patternDensity"],
        ["orientation","observed.orientation"],
        ["sheen","observed.sheen"],
        ["visualWeight","observed.visualWeight"],
        ["formality","inferredStyle.formality"],
        ["statementLevel","inferredStyle.statementLevel"],
      ];
      const corrections=mode==="correct"
        ? fields.filter(([key])=>truth[key]!==original[key]).map(([key,fieldPath])=>({
          fieldPath,
          previousValue:original[key] || null,
          correctedValue:key==="formality"||key==="statementLevel" ? Number(truth[key]) : (truth[key]||null),
          reason:reason || "Operator ground-truth correction.",
        }))
        : [];

      const response=await fetch("/api/operator/fabric-analyzer/review",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          profileId:selected.id,
          status:corrections.length?"corrected":"approved",
          notes:reason || (corrections.length?"Operator supplied ground-truth corrections.":"Operator approved this profile as ground truth."),
          corrections,
        }),
      });
      const result=await response.json() as {ok?:boolean;error?:string;status?:string};
      if(!response.ok || !result.ok) throw new Error(result.error||"Ground-truth review could not be saved.");
      setMessage(corrections.length?`Saved ${corrections.length} ground-truth corrections.`:"Profile approved as ground truth.");
      await load(true);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Ground-truth review could not be saved.");
    }finally{setSaving(false);}
  }

  if(loading && !rows.length) return <main className="fabricTruth"><div className="truthLoading">Loading fabric ground-truth queue…</div></main>;

  return <main className="fabricTruth">
    <header className="truthHeader">
      <div><span>LINEN EARTH / PRIVATE OPERATOR</span><h1>Fabric Ground-Truth Desk</h1><p>Approve or correct Analyzer classifications for real fabrics. These reviewed labels become calibration evidence without inventing physical facts.</p></div>
      <nav><Link href="/operator/fabric-analyzer">Fabric Analyzer</Link><Link href="/operator/designer-evaluation">Designer Evaluation</Link><Link href="/operator">Operator Desk</Link></nav>
    </header>

    <section className="truthProgress">
      <div><small>REVIEWED FABRICS</small><strong>{reviewed}<i>/ {target}</i></strong><p>Suggested minimum ground-truth set before quoting an Analyzer accuracy percentage.</p></div>
      <div className="truthBar"><i style={{width:`${Math.min(100,Math.round(reviewed/target*100))}%`}}/></div>
      <div><small>PENDING REVIEW</small><strong>{stats?.database?.pending_review ?? rows.filter((row)=>row.review_status==="unreviewed").length}</strong></div>
      <div><small>CORRECTIONS</small><strong>{stats?.database?.feedback ?? "—"}</strong></div>
    </section>

    <section className="truthLayout">
      <aside className="truthQueue">
        <div className="truthFilters"><button aria-pressed={filter==="unreviewed"} onClick={()=>setFilter("unreviewed")}>Unreviewed</button><button aria-pressed={filter==="all"} onClick={()=>setFilter("all")}>All profiles</button></div>
        <div className="truthSearch"><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search profile, colour or pattern" /><span>{filtered.length} profiles</span></div>
        <div className="truthRows">{filtered.map((row)=><button key={row.id} className={row.id===selectedId?"active":""} onClick={()=>selectRow(row)}>
          <i style={{background:row.profile.measured?.colour?.hex || row.profile.observed.dominantColor || "#bbb"}}/>
          <span><strong>{row.profile.observed.colorFamily || "Unknown colour"}</strong><small>{row.profile.observed.patternFamily} · {row.profile.observed.patternScale}</small><em>{row.review_status}</em></span>
        </button>)}</div>
      </aside>

      <section className="truthEditor">
        {!selected || !truth ? <div className="truthEmpty">No Analyzer profile selected.</div> : <>
          <div className="truthProfileHead">
            <div><span>PROFILE {selected.id.slice(0,10).toUpperCase()}</span><h2>{selected.profile.observed.colorFamily || "Unclassified fabric"}</h2><p>{selected.profile.summary}</p></div>
            {selected.image_source&&<img src={selected.image_source} alt="Fabric source used by Analyzer" />}
          </div>

          <div className="truthSignals">
            <span><small>STATUS</small><b>{selected.review_status}</b></span>
            <span><small>IMAGE QUALITY</small><b>{selected.profile.measured?.imageQuality?.score ?? "—"}/100</b></span>
            <span><small>COLOUR CONFIDENCE</small><b>{pct(selected.profile.confidence?.color)}</b></span>
            <span><small>PATTERN CONFIDENCE</small><b>{pct(selected.profile.confidence?.pattern)}</b></span>
            <span><small>PHYSICAL SCALE</small><b>{selected.profile.measured?.pattern?.physicalScaleStatus || "unknown"}</b></span>
          </div>

          <div className="truthForm">
            <label><span>Colour family</span><select value={truth.colorFamily} onChange={(e)=>setTruth({...truth,colorFamily:e.target.value})}><option value="">Unknown</option>{colorFamilies.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label><span>Pattern family</span><select value={truth.patternFamily} onChange={(e)=>setTruth({...truth,patternFamily:e.target.value})}>{PATTERNS.map((item)=><option key={item}>{item}</option>)}</select></label>
            <label><span>Pattern scale</span><select value={truth.patternScale} onChange={(e)=>setTruth({...truth,patternScale:e.target.value})}>{SCALES.map((item)=><option key={item}>{item}</option>)}</select></label>
            <label><span>Pattern density</span><select value={truth.patternDensity} onChange={(e)=>setTruth({...truth,patternDensity:e.target.value})}>{DENSITIES.map((item)=><option key={item}>{item}</option>)}</select></label>
            <label><span>Orientation</span><select value={truth.orientation} onChange={(e)=>setTruth({...truth,orientation:e.target.value})}>{ORIENTATIONS.map((item)=><option key={item}>{item}</option>)}</select></label>
            <label><span>Sheen</span><select value={truth.sheen} onChange={(e)=>setTruth({...truth,sheen:e.target.value})}>{SHEENS.map((item)=><option key={item}>{item}</option>)}</select></label>
            <label><span>Visual weight</span><select value={truth.visualWeight} onChange={(e)=>setTruth({...truth,visualWeight:e.target.value})}>{WEIGHTS.map((item)=><option key={item}>{item}</option>)}</select></label>
            <label><span>Formality · 1–5</span><select value={truth.formality} onChange={(e)=>setTruth({...truth,formality:e.target.value})}>{[1,2,3,4,5].map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
            <label><span>Statement level · 1–5</span><select value={truth.statementLevel} onChange={(e)=>setTruth({...truth,statementLevel:e.target.value})}>{[1,2,3,4,5].map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
            <label className="wide"><span>Correction / approval note</span><textarea value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Why are you correcting this field, or why is the Analyzer output acceptable?" /></label>
          </div>

          <div className="truthGuardrail">
            <p><b>Physical facts stay separate.</b> This screen cannot invent GSM, fibre content, drape or millimetre scale. Those still require supplier/owner evidence in Fabric Analyzer / Designer Data.</p>
            <div><button onClick={()=>void submit("approve")} disabled={saving}>{saving?"Saving…":"Approve as shown"}</button><button className="correct" onClick={()=>void submit("correct")} disabled={saving}>{saving?"Saving…":"Save corrections + approve"}</button></div>
          </div>
        </>}
      </section>
    </section>

    {message&&<button className="truthToast" onClick={()=>setMessage("")}>{message}<b>×</b></button>}
  </main>;
}
