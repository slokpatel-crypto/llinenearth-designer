"use client";

import { useMemo, useRef, useState } from "react";
import type { DesignerFabricMetadata } from "@/lib/designer-fabric-metadata-types";

type FabricRow={
  id:string;
  colorName:string;
  line:string;
  pattern:string;
  metadata:DesignerFabricMetadata;
  evidence:{priority:number;gaps:string[]};
};

const HEADERS=[
  "fabricId","availability","weightGsm","weightClass","weave","texture","drape",
  "seasonTags","formalityScore","roleTags","physicalSourceType","physicalReference","physicalCheckedBy","physicalEvidenceDate","physicalSourceUrl","note",
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
    if((char==="\n"||char==="\r")&&!quoted){
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

function csvCell(value:unknown){
  const text=String(value??"");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
}

function numberOrUndefined(value:string){
  const text=value.trim();
  if(!text) return undefined;
  const n=Number(text);
  return Number.isFinite(n)?n:undefined;
}

function splitList(value:string){
  return value.split(/[|;]/).map((item)=>item.trim()).filter(Boolean);
}

type ImportedRow={
  fabricId:string;
  availability?:string;
  weightGsm?:number;
  weightClass?:string;
  weave?:string;
  texture?:string;
  drape?:string;
  seasonTags?:string[];
  formalityScore?:number;
  roleTags?:string[];
  physicalSourceType?:string;
  physicalReference?:string;
  physicalCheckedBy?:string;
  physicalEvidenceDate?:string;
  physicalSourceUrl?:string;
  note?:string;
};

function importedRows(text:string){
  const rows=parseCsv(text);
  if(rows.length<2) return [] as ImportedRow[];
  const headers=rows[0].map((value)=>value.trim());
  return rows.slice(1).map((cells)=>{
    const raw=Object.fromEntries(headers.map((header,index)=>[header,(cells[index]||"").trim()]));
    return {
      fabricId:raw.fabricId||"",
      availability:raw.availability||undefined,
      weightGsm:numberOrUndefined(raw.weightGsm||""),
      weightClass:raw.weightClass||undefined,
      weave:raw.weave||undefined,
      texture:raw.texture||undefined,
      drape:raw.drape||undefined,
      seasonTags:raw.seasonTags?splitList(raw.seasonTags):undefined,
      formalityScore:numberOrUndefined(raw.formalityScore||""),
      roleTags:raw.roleTags?splitList(raw.roleTags):undefined,
      physicalSourceType:raw.physicalSourceType||undefined,
      physicalReference:raw.physicalReference||undefined,
      physicalCheckedBy:raw.physicalCheckedBy||undefined,
      physicalEvidenceDate:raw.physicalEvidenceDate||undefined,
      physicalSourceUrl:raw.physicalSourceUrl||undefined,
      note:raw.note||undefined,
    };
  }).filter((row)=>row.fabricId);
}

export default function DesignerDataBatchPanel({
  fabrics,
  configured,
  onComplete,
}:{
  fabrics:FabricRow[];
  configured:boolean;
  onComplete?:()=>void|Promise<void>;
}){
  const [open,setOpen]=useState(false);
  const [csvText,setCsvText]=useState("");
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState({done:0,total:0,failed:0});
  const [message,setMessage]=useState("");
  const fileRef=useRef<HTMLInputElement|null>(null);
  const parsed=useMemo(()=>importedRows(csvText),[csvText]);
  const knownIds=useMemo(()=>new Set(fabrics.map((fabric)=>fabric.id)),[fabrics]);
  const validRows=parsed.filter((row)=>knownIds.has(row.fabricId));
  const unknownRows=parsed.length-validRows.length;

  function downloadTemplate(){
    const rows=[HEADERS.join(",")];
    const ordered=[...fabrics].sort((a,b)=>b.evidence.priority-a.evidence.priority || a.colorName.localeCompare(b.colorName));
    for(const fabric of ordered){
      const value=fabric.metadata||({fabricId:fabric.id,availability:"unknown"} as DesignerFabricMetadata);
      const row:Record<string,unknown>={
        fabricId:fabric.id,
        availability:value.availability||"unknown",
        weightGsm:value.weightGsm??"",
        weightClass:value.weightClass||"",
        weave:value.weave||"",
        texture:value.texture||"",
        drape:value.drape||"",
        seasonTags:(value.seasonTags||[]).join(" | "),
        formalityScore:value.formalityScore??"",
        roleTags:(value.roleTags||[]).join(" | "),
        physicalSourceType:value.physicalEvidence?.sourceType||"",
        physicalReference:value.physicalEvidence?.reference||"",
        physicalCheckedBy:value.physicalEvidence?.checkedBy||"",
        physicalEvidenceDate:value.physicalEvidence?.evidenceDate||"",
        physicalSourceUrl:value.physicalEvidence?.sourceUrl||"",
        note:value.note||`Evidence gaps: ${fabric.evidence.gaps.join(" | ")}`,
      };
      rows.push(HEADERS.map((header)=>csvCell(row[header])).join(","));
    }
    const blob=new Blob([rows.join("\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=url;
    anchor.download="linen-earth-designer-data.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage(`Worksheet created for ${ordered.length} catalogue fabrics. Existing verified values are preserved in the file.`);
  }

  async function loadFile(file:File|null){
    if(!file) return;
    setCsvText(await file.text());
    setMessage(`Loaded ${file.name}. ${validRows.length||""}`);
  }

  async function applyRows(){
    if(running||!configured||!validRows.length) return;
    setRunning(true);
    setMessage("");
    setProgress({done:0,total:validRows.length,failed:0});
    let failed=0;
    try{
      const currentById=new Map(fabrics.map((fabric)=>[fabric.id,fabric.metadata]));
      for(let index=0;index<validRows.length;index++){
        const row=validRows[index];
        const current=currentById.get(row.fabricId)||({fabricId:row.fabricId,availability:"unknown"} as DesignerFabricMetadata);
        const incomingPhysicalEvidence=
          row.physicalSourceType&&row.physicalReference&&row.physicalCheckedBy
            ? {
                sourceType:row.physicalSourceType,
                reference:row.physicalReference,
                checkedBy:row.physicalCheckedBy,
                ...(row.physicalEvidenceDate?{evidenceDate:row.physicalEvidenceDate}:{}),
                ...(row.physicalSourceUrl?{sourceUrl:row.physicalSourceUrl}:{}),
              }
            : undefined;
        const merged={
          subtype:"designer_fabric_metadata",
          fabricId:row.fabricId,
          availability:["available","unavailable","unknown"].includes(String(row.availability))
            ? row.availability
            : current.availability||"unknown",
          weightGsm:row.weightGsm??current.weightGsm,
          weightClass:row.weightClass||current.weightClass,
          weave:row.weave??current.weave??"",
          texture:row.texture??current.texture??"",
          drape:row.drape||current.drape,
          seasonTags:row.seasonTags??current.seasonTags??[],
          formalityScore:row.formalityScore??current.formalityScore,
          roleTags:row.roleTags??current.roleTags??[],
          physicalEvidence:incomingPhysicalEvidence??current.physicalEvidence,
          note:row.note??current.note??"",
        };
        const response=await fetch("/api/memory/event",{
          method:"POST",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({
            id:`EV-DESIGNER-DATA-BULK-${crypto.randomUUID()}`,
            sessionId:"DESIGNER-DATA",
            type:"operator_note",
            at:new Date().toISOString(),
            payload:merged,
          }),
        });
        const result=await response.json() as {stored?:boolean;error?:string};
        if(!response.ok||!result.stored) failed+=1;
        setProgress({done:index+1,total:validRows.length,failed});
      }
      setMessage(`Bulk metadata complete: ${validRows.length-failed} saved, ${failed} failed. Blank CSV cells did not erase existing verified values.`);
      await onComplete?.();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Bulk metadata import failed.");
    }finally{
      setRunning(false);
    }
  }

  return <section className="dataBatch" data-open={open}>
    <button className="dataBatchToggle" type="button" onClick={()=>setOpen((value)=>!value)} aria-expanded={open}>
      <span>BULK VERIFIED DATA</span><b>{open?"Close":"CSV worksheet + import"}</b>
    </button>
    {open&&<div className="dataBatchBody">
      <div className="dataBatchGuardrail"><strong>MERGE, DON’T WIPE</strong><p>Blank CSV cells keep the current verified value. Only supplied values are merged into the latest fabric record. GSM/drape rows can now carry their physical source, reference and checker; pattern millimetres and fibre evidence still belong in Fabric Analyzer.</p></div>
      <div className="dataBatchActions">
        <button type="button" onClick={downloadTemplate}>Download current worksheet</button>
        <button type="button" onClick={()=>fileRef.current?.click()}>Load edited CSV</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(event)=>void loadFile(event.target.files?.[0]||null)} />
      </div>
      <textarea value={csvText} onChange={(event)=>setCsvText(event.target.value)} rows={8} placeholder={HEADERS.join(",")} spellCheck={false}/>
      <div className="dataBatchStats">
        <span><small>PARSED</small><b>{parsed.length}</b></span>
        <span><small>KNOWN FABRICS</small><b>{validRows.length}</b></span>
        <span><small>UNKNOWN IDS</small><b>{unknownRows}</b></span>
        <span><small>FAILED</small><b>{progress.failed}</b></span>
      </div>
      {running&&<div className="dataBatchProgress"><i style={{width:`${progress.total?Math.round(progress.done/progress.total*100):0}%`}}/><span>{progress.done}/{progress.total}</span></div>}
      <button className="dataBatchApply" type="button" disabled={running||!configured||!validRows.length} onClick={()=>void applyRows()}>{running?"Saving verified rows…":`Merge ${validRows.length} verified rows`}</button>
      {message&&<button className="dataBatchMessage" type="button" onClick={()=>setMessage("")}>{message}<b>×</b></button>}
    </div>}
  </section>;
}
