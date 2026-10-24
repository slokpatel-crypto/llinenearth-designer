"use client";

import { useMemo, useRef, useState } from "react";
import { catalogPhysicalCsvPrefill, inspectBatchCsvWorksheet } from "@/lib/fabric-analyzer-batch-csv";
import { verifyFabricAnalyzerBatchResult } from "@/lib/fabric-analyzer-batch-result";
import { describeBatchStop, describeBatchRefreshFailure } from "@/lib/fabric-analyzer-batch-messages";

const HEADERS=[
  "fabricId","imageUrl","macroImageUrl","foldImageUrl","sourcePageUrl","sourceId",
  "declaredMaterial","declaredFabricType","supplierColorName","supplierPatternName",
  "swatchRealWidthMm","repeatRealMm","verifiedGsm","verifiedDrape","verifiedFiberContent",
  "verifiedStructure","verifiedBreathability","verifiedWrinkleResistance","verifiedStretch",
  "verifiedPhysicalSourceUrl","verifiedPhysicalEvidenceNote","notes",
] as const;

function csvCell(value:unknown){
  const text=String(value??"");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
}

export default function FabricAnalyzerBatchPanel({onComplete}:{onComplete?:()=>void|Promise<void>}){
  const [csvText,setCsvText]=useState("");
  const [running,setRunning]=useState(false);
  const runningRef=useRef(false);
  const csvRevisionRef=useRef(0);
  const [progress,setProgress]=useState({done:0,total:0,succeeded:0,failed:0});
  const [message,setMessage]=useState("");
  const fileRef=useRef<HTMLInputElement|null>(null);
  const worksheet=useMemo(()=>inspectBatchCsvWorksheet(csvText),[csvText]);
  const parsed=worksheet.items;
  const runnable=parsed.filter((item)=>Boolean(item.imageUrl||item.sourcePageUrl));

  async function downloadTemplate(){
    if(runningRef.current) return;
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
        const verifiedPhysical=catalogPhysicalCsvPrefill(fabric.metadata);
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
          verifiedGsm:verifiedPhysical.verifiedGsm,
          verifiedDrape:verifiedPhysical.verifiedDrape,
          verifiedFiberContent:"",
          verifiedStructure:"",
          verifiedBreathability:"",
          verifiedWrinkleResistance:"",
          verifiedStretch:"",
          verifiedPhysicalSourceUrl:verifiedPhysical.verifiedPhysicalSourceUrl,
          verifiedPhysicalEvidenceNote:verifiedPhysical.verifiedPhysicalEvidenceNote,
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

  function editCsvText(value:string){
    if(runningRef.current) return;
    csvRevisionRef.current+=1;
    setCsvText(value);
    setMessage("");
  }

  async function pickFile(file:File|null){
    if(!file || runningRef.current) return;
    const revision=++csvRevisionRef.current;
    try{
      const text=await file.text();
      if(runningRef.current || csvRevisionRef.current!==revision) return;
      setCsvText(text);
      setMessage(`Loaded ${file.name}.`);
    }catch{
      if(runningRef.current || csvRevisionRef.current!==revision) return;
      setMessage(`Could not read ${file.name}. Please choose a valid CSV file.`);
    }
  }

  async function runBatch(){
    if(runningRef.current || worksheet.error || !runnable.length) return;
    runningRef.current=true;
    csvRevisionRef.current+=1;
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
        const verified=verifyFabricAnalyzerBatchResult(result,items.length);
        succeeded+=verified.succeeded;
        failed+=verified.failed;
        setProgress({done:Math.min(runnable.length,offset+items.length),total:runnable.length,succeeded,failed});
      }
      setMessage(`Batch complete: ${succeeded} analyzed, ${failed} failed. New profiles still require human review before full Designer trust.`);
      try{
        await onComplete?.();
      }catch{
        setMessage(describeBatchRefreshFailure(succeeded,failed));
      }
    }catch(error){
      setMessage(describeBatchStop({
        total:runnable.length,
        succeeded,
        failed,
        error:error instanceof Error?error.message:"Analyzer request failed.",
      }));
    }finally{
      runningRef.current=false;
      setRunning(false);
    }
  }

  return <section className="analyzerPanel analyzerBatch">
    <div className="panelTitle"><span>03 / BATCH CAPTURE</span><h2>Process verified fabric evidence faster.</h2><b>{runnable.length} runnable</b></div>
    <div className="batchGuardrail"><strong>NO AUTO-INVENTED PHYSICAL FACTS</strong><p>The worksheet preloads catalogue identity only. Add trusted flat image URLs and enter GSM, drape, fibre, millimetres or the 0–1 physics indices only when you have repeatable supplier/owner evidence. Every physical value also needs either a source URL or a short evidence note.</p></div>
    <div className="batchActions">
      <button type="button" disabled={running} onClick={()=>void downloadTemplate()}>Download evidence-gap CSV</button>
      <button type="button" disabled={running} onClick={()=>fileRef.current?.click()}>Load completed CSV</button>
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden disabled={running} onChange={(event)=>{const file=event.currentTarget.files?.[0]||null;event.currentTarget.value="";void pickFile(file);}} />
    </div>
    <textarea value={csvText} disabled={running} onChange={(event)=>editCsvText(event.target.value)} placeholder={HEADERS.join(",")} rows={9} spellCheck={false} />
    {worksheet.error&&<p className="batchGuardrail" role="alert">CSV cannot run: {worksheet.error}</p>}
    <div className="batchSummary">
      <span><small>PARSED ROWS</small><b>{parsed.length}</b></span>
      <span><small>WITH TRUSTED SOURCE</small><b>{runnable.length}</b></span>
      <span><small>MISSING CAPTURE/SOURCE</small><b>{Math.max(0,parsed.length-runnable.length)}</b></span>
      <span><small>RESULT</small><b>{progress.succeeded} ok · {progress.failed} failed</b></span>
    </div>
    {running&&<div className="batchProgress"><i style={{width:`${progress.total?Math.round(progress.done/progress.total*100):0}%`}}/><span>{progress.done}/{progress.total}</span></div>}
    <button className="analyzeButton" type="button" disabled={running||Boolean(worksheet.error)||!runnable.length} onClick={()=>void runBatch()}>{running?"Running private Analyzer batches…":`Analyze ${runnable.length} trusted rows`}</button>
    {message&&<button className="batchMessage" type="button" onClick={()=>setMessage("")}>{message}<b>×</b></button>}
  </section>;
}
