"use client";

import { useEffect, useRef, useState } from "react";
import type { StyleDirectorAnswers, StyleDirectorRealModelSpec } from "@/lib/style-director-agent";
import type { StyleDirectorFinishKey } from "@/lib/designer/style-director-finishes";
import type { StyleDirectorVersatilityRow } from "@/lib/designer/style-director-versatility";

export function StyleDirectorVersatility({
  answers,sourceLookId,base,finishKey,finishId,
}:{
  answers:StyleDirectorAnswers;
  sourceLookId:string;
  base:StyleDirectorRealModelSpec;
  finishKey:StyleDirectorFinishKey|null;
  finishId:string|null;
}) {
  const [rows,setRows]=useState<StyleDirectorVersatilityRow[]|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const counter=useRef(0);
  const current=useRef<AbortController|null>(null);

  useEffect(()=>()=>{counter.current++;current.current?.abort();},[]);

  async function explore(){
    counter.current++;
    current.current?.abort();
    const seq=counter.current;
    const controller=new AbortController();
    current.current=controller;
    setLoading(true);setError("");setRows(null);
    try{
      const response=await fetch("/api/style-director/versatility",{
        method:"POST",signal:controller.signal,headers:{"content-type":"application/json"},
        body:JSON.stringify({
          answers,lookId:sourceLookId,shirtId:base.shirtId,pantId:base.pantId,finishKey,finishId,
        }),
      });
      if(seq!==counter.current) return;
      const result=await response.json() as {
        sourceLookId?:string;shirtId?:string;pantId?:string;finishId?:string|null;
        rows?:StyleDirectorVersatilityRow[];error?:string;
      };
      if(seq!==counter.current) return;
      if(!response.ok) throw new Error(result.error||"Could not assess this outfit.");
      if(result.sourceLookId!==sourceLookId||result.shirtId!==base.shirtId
        ||result.pantId!==base.pantId||result.finishId!==finishId
        ||!Array.isArray(result.rows)||result.rows.length!==4)
        throw new Error("The versatility results no longer match the selected outfit.");
      setRows(result.rows);
    }catch(e){
      if(seq===counter.current) setError(e instanceof Error?e.message:"Versatility assessment unavailable.");
    }finally{
      if(seq===counter.current){setLoading(false);current.current=null;}
    }
  }

  return <section className="directorVersatility" aria-label="Occasion versatility of selected outfit">
    <div className="directorVersatilityIntro">
      <div><span>BEYOND ONE OCCASION</span><h4>Where else could this look work?</h4></div>
      <button type="button" onClick={()=>void explore()} disabled={loading}>
        {loading?"Checking occasions…":rows?"Refresh occasion assessment":"Explore occasions"}
      </button>
    </div>
    <p>The same exact fabrics and construction are evaluated against four dress-code directions. These are provisional styling signals, not verified dress-code, comfort, stock or fit approvals.</p>
    {error && <p role="alert" className="directorVersatilityError">{error}</p>}
    {rows && <div className="directorVersatilityGrid">
      {rows.map(row=><article key={row.occasion} className="directorVersatilityCard">
        <div className="directorVersatilityCardTop">
          <strong>{row.label}</strong>
          <span>{row.state==="review_required"?"Review needed":"Preliminary"}</span>
        </div>
        <p>{row.description}</p>
        <p><b>{row.stylingSignal===null?"Unscored":`${Math.round(row.stylingSignal)}/100`}</b> <small>style-engine signal</small></p>
        <p>{row.reason}</p>
        {row.reviewItems.length>0 && <p className="directorVersatilityReview">To review: {row.reviewItems[0]}</p>}
      </article>)}
    </div>}
    {rows && <p className="directorVersatilityDisclaimer">Scores are relative styling analysis, not evidence of measured cloth performance or tailor acceptance. Confirm the actual dress code with the wearer and venue.</p>}
  </section>;
}
