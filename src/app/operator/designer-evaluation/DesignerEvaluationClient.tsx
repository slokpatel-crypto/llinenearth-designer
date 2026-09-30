"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type Candidate={
  id:string;
  tier:string;
  shirt:{id:string;name:string;line:string;image:string;patternType:string};
  pant:{id:string;name:string;line:string;image:string;patternType:string};
  style:{collar:string;cuff:string;shirtFit:string;shirtWear:string;trouser:string;rise:string;waistband:string;break:string};
  decision:{overall:number;certainty:number;risk:string};
  recommendation:{status:string;confidenceScore:number;ruleSetVersion:string};
  reasons:string[];
  tradeoffs:string[];
};

type Payload={
  configured:boolean;
  version:string;
  totalCases:number;
  labeledCases:number;
  index:number;
  benchmark:{
    id:string;
    index:number;
    occasion:string;
    climate:string;
    intention:string;
    anchorShirtId:string;
    anchorPantId:string;
  };
  currentLabel:{caseId:string;choice:"0"|"1"|"2"|"none";reason:string;at:string}|null;
  candidates:Candidate[];
};

const REASONS=[
  ["best_balance","Best overall balance"],
  ["color","Colour relationship"],
  ["pattern","Pattern relationship"],
  ["formality","Formality match"],
  ["fit_cut","Fit / cut direction"],
  ["originality","Originality"],
  ["too_safe","Others feel too safe"],
  ["too_bold","Others feel too bold"],
  ["none_work","None of the three work"],
  ["other","Other"],
] as const;

export default function DesignerEvaluationClient(){
  const [data,setData]=useState<Payload|null>(null);
  const [index,setIndex]=useState(0);
  const [choice,setChoice]=useState<"0"|"1"|"2"|"none"|null>(null);
  const [reason,setReason]=useState("best_balance");
  const [note,setNote]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  async function load(target=index){
    setLoading(true);setMessage("");
    try{
      const response=await fetch(`/api/operator/designer-evaluation?case=${target}`,{cache:"no-store"});
      if(response.status===401){window.location.href="/operator/login?next=/operator/designer-evaluation";return;}
      const next=await response.json() as Payload & {error?:string};
      if(!response.ok) throw new Error(next.error||"Benchmark case could not be loaded.");
      setData(next);setIndex(next.index);
      setChoice(next.currentLabel?.choice ?? null);
      setReason(next.currentLabel?.reason || "best_balance");
      setNote("");
    }catch(error){
      setMessage(error instanceof Error?error.message:"Benchmark case could not be loaded.");
    }finally{setLoading(false);}
  }

  useEffect(()=>{void load(0);},[]);

  async function save(){
    if(!data || !choice || saving || !data.configured) return;
    setSaving(true);setMessage("");
    try{
      const payload={
        subtype:"designer_benchmark_label",
        version:data.version,
        caseId:data.benchmark.id,
        choice,
        reason:choice==="none" && reason==="best_balance" ? "none_work" : reason,
        occasion:data.benchmark.occasion,
        climate:data.benchmark.climate,
        intention:data.benchmark.intention,
        anchorShirtId:data.benchmark.anchorShirtId,
        anchorPantId:data.benchmark.anchorPantId,
        candidates:data.candidates.map((candidate)=>({
          id:candidate.id,
          tier:candidate.tier,
          shirtId:candidate.shirt.id,
          pantId:candidate.pant.id,
        })),
        engineRuleSetVersion:data.candidates[0]?.recommendation.ruleSetVersion || "",
        note,
      };
      const response=await fetch("/api/memory/event",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          id:`EV-BENCH-${crypto.randomUUID()}`,
          sessionId:"DESIGNER-BENCHMARK",
          type:"operator_note",
          at:new Date().toISOString(),
          payload,
        }),
      });
      const result=await response.json() as {stored?:boolean;error?:string};
      if(!response.ok || !result.stored) throw new Error(result.error||"Benchmark label was not stored.");
      setMessage("Benchmark label saved.");
      const nextIndex=data.totalCases ? (data.index+1)%data.totalCases : data.index;
      await load(nextIndex);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Benchmark label could not be saved.");
    }finally{setSaving(false);}
  }

  if(loading && !data) return <main className="designerEval"><div className="evalLoading">Preparing Designer benchmark…</div></main>;
  if(!data) return <main className="designerEval"><div className="evalLoading">{message||"Benchmark unavailable."}</div></main>;

  return <main className="designerEval">
    <header className="evalHeader">
      <div><span>LINEN EARTH / PRIVATE OPERATOR</span><h1>Designer Evaluation Desk</h1><p>Build the owner-labelled ground-truth set before changing Designer weights. Labels stay evidence, not automatic self-training.</p></div>
      <nav><b className={data.configured?"live":"offline"}>{data.configured?"CLOUD MEMORY LIVE":"CLOUD NOT CONFIGURED"}</b><Link href="/operator/designer-data">Designer Data</Link><Link href="/operator">Operator Desk</Link></nav>
    </header>

    <section className="evalProgress">
      <div><small>GROUND-TRUTH TARGET</small><strong>{data.labeledCases}<i>/ {data.totalCases}</i></strong><p>Current benchmark version: {data.version}</p></div>
      <div className="evalProgressBar"><i style={{width:`${data.totalCases?Math.round(data.labeledCases/data.totalCases*100):0}%`}}/></div>
      <div><small>CASE</small><strong>{String(data.index+1).padStart(2,"0")}<i>/ {data.totalCases}</i></strong></div>
    </section>

    <section className="evalCase">
      <div className="evalCaseHead">
        <div><span>{data.benchmark.id.toUpperCase()}</span><h2>{data.benchmark.occasion}</h2></div>
        <div className="evalContext"><b>{data.benchmark.climate}</b><b>{data.benchmark.intention}</b></div>
        <div className="evalNav"><button disabled={loading||data.index<=0} onClick={()=>void load(Math.max(0,data.index-1))}>← Previous</button><button disabled={loading||data.index>=data.totalCases-1} onClick={()=>void load(Math.min(data.totalCases-1,data.index+1))}>Next →</button></div>
      </div>
      <p className="evalInstruction">Choose the direction you would actually show a customer for this context. Judge the complete shirt + trouser + cut direction, not the algorithm score.</p>
      {data.currentLabel&&<div className="evalExisting">Previously labelled {data.currentLabel.choice==="none"?"none of the three":`option ${Number(data.currentLabel.choice)+1}`} · {new Date(data.currentLabel.at).toLocaleString("en-IN")}. Saving again replaces the benchmark label used for this case.</div>}

      <div className="evalCandidates">
        {data.candidates.map((candidate,candidateIndex)=><article key={candidate.id} data-selected={choice===String(candidateIndex)}>
          <button className="evalPick" onClick={()=>setChoice(String(candidateIndex) as "0"|"1"|"2")} aria-pressed={choice===String(candidateIndex)}>
            <span>{choice===String(candidateIndex)?"SELECTED":"CHOOSE"}</span><b>0{candidateIndex+1}</b>
          </button>
          <div className="evalSwatches"><Image width={170} height={190} src={candidate.shirt.image} alt={candidate.shirt.name}/><Image width={170} height={190} src={candidate.pant.image} alt={candidate.pant.name}/><em>{candidate.tier}</em></div>
          <div className="evalPair"><small>FABRIC PAIR</small><h3>{candidate.shirt.name}<br/>+ {candidate.pant.name}</h3><p>{candidate.shirt.patternType} · {candidate.pant.patternType}</p></div>
          <div className="evalStyle"><span><small>COLLAR</small><b>{candidate.style.collar}</b></span><span><small>SHIRT</small><b>{candidate.style.shirtFit} · {candidate.style.shirtWear}</b></span><span><small>TROUSER</small><b>{candidate.style.trouser}</b></span><span><small>RISE</small><b>{candidate.style.rise}</b></span></div>
          <details><summary>Why Designer chose it</summary>{candidate.reasons.map((item)=><p key={item}>✓ {item}</p>)}{candidate.tradeoffs.map((item)=><p key={item}>△ {item}</p>)}<small>Internal score {candidate.decision.overall} · certainty {candidate.decision.certainty} · {candidate.decision.risk} risk</small></details>
        </article>)}
      </div>

      <section className="evalLabel">
        <button className={choice==="none"?"selected":""} onClick={()=>setChoice("none")} aria-pressed={choice==="none"}>None of these three</button>
        <label>Why?
          <select value={reason} onChange={(event)=>setReason(event.target.value)}>{REASONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
        </label>
        <label className="evalNote">Optional operator note
          <textarea value={note} onChange={(event)=>setNote(event.target.value)} placeholder="What would you change or why is this direction stronger?" />
        </label>
        <div><p>{data.configured?"This saves one auditable ground-truth label. It does not change live ranking weights automatically.":"Connect cloud memory before benchmark labels can be retained."}</p><button className="evalSave" onClick={()=>void save()} disabled={!choice||saving||!data.configured}>{saving?"Saving…":"Save label + next case"}</button></div>
      </section>
    </section>

    {message&&<button className="evalToast" onClick={()=>setMessage("")}>{message}<b>×</b></button>}
  </main>;
}
