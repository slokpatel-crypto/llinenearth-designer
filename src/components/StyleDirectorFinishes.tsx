"use client";

import { useEffect, useRef, useState } from "react";
import type { StyleDirectorAnswers, StyleDirectorRealModelSpec } from "@/lib/style-director-agent";
import {
  STYLE_DIRECTOR_FINISH_GROUPS, type StyleDirectorFinishAlternative, type StyleDirectorFinishKey,
} from "@/lib/designer/style-director-finishes";

export type StyleDirectorClientFinish=StyleDirectorFinishAlternative & {handoffToken?:string|null};

export function StyleDirectorFinishes({
  answers,sourceLookId,base,activeId,onChoose,
}:{
  answers:StyleDirectorAnswers;
  sourceLookId:string;
  base:StyleDirectorRealModelSpec;
  activeId:string|null;
  onChoose:(finish:StyleDirectorClientFinish|null)=>void;
}){
  const [group,setGroup]=useState<StyleDirectorFinishKey>("collar");
  const [alternatives,setAlternatives]=useState<StyleDirectorClientFinish[]|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const requestId=useRef(0);
  const activeRequest=useRef<AbortController|null>(null);

  useEffect(()=>()=>{requestId.current++;activeRequest.current?.abort();},[]);

  function invalidate(){
    requestId.current++;
    activeRequest.current?.abort();
    activeRequest.current=null;
    setLoading(false);
  }

  function changeGroup(value:StyleDirectorFinishKey){
    if(value===group) return;
    invalidate();setGroup(value);setAlternatives(null);setError("");
    if(activeId) onChoose(null);
  }

  async function explore(){
    invalidate();
    const seq=++requestId.current;
    const controller=new AbortController();
    activeRequest.current=controller;
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/style-director/finishes",{
        method:"POST",headers:{"content-type":"application/json"},signal:controller.signal,
        body:JSON.stringify({answers,lookId:sourceLookId,shirtId:base.shirtId,pantId:base.pantId,finishKey:group}),
      });
      if(seq!==requestId.current) return;
      const data=await response.json() as {
        sourceLookId?:string;shirtId?:string;pantId?:string;
        finishKey?:string;alternatives?:StyleDirectorClientFinish[];error?:string;
      };
      if(seq!==requestId.current) return;
      if(!response.ok) throw new Error(data.error||"Could not load construction directions.");
      if(data.sourceLookId!==sourceLookId||data.shirtId!==base.shirtId||data.pantId!==base.pantId
        ||data.finishKey!==group||!Array.isArray(data.alternatives))
        throw new Error("The finishing response no longer matches this outfit.");
      setAlternatives(data.alternatives);
      if(activeId && !data.alternatives.some(item=>item.id===activeId)) onChoose(null);
    }catch(e){
      if(seq===requestId.current) setError(e instanceof Error?e.message:"Finishing details are unavailable.");
    }finally{
      if(seq===requestId.current){setLoading(false);activeRequest.current=null;}
    }
  }

  return <section className="directorFinishes" aria-label="Refine outfit construction">
    <div className="directorFinishIntro">
      <div><span>FINISHING TOUCHES</span><h4>Refine the details of your look</h4></div>
      <div className="directorFinishControls">
        <label htmlFor="directorFinishGroup">Construction detail</label>
        <select id="directorFinishGroup" value={group} onChange={e=>changeGroup(e.target.value as StyleDirectorFinishKey)}>
          {STYLE_DIRECTOR_FINISH_GROUPS.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
        <button type="button" onClick={()=>void explore()} disabled={loading}>
          {loading?"Checking details…":alternatives===null?"Explore finishes":"Refresh finishes"}
        </button>
      </div>
    </div>
    <p>One detail at a time. Your selected fabrics stay fixed. Every option is preliminary pending physical cloth and tailor review.</p>
    {error && <p className="directorFinishError" role="alert">{error}</p>}
    {alternatives && <div className="directorFinishOptions">
      <button type="button" aria-pressed={!activeId} onClick={()=>onChoose(null)}>
        <b>Original construction</b><span>Use this outfit's existing details</span>
      </button>
      {alternatives.map(item=><button type="button" key={item.id} aria-pressed={activeId===item.id} onClick={()=>onChoose(item)}>
        <b>{item.label}</b><span>{item.status==="needs_review"?"Needs human review":"Preliminary"} · {item.description}</span>
      </button>)}
    </div>}
    {alternatives?.length===0 && <p>No alternative finish passed the current construction rules for this outfit.</p>}
    {activeId && alternatives?.find(item=>item.id===activeId) && <p className="directorFinishSelected" role="status">
      {alternatives.find(item=>item.id===activeId)?.reviewNote}
    </p>}
  </section>;
}
