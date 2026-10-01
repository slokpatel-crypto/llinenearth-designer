"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  HOUSE_SHIRT_EASE,
  HOUSE_TROUSER_EASE,
  type EaseRangeCm,
} from "@/lib/designer/house-ease";
import {
  SHIRT_EASE_CLASSES,
  SHIRT_EASE_FIELDS,
  TROUSER_EASE_CLASSES,
  TROUSER_EASE_FIELDS,
  type EaseCalibrationGarment,
  type HouseEaseCalibrationTable,
} from "@/lib/designer/ease-calibration";

type Evidence={
  evidence_id:string;case_id:string;garment:EaseCalibrationGarment;fit_class:string;field:string;
  body_cm:number|string;finished_cm:number|string;ease_cm:number|string;tailor:string;garment_ref:string;
  note:string;created_at:string;
};
type Model={
  model_id:string;version:string;shirt_table:HouseEaseCalibrationTable["shirt"];
  trouser_table:HouseEaseCalibrationTable["trouser"];evidence_case_count:number;
  note:string;status:"draft"|"approved"|"retired";approved_by:string;approval_note:string;
  approved_at:string|null;created_at:string;
};
type Summary={
  requiredCells:number;coveredCells:number;uncoveredCells:string[];
  evidenceCoverageComplete:boolean;uniqueCases:number;
};

const panel:React.CSSProperties={background:"#fff",border:"1px solid #ddd7cc",borderRadius:18,padding:20};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"10px 11px",border:"1px solid #cbc3b7",borderRadius:9,fontSize:14,background:"#fff"};
const button:React.CSSProperties={border:0,borderRadius:10,padding:"11px 15px",background:"#1a1a1a",color:"#fff",fontWeight:700,cursor:"pointer"};

function initialTable():HouseEaseCalibrationTable{
  return {
    shirt:structuredClone(HOUSE_SHIRT_EASE),
    trouser:structuredClone(HOUSE_TROUSER_EASE),
  };
}

export default function EaseCalibrationClient(){
  const [configured,setConfigured]=useState(true);
  const [evidence,setEvidence]=useState<Evidence[]>([]);
  const [models,setModels]=useState<Model[]>([]);
  const [summary,setSummary]=useState<Summary|null>(null);
  const [garment,setGarment]=useState<EaseCalibrationGarment>("shirt");
  const [fitClass,setFitClass]=useState<string>("regular");
  const [field,setField]=useState<string>("chest");
  const [caseId,setCaseId]=useState("");
  const [bodyCm,setBodyCm]=useState("");
  const [finishedCm,setFinishedCm]=useState("");
  const [tailor,setTailor]=useState("");
  const [garmentRef,setGarmentRef]=useState("");
  const [evidenceNote,setEvidenceNote]=useState("");
  const [version,setVersion]=useState("");
  const [table,setTable]=useState<HouseEaseCalibrationTable>(initialTable);
  const [modelNote,setModelNote]=useState("");
  const [approver,setApprover]=useState("");
  const [approvalNote,setApprovalNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/ease-calibration",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/ease-calibration";return;}
    const data=await response.json();
    if(!response.ok){setMessage(data.error||"Ease calibration registry could not be loaded.");return;}
    setConfigured(data.configured!==false);
    setEvidence(Array.isArray(data.evidence)?data.evidence:[]);
    setModels(Array.isArray(data.models)?data.models:[]);
    setSummary(data.summary||null);
  }
  useEffect(()=>{void load();},[]);

  const classes=garment==="shirt"?SHIRT_EASE_CLASSES:TROUSER_EASE_CLASSES;
  const fields=garment==="shirt"?SHIRT_EASE_FIELDS:TROUSER_EASE_FIELDS;
  useEffect(()=>{
    if(!(classes as readonly string[]).includes(fitClass)) setFitClass(classes[0]);
    if(!(fields as readonly string[]).includes(field)) setField(fields[0]);
  },[garment]);

  const activeModel=useMemo(()=>models.find((item)=>item.status==="approved")||null,[models]);
  const computedEase=Number.isFinite(Number(bodyCm))&&Number.isFinite(Number(finishedCm))&&bodyCm!==""&&finishedCm!==""
    ? Math.round((Number(finishedCm)-Number(bodyCm))*100)/100
    : null;

  async function post(body:Record<string,unknown>,success:string){
    if(busy) return false;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/operator/ease-calibration",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Ease calibration operation failed.");
      setMessage(success);await load();return true;
    }catch(error){
      setMessage(error instanceof Error?error.message:"Ease calibration operation failed.");
      return false;
    }finally{setBusy(false);}
  }

  async function saveEvidence(){
    const ok=await post({
      action:"record_evidence",caseId,garment,fitClass,field,
      bodyCm:Number(bodyCm),finishedCm:Number(finishedCm),tailor,garmentRef,note:evidenceNote,
    },"Finished-garment ease evidence recorded.");
    if(ok){setCaseId("");setBodyCm("");setFinishedCm("");setGarmentRef("");setEvidenceNote("");}
  }

  function patchRange(
    garmentKey:"shirt"|"trouser",
    fit:string,
    fieldKey:string,
    side:keyof EaseRangeCm,
    raw:string,
  ){
    const value=Number(raw);
    if(!Number.isFinite(value)) return;
    setTable((current)=>{
      const next=structuredClone(current) as any;
      next[garmentKey][fit][fieldKey][side]=value;
      return next;
    });
  }

  async function createModel(){
    const ok=await post({
      action:"create_model",version,shirt:table.shirt,trouser:table.trouser,note:modelNote,
    },"Versioned house-ease draft registered from real finished-garment evidence.");
    if(ok){setVersion("");setModelNote("");}
  }

  return <main style={{minHeight:"100vh",background:"#f8f6f0",color:"#1a1a1a",padding:"34px 18px"}}>
    <div style={{maxWidth:1180,margin:"0 auto",display:"grid",gap:18}}>
      <header style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"end",flexWrap:"wrap"}}>
        <div>
          <p style={{fontSize:12,letterSpacing:2,margin:"0 0 8px"}}>LINEN EARTH / ROADMAP V2 / PHASE 4</p>
          <h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(34px,5vw,56px)",margin:"0 0 10px",lineHeight:1}}>House Ease Calibration</h1>
          <p style={{maxWidth:760,lineHeight:1.6,opacity:.72}}>Measure real finished garments against real body measurements, cover every existing fit-table cell, then version and approve a replacement. The live fit engine remains on provisional defaults until a separate controlled promotion is made.</p>
        </div>
        <nav style={{display:"flex",gap:12,flexWrap:"wrap"}}><Link href="/operator/measurement-calibration">Self vs Tailor</Link><Link href="/operator/phase10-readiness">Readiness</Link><Link href="/operator">Operator Desk</Link></nav>
      </header>

      {!configured&&<section style={{...panel,background:"#fff4df"}}>House-ease calibration migration is not installed yet.</section>}
      {message&&<section style={{...panel,background:"#ece8df"}}>{message}</section>}

      <section style={{...panel,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
        <article><small>EVIDENCE CELLS</small><div style={{fontSize:34,fontWeight:800}}>{summary?.coveredCells??0}<span style={{fontSize:16,opacity:.45}}> / {summary?.requiredCells??35}</span></div></article>
        <article><small>REAL CASES</small><div style={{fontSize:34,fontWeight:800}}>{summary?.uniqueCases??0}</div></article>
        <article><small>TABLE COVERAGE</small><div style={{fontSize:25,fontWeight:800}}>{summary?.evidenceCoverageComplete?"COMPLETE":"COLLECTING"}</div></article>
        <article><small>ACTIVE APPROVAL</small><div style={{fontSize:22,fontWeight:800}}>{activeModel?.version||"NONE"}</div><span style={{fontSize:12,opacity:.6}}>registry only · runtime not auto-switched</span></article>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(350px,1fr))",gap:18}}>
        <article style={panel}>
          <h2 style={{marginTop:0}}>1. Record real finished-garment evidence</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:11}}>
            <label><span>Garment</span><select style={input} value={garment} onChange={(e)=>setGarment(e.target.value as EaseCalibrationGarment)}><option value="shirt">Shirt</option><option value="trouser">Trouser</option></select></label>
            <label><span>Fit class</span><select style={input} value={fitClass} onChange={(e)=>setFitClass(e.target.value)}>{classes.map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
            <label><span>Measurement field</span><select style={input} value={field} onChange={(e)=>setField(e.target.value)}>{fields.map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
            <label><span>Anonymous case ID</span><input style={input} value={caseId} onChange={(e)=>setCaseId(e.target.value.slice(0,80))} placeholder="EASE-001"/></label>
            <label><span>Body measurement (cm)</span><input style={input} type="number" step=".1" value={bodyCm} onChange={(e)=>setBodyCm(e.target.value)}/></label>
            <label><span>Finished garment (cm)</span><input style={input} type="number" step=".1" value={finishedCm} onChange={(e)=>setFinishedCm(e.target.value)}/></label>
            <label><span>Tailor / inspector</span><input style={input} value={tailor} onChange={(e)=>setTailor(e.target.value.slice(0,120))}/></label>
            <label><span>Real garment reference</span><input style={input} value={garmentRef} onChange={(e)=>setGarmentRef(e.target.value.slice(0,120))} placeholder="Sample shirt 07"/></label>
            <label style={{gridColumn:"1/-1"}}><span>Evidence note</span><textarea style={{...input,minHeight:76}} value={evidenceNote} onChange={(e)=>setEvidenceNote(e.target.value.slice(0,1000))} placeholder="Fit outcome / construction context / measurement method."/></label>
          </div>
          <div style={{margin:"14px 0",padding:12,borderRadius:10,background:"#f3f0ea"}}>Observed ease: <strong>{computedEase===null?"—":computedEase+" cm"}</strong></div>
          <button style={button} disabled={busy||!caseId||!bodyCm||!finishedCm||tailor.trim().length<2||garmentRef.trim().length<2} onClick={()=>void saveEvidence()}>{busy?"Saving…":"Record append-only evidence"}</button>
        </article>

        <article style={panel}>
          <h2 style={{marginTop:0}}>Evidence coverage</h2>
          <p style={{fontSize:13,opacity:.68,lineHeight:1.55}}>A replacement table cannot even be registered until all 35 cells in the current house-ease contract have at least one real finished-garment observation. No arbitrary sample-count threshold is invented.</p>
          <div style={{display:"grid",gap:8,maxHeight:440,overflow:"auto"}}>
            {(summary?.uncoveredCells||[]).slice(0,40).map((key)=><div key={key} style={{padding:"8px 10px",border:"1px solid #ece6dc",borderRadius:8,fontSize:13}}>{key}</div>)}
            {summary?.evidenceCoverageComplete&&<div style={{padding:12,borderRadius:9,background:"#eef3ea"}}><strong>Every table cell has physical evidence.</strong></div>}
          </div>
          <div style={{marginTop:14,fontSize:12,opacity:.6}}>Latest records: {evidence.length}</div>
        </article>
      </section>

      <section style={panel}>
        <h2 style={{marginTop:0}}>2. Build the versioned replacement table</h2>
        <p style={{opacity:.68,fontSize:13,lineHeight:1.55}}>The editor begins with the current provisional Linen Earth values only as a comparison baseline. Change values only from the evidence and tailor review. Registering or approving this table does not silently change customer fit calculations.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(330px,1fr))",gap:18}}>
          <EaseTableEditor title="Shirt" garment="shirt" classes={SHIRT_EASE_CLASSES} fields={SHIRT_EASE_FIELDS} table={table.shirt as any} patch={patchRange}/>
          <EaseTableEditor title="Trouser" garment="trouser" classes={TROUSER_EASE_CLASSES} fields={TROUSER_EASE_FIELDS} table={table.trouser as any} patch={patchRange}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"minmax(220px,.4fr) minmax(280px,1fr)",gap:12,marginTop:18}}>
          <label><span>Version</span><input style={input} value={version} onChange={(e)=>setVersion(e.target.value.slice(0,80))} placeholder="house-ease-2026.10-v1"/></label>
          <label><span>Derivation note</span><input style={input} value={modelNote} onChange={(e)=>setModelNote(e.target.value.slice(0,1200))} placeholder="How the ranges were derived from real garments."/></label>
        </div>
        <button style={{...button,marginTop:12}} disabled={busy||!summary?.evidenceCoverageComplete||version.trim().length<3} onClick={()=>void createModel()}>{busy?"Saving…":"Register evidence-backed draft"}</button>
      </section>

      <section style={panel}>
        <h2 style={{marginTop:0}}>3. Human approval registry</h2>
        <div style={{display:"grid",gridTemplateColumns:"minmax(200px,.35fr) minmax(280px,1fr)",gap:12,marginBottom:14}}>
          <label><span>Owner / tailor approver</span><input style={input} value={approver} onChange={(e)=>setApprover(e.target.value.slice(0,120))}/></label>
          <label><span>Approval note</span><input style={input} value={approvalNote} onChange={(e)=>setApprovalNote(e.target.value.slice(0,1200))}/></label>
        </div>
        <div style={{display:"grid",gap:10}}>
          {!models.length&&<p style={{opacity:.65}}>No evidence-backed ease model registered yet.</p>}
          {models.map((model)=><article key={model.model_id} style={{borderTop:"1px solid #ece6dc",paddingTop:12}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><strong>{model.version}</strong><b style={{textTransform:"uppercase"}}>{model.status}</b></div>
            <div style={{fontSize:12,opacity:.62,marginTop:4}}>{model.evidence_case_count} unique evidence cases · {new Date(model.created_at).toLocaleString("en-IN")}</div>
            {model.note&&<p style={{fontSize:13,opacity:.72}}>{model.note}</p>}
            {model.status==="approved"&&<p style={{fontSize:13}}>Approved by <strong>{model.approved_by}</strong>{model.approved_at?" · "+new Date(model.approved_at).toLocaleString("en-IN"):""}</p>}
            {model.status==="draft"&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:9}}>
              <button style={button} disabled={busy||approver.trim().length<2} onClick={()=>void post({action:"approve_model",modelId:model.model_id,approvedBy:approver,approvalNote},"House-ease table approved in the registry. Runtime remains provisional until controlled promotion.")}>Approve registry version</button>
              <button style={{...button,background:"#fff",color:"#7a2f2f",border:"1px solid #d8c6c1"}} disabled={busy} onClick={()=>void post({action:"retire_model",modelId:model.model_id},"Ease-table draft retired.")}>Retire</button>
            </div>}
            {model.status==="approved"&&<button style={{...button,marginTop:8,background:"#fff",color:"#7a2f2f",border:"1px solid #d8c6c1"}} disabled={busy} onClick={()=>void post({action:"retire_model",modelId:model.model_id},"Approved ease-table version retired.")}>Retire active registry version</button>}
          </article>)}
        </div>
      </section>
    </div>
  </main>;
}

function EaseTableEditor(props:{
  title:string;
  garment:"shirt"|"trouser";
  classes:readonly string[];
  fields:readonly string[];
  table:Record<string,Record<string,EaseRangeCm>>;
  patch:(garment:"shirt"|"trouser",fit:string,field:string,side:keyof EaseRangeCm,value:string)=>void;
}){
  return <div>
    <h3>{props.title}</h3>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr><th style={{textAlign:"left",padding:6}}>Class / field</th><th>Min cm</th><th>Max cm</th></tr></thead>
        <tbody>{props.classes.flatMap((fit)=>props.fields.map((field)=><tr key={fit+field} style={{borderTop:"1px solid #eee9df"}}>
          <td style={{padding:"7px 5px"}}><strong>{fit}</strong> · {field}</td>
          <td style={{padding:4}}><input style={{...input,padding:"6px 7px"}} type="number" step=".1" min="0" value={props.table[fit][field].min} onChange={(e)=>props.patch(props.garment,fit,field,"min",e.target.value)}/></td>
          <td style={{padding:4}}><input style={{...input,padding:"6px 7px"}} type="number" step=".1" min="0" value={props.table[fit][field].max} onChange={(e)=>props.patch(props.garment,fit,field,"max",e.target.value)}/></td>
        </tr>))}</tbody>
      </table>
    </div>
  </div>;
}
