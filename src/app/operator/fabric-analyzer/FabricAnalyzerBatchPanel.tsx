"use client";

import { useMemo, useRef, useState } from "react";

type BatchItem={
  fabricId?:string;
  imageUrl?:string;
  macroImageUrl?:string;
  foldImageUrl?:string;
  sourcePageUrl?:string;
  sourceId?:string;
  declaredMaterial?:string;
  declaredFabricType?:string;
  supplierColorName?:string;
  supplierPatternName?:string;
  notes?:string;
  swatchRealWidthMm?:number;
  repeatRealMm?:number;
  verifiedGsm?:number;
  verifiedDrape?:"Fluid"|"Balanced"|"Structured";
  verifiedFiberContent?:string;
  verifiedPhysicalSourceUrl?:string;
  verifiedPhysicalEvidenceNote?:string;
};

const HEADERS=[
  "fabricId","imageUrl","macroImageUrl","foldImageUrl","sourcePageUrl","sourceId",
  "declaredMaterial","declaredFabricType","supplierColorName","supplierPatternName",
  "swatchRealWidthMm","repeatRealMm","verifiedGsm","verifiedDrape",
  "verifiedFiberContent","verifiedPhysicalSourceUrl","verifiedPhysicalEvidenceNote","notes",
] as const;

function parseCsv(text:string){
  const rows:string[][]=[];
  let row:string[]=[];
  let cell="";
  let quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(char==='"'){
      if(quoted && text[i+1]==='"'){cell+='"';i+=1;}
      else quoted=!quoted;
      continue;
    }
    if(char==="," && !quoted){row.push(cell);cell="";continue;}
    if((char==="\n"||char==="\r") && !quoted){
      if(char==="\r"&&text[i+1]==="\n") i+=1;
      row.push(cell);cell="";
      if(row.some((value)=>value.trim())) rows.push(row);
      row=[];
      continue;
    }
    cell+=char;
  }
  row.push(cell);
  if(row.some((value)=>value.trim())) rows.push(row);
  return rows;
}

function numberOrUndefined(value:string){
  const n=Number(value.trim());
  return value.trim() && Number.isFinite(n) ? n : undefined;
}

function itemsFromCsv(text:string){
  const rows=parseCsv(text);
  if(rows.length<2) return [] as BatchItem[];
  const header=rows[0].map((value)=>value.trim());
  return rows.slice(1).map((cells)=>{
    const raw=Object.fromEntries(header.map((key,index)=>[key,(cells[index]||"").trim()]));
    const drape=["Fluid","Balanced","Structured"].includes(raw.verifiedDrape) ? raw.verifiedDrape as BatchItem["verifiedDrape"] : undefined;
    return {
      fabricId:raw.fabricId||undefined,
      imageUrl:raw.imageUrl||undefined,
      macroImageUrl:raw.macroImageUrl||undefined,
      foldImageUrl:raw.foldImageUrl||undefined,
      sourcePageUrl:raw.sourcePageUrl||undefined,
      sourceId:raw.sourceId||undefined,
      declaredMaterial:raw.declaredMaterial||undefined,
      declaredFabricType:raw.declaredFabricType||undefined,
      supplierColorName:raw.supplierColorName||undefined,
      supplierPatternName:raw.supplierPatternName||undefined,
      swatchRealWidthMm:numberOrUndefined(raw.swatchRealWidthMm||""),
      repeatRealMm:numberOrUndefined(raw.repeatRealMm||""),
      verifiedGsm:numberOrUndefined(raw.verifiedGsm||""),
      verifiedDrape:drape,
      verifiedFiberContent:raw.verifiedFiberContent||undefined,
      verifiedPhysicalSourceUrl:raw.verifiedPhysicalSourceUrl||undefined,
      verifiedPhysicalEvidenceNote:raw.verifiedPhysicalEvidenceNote||undefined,
      notes:raw.notes||undefined,
    };
  }).filter((item)=>item.fabricId || item.imageUrl || item.sourcePageUrl);
}

function csvCell(value:unknown){
  const text=String(value??"");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
}

export default function FabricAnalyzerBatchPanel({onComplete}:{onComplete?:()=>void|Promise<void>}){
  const [csvText,setCsvText]=useState("");
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState({done:0,total:0,succeeded:0,failed:0});
  const [message,setMessage]=useState("");
  const fileRef=useRef<HTMLInputElement|null>(null);
  const parsed=useMemo(()=>itemsFromCsv(csvText),[csvText]);
  const runnable=parsed.filter((item)=>Boolean(item.imageUrl||item.sourcePageUrl));

  async function downloadTemplate(){
    setMessage("");
    try{
      const response=await fetch("/api/operator/designer-data",{cache:"no-store"});
      const payload=await response.json() as {fabrics?:Array<{
        id:string;colorName:string;line:string;family:string;pattern:string;
        metadata?:{
          weightGsm?:number;drape?:string;note?:string;
          physicalEvidence?:{sourceType?:string;reference?:string;checkedBy?:string;evidenceDate?:string;sourceUrl?:string};
        };
        evidence?:{priority?:number;gaps?:string[]};
      }>;error?:string};
      if(!response.ok) throw new Error(payload.error||"Designer data could not be loaded.");
      const fabrics=(payload.fabrics||[])
        .filter((fabric)=>(fabric.evidence?.priority||0)>0)
        .sort((a,b)=>(b.evidence?.priority||0)-(a.evidence?.priority||0));
      const lines=[HEADERS.join(",")];
      for(const fabric of fabrics){
        const mappedDrape=fabric.metadata?.drape==="structured"?"Structured"
          : fabric.metadata?.drape==="medium"?"Balanced"
            : ["fluid","soft"].includes(String(fabric.metadata?.drape||""))?"Fluid":"";
        const provenance=fabric.metadata?.physicalEvidence;
        const inheritedEvidenceNote=provenance
          ? [provenance.sourceType,provenance.reference,provenance.checkedBy ? "checked by "+provenance.checkedBy : "",provenance.evidenceDate].filter(Boolean).join(" · ")
          : "";
        const row:Record<string,unknown>={
          fabricId:fabric.id,
          imageUrl:"",
          macroImageUrl:"",
          foldImageUrl:"",
          sourcePageUrl:"",
          sourceId:"linen-earth-catalogue",
          declaredMaterial:fabric.family,
          declaredFabricType:fabric.line,
          supplierColorName:fabric.colorName,
          supplierPatternName:fabric.pattern,
          swatchRealWidthMm:"",
          repeatRealMm:"",
          verifiedGsm:fabric.metadata?.weightGsm??"",
          verifiedDrape:mappedDrape,
          verifiedFiberContent:"",
          verifiedPhysicalSourceUrl:provenance?.sourceUrl||"",
          verifiedPhysicalEvidenceNote:inheritedEvidenceNote,
          notes:`Evidence queue gaps: ${(fabric.evidence?.gaps||[]).join(" | ")}`,
        };
        lines.push(HEADERS.map((header)=>csvCell(row[header])).join(","));
      }
      const blob=new Blob([lines.join("\n")],{type:"text/csv;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=url;
      anchor.download="linen-earth-fabric-analyzer-batch.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage(`Template created for ${fabrics.length} fabrics with evidence gaps. Existing structured physical provenance is carried forward; add trusted capture URLs before running.`);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Batch template could not be created.");
    }
  }

  async function pickFile(file:File|null){
    if(!file) return;
    setCsvText(await file.text());
    setMessage(`Loaded ${file.name}.`);
  }

  async function runBatch(){
    if(running || !runnable.length) return;
    setRunning(true);
    setMessage("");
    setProgress({done:0,total:runnable.length,succeeded:0,failed:0});
    let succeeded=0;
    let failed=0;
    try{
      for(let offset=0;offset<runnable.length;offset+=12){
        const items=runnable.slice(offset,offset+12);
        const response=await fetch("/api/operator/fabric-analyzer/batch",{
          method:"POST",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({items}),
        });
        if(response.status===401){
          window.location.href="/operator/login?next=/operator/fabric-analyzer";
          return;
        }
        const result=await response.json() as {succeeded?:number;failed?:number;error?:string};
        if(!response.ok) throw new Error(result.error||"Analyzer batch failed.");
        succeeded+=Number(result.succeeded||0);
        failed+=Number(result.failed||0);
        setProgress({done:Math.min(runnable.length,offset+items.length),total:runnable.length,succeeded,failed});
      }
      setMessage(`Batch complete: ${succeeded} analyzed, ${failed} failed. New profiles still require human review before full Designer trust.`);
      await onComplete?.();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Analyzer batch failed.");
    }finally{
      setRunning(false);
    }
  }

  return <section className="analyzerPanel analyzerBatch">
    <div className="panelTitle"><span>03 / BATCH CAPTURE</span><h2>Process verified fabric evidence faster.</h2><b>{runnable.length} runnable</b></div>
    <div className="batchGuardrail"><strong>NO AUTO-INVENTED PHYSICAL FACTS</strong><p>The worksheet preloads catalogue identity only. Add trusted flat image URLs and only enter GSM, drape, fibre or millimetres when you have real supplier/owner evidence. Every physical value also needs either a source URL or a short evidence note.</p></div>
    <div className="batchActions">
      <button type="button" onClick={()=>void downloadTemplate()}>Download evidence-gap CSV</button>
      <button type="button" onClick={()=>fileRef.current?.click()}>Load completed CSV</button>
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(event)=>void pickFile(event.target.files?.[0]||null)} />
    </div>
    <textarea value={csvText} onChange={(event)=>setCsvText(event.target.value)} placeholder={HEADERS.join(",")} rows={9} spellCheck={false} />
    <div className="batchSummary">
      <span><small>PARSED ROWS</small><b>{parsed.length}</b></span>
      <span><small>WITH TRUSTED SOURCE</small><b>{runnable.length}</b></span>
      <span><small>MISSING CAPTURE/SOURCE</small><b>{Math.max(0,parsed.length-runnable.length)}</b></span>
      <span><small>RESULT</small><b>{progress.succeeded} ok · {progress.failed} failed</b></span>
    </div>
    {running&&<div className="batchProgress"><i style={{width:`${progress.total?Math.round(progress.done/progress.total*100):0}%`}}/><span>{progress.done}/{progress.total}</span></div>}
    <button className="analyzeButton" type="button" disabled={running||!runnable.length} onClick={()=>void runBatch()}>{running?"Running private Analyzer batches…":`Analyze ${runnable.length} trusted rows`}</button>
    {message&&<button className="batchMessage" type="button" onClick={()=>setMessage("")}>{message}<b>×</b></button>}
  </section>;
}
