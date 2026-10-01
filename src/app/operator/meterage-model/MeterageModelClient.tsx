"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MeterageCalibrationBand, MeterageGarment } from "@/lib/designer/meterage-calibration";

type Model={
  model_id:string;
  garment:MeterageGarment;
  version:string;
  bands:MeterageCalibrationBand[];
  evidence_case_ids:string[];
  evidence_count:number;
  note:string;
  status:"draft"|"approved"|"retired";
  approved_by:string;
  approval_note:string;
  approved_at:string|null;
  created_at:string;
};

type BandForm={
  label:string;minFabricWidthCm:string;maxFabricWidthCm:string;
  baseMetres:string;patternAllowanceMetres:string;cutContext:string;
};

const emptyBand=():BandForm=>({
  label:"Standard width",minFabricWidthCm:"",maxFabricWidthCm:"",
  baseMetres:"",patternAllowanceMetres:"0",cutContext:"",
});

export default function MeterageModelClient(){
  const [models,setModels]=useState<Model[]>([]);
  const [configured,setConfigured]=useState(true);
  const [garment,setGarment]=useState<MeterageGarment>("shirt");
  const [version,setVersion]=useState("");
  const [note,setNote]=useState("");
  const [bands,setBands]=useState<BandForm[]>([emptyBand()]);
  const [approver,setApprover]=useState("");
  const [approvalNote,setApprovalNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/meterage-model",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/meterage-model";return;}
    const data=await response.json();
    if(!response.ok){setMessage(data.error||"Meterage calibration registry could not be loaded.");return;}
    setConfigured(data.configured!==false);
    setModels(Array.isArray(data.models)?data.models:[]);
  }
  useEffect(()=>{void load();},[]);

  const approved=useMemo(()=>({
    shirt:models.find((item)=>item.garment==="shirt"&&item.status==="approved")||null,
    trouser:models.find((item)=>item.garment==="trouser"&&item.status==="approved")||null,
  }),[models]);

  function patchBand(index:number,patch:Partial<BandForm>){
    setBands((current)=>current.map((item,i)=>i===index?{...item,...patch}:item));
  }

  const normalizedBands=bands.map((item)=>({
    label:item.label.trim(),
    minFabricWidthCm:Number(item.minFabricWidthCm),
    maxFabricWidthCm:Number(item.maxFabricWidthCm),
    baseMetres:Number(item.baseMetres),
    patternAllowanceMetres:Number(item.patternAllowanceMetres||0),
    cutContext:item.cutContext.trim(),
  }));
  const valid=version.trim().length>=3&&normalizedBands.every((item)=>
    item.label&&Number.isFinite(item.minFabricWidthCm)&&item.minFabricWidthCm>=60
    &&Number.isFinite(item.maxFabricWidthCm)&&item.maxFabricWidthCm<=220&&item.maxFabricWidthCm>=item.minFabricWidthCm
    &&Number.isFinite(item.baseMetres)&&item.baseMetres>0&&item.baseMetres<=12
    &&Number.isFinite(item.patternAllowanceMetres)&&item.patternAllowanceMetres>=0&&item.patternAllowanceMetres<=5
  );

  async function post(body:Record<string,unknown>,success:string){
    if(busy) return false;
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/operator/meterage-model",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Meterage calibration operation failed.");
      setMessage(success);await load();return true;
    }catch(error){
      setMessage(error instanceof Error?error.message:"Meterage calibration operation failed.");
      return false;
    }finally{setBusy(false);}
  }

  async function createDraft(){
    if(!valid) return;
    const saved=await post({action:"create",garment,version,bands:normalizedBands,note},"Calibration draft registered from real cut evidence.");
    if(saved){setVersion("");setNote("");setBands([emptyBand()]);}
  }

  return <main className="meterageModel">
    <header className="meterageModelHeader">
      <div>
        <span>LINEN EARTH / PRIVATE OPERATOR / PHYSICAL CALIBRATION</span>
        <h1>Meterage Registry</h1>
        <p>Build a versioned cloth-estimation table only after enough real cutting evidence exists. No default metres are seeded, and a draft cannot become active without named owner/tailor approval.</p>
      </div>
      <nav><Link href="/operator/production-calibration">Real Cut Evidence</Link><Link href="/operator/production">Production Desk</Link><Link href="/operator">Operator Desk</Link></nav>
    </header>

    {!configured&&<section className="meterageModelNotice">Supabase meterage registry migration is not installed yet.</section>}
    {message&&<section className="meterageModelNotice">{message}</section>}

    <section className="meterageModelStatus">
      <article data-live={Boolean(approved.shirt)}><span>SHIRT TABLE</span><strong>{approved.shirt?.version||"NOT APPROVED"}</strong><small>{approved.shirt?approved.shirt.evidence_count+" real cuts":"requires ≥20 real shirt cuts + approval"}</small></article>
      <article data-live={Boolean(approved.trouser)}><span>TROUSER TABLE</span><strong>{approved.trouser?.version||"NOT APPROVED"}</strong><small>{approved.trouser?approved.trouser.evidence_count+" real cuts":"requires ≥20 real trouser cuts + approval"}</small></article>
    </section>

    <section className="meterageModelGrid">
      <article className="meterageModelBuilder">
        <span>01 / NEW CALIBRATION DRAFT</span><h2>Enter the reviewed table.</h2>
        <div className="meterageModelPair">
          <label>Garment<select value={garment} onChange={(event)=>setGarment(event.target.value as MeterageGarment)}><option value="shirt">Shirt</option><option value="trouser">Trouser</option></select></label>
          <label>Version<input value={version} onChange={(event)=>setVersion(event.target.value.slice(0,80))} placeholder="shirt-2026.10-v1"/></label>
        </div>

        <div className="meterageBands">
          {bands.map((band,index)=><fieldset key={index}>
            <legend>Band {index+1}</legend>
            <label>Label<input value={band.label} onChange={(event)=>patchBand(index,{label:event.target.value})}/></label>
            <div className="meterageModelPair">
              <label>Width min (cm)<input type="number" min="60" max="220" step=".1" value={band.minFabricWidthCm} onChange={(event)=>patchBand(index,{minFabricWidthCm:event.target.value})}/></label>
              <label>Width max (cm)<input type="number" min="60" max="220" step=".1" value={band.maxFabricWidthCm} onChange={(event)=>patchBand(index,{maxFabricWidthCm:event.target.value})}/></label>
            </div>
            <div className="meterageModelPair">
              <label>Base metres<input type="number" min=".1" max="12" step=".01" value={band.baseMetres} onChange={(event)=>patchBand(index,{baseMetres:event.target.value})}/></label>
              <label>Pattern allowance (m)<input type="number" min="0" max="5" step=".01" value={band.patternAllowanceMetres} onChange={(event)=>patchBand(index,{patternAllowanceMetres:event.target.value})}/></label>
            </div>
            <label>Cut / size context<input value={band.cutContext} onChange={(event)=>patchBand(index,{cutContext:event.target.value.slice(0,160)})} placeholder="Reviewed applicability, e.g. regular long sleeve"/></label>
            {bands.length>1&&<button type="button" className="meterageRemove" onClick={()=>setBands((current)=>current.filter((_,i)=>i!==index))}>Remove band</button>}
          </fieldset>)}
        </div>
        <button type="button" className="meterageAdd" disabled={bands.length>=12} onClick={()=>setBands((current)=>[...current,emptyBand()])}>+ Add width band</button>
        <label>Calibration note<textarea rows={3} value={note} onChange={(event)=>setNote(event.target.value.slice(0,1200))} placeholder="How owner/tailor derived these values from the collected cuts."/></label>
        <button type="button" className="meteragePrimary" disabled={!configured||busy||!valid} onClick={()=>void createDraft()}>{busy?"Saving…":"Register draft from real evidence"}</button>
        <p className="meterageModelRule">The server counts real production-usage cases itself. It refuses to register a draft until at least 20 valid cases exist for the selected garment.</p>
      </article>

      <article className="meterageModelHistory">
        <span>02 / VERSION HISTORY</span><h2>Approval registry.</h2>
        {!models.length&&<p>No calibration versions registered yet.</p>}
        {models.map((model)=><section key={model.model_id} className="meterageModelCard" data-status={model.status}>
          <div><b>{model.version}</b><em>{model.status}</em></div>
          <strong>{model.garment.toUpperCase()} · {model.evidence_count} REAL CUTS</strong>
          <small>{model.bands.length} width band{model.bands.length===1?"":"s"} · {new Date(model.created_at).toLocaleString("en-IN")}</small>
          {model.note&&<p>{model.note}</p>}
          {model.status==="approved"&&<p className="meterageApproved">Approved by {model.approved_by} · {model.approved_at?new Date(model.approved_at).toLocaleString("en-IN"):""}</p>}
          {model.status==="draft"&&<div className="meterageApproval">
            <input value={approver} onChange={(event)=>setApprover(event.target.value)} placeholder="Owner / tailor approver"/>
            <textarea rows={2} value={approvalNote} onChange={(event)=>setApprovalNote(event.target.value.slice(0,1200))} placeholder="Approval note (optional)"/>
            <button disabled={busy||approver.trim().length<2||model.evidence_count<20} onClick={()=>void post({action:"approve",modelId:model.model_id,approvedBy:approver,approvalNote},"Meterage table approved and activated.")}>Approve + activate</button>
            <button className="retire" disabled={busy} onClick={()=>void post({action:"retire",modelId:model.model_id},"Draft retired.")}>Retire</button>
          </div>}
          {model.status==="approved"&&<button className="retire" disabled={busy} onClick={()=>void post({action:"retire",modelId:model.model_id},"Approved table retired.")}>Retire active table</button>}
        </section>)}
      </article>
    </section>
  </main>;
}
