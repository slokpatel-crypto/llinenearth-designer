"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  PREVIEW_PERFORMANCE_TARGET_MS,
  readPreviewPerformanceSamples,
  readPreviewPerformanceSummary,
  type PreviewPerformanceSummary,
} from "@/lib/designer/preview-performance-client";
import { DEVICE_QA_EVIDENCE_VERSION } from "@/lib/designer/device-qa-evidence";

type DeviceClass="mobile"|"tablet"|"desktop";
type CheckKey="fourViews"|"controlsLegible"|"noOverflow"|"fabricReadable"|"modelStable";

type HistoryPayload={
  configured:boolean;
  latest:Record<string,{
    at:string;
    status:string;
    viewport:string;
    p95Ms:number|null;
    samples:number;
    note:string;
    evidenceVersion:string;
    performancePass:boolean;
    visualPass:boolean;
  }>;
};

const CHECKS:Array<{key:CheckKey;label:string;detail:string}>=[
  {key:"fourViews",label:"Four views render correctly",detail:"Front, 3/4, side and back stay inside the preview stage."},
  {key:"controlsLegible",label:"Controls remain legible",detail:"Cut controls, fabric names and buttons are readable without accidental overlap."},
  {key:"noOverflow",label:"No horizontal overflow",detail:"The Designer does not force the page wider than the device viewport."},
  {key:"fabricReadable",label:"Fabric texture remains readable",detail:"Selected cloth is visibly identifiable at normal viewing scale."},
  {key:"modelStable",label:"Model stays visually stable",detail:"Changing options does not jump, crop or visibly break the mannequin."},
];

function classify(width:number):DeviceClass{
  return width<=720?"mobile":width<=1100?"tablet":"desktop";
}

export default function DeviceQaClient(){
  const [summary,setSummary]=useState<PreviewPerformanceSummary>(()=>readPreviewPerformanceSummary());
  const [history,setHistory]=useState<HistoryPayload|null>(null);
  const [checks,setChecks]=useState<Record<CheckKey,boolean>>({
    fourViews:false,controlsLegible:false,noOverflow:false,fabricReadable:false,modelStable:false,
  });
  const [note,setNote]=useState("");
  const [message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);
  const [viewport,setViewport]=useState({width:0,height:0,dpr:1});

  async function loadHistory(){
    const response=await fetch("/api/operator/device-qa",{cache:"no-store"});
    if(response.status===401){window.location.href="/operator/login?next=/operator/device-qa";return;}
    const data=await response.json() as HistoryPayload;
    if(response.ok) setHistory(data);
  }

  useEffect(()=>{
    const update=()=>{
      setViewport({width:window.innerWidth,height:window.innerHeight,dpr:window.devicePixelRatio||1});
      setSummary(readPreviewPerformanceSummary());
    };
    update();
    void loadHistory();
    window.addEventListener("resize",update);
    window.addEventListener("focus",update);
    return()=>{window.removeEventListener("resize",update);window.removeEventListener("focus",update);};
  },[]);

  const deviceClass=classify(viewport.width||1024);
  const allChecks=CHECKS.every((item)=>checks[item.key]);
  const performanceReady=summary.samples>=12 && summary.p95Ms!==null;
  const accepted=Boolean(performanceReady && summary.withinTarget===true && allChecks);
  const previous=history?.latest?.[deviceClass]||null;
  const coverage=useMemo(()=>["mobile","tablet","desktop"].map((kind)=>({
    kind,
    accepted:history?.latest?.[kind]?.status==="accepted",
    row:history?.latest?.[kind]||null,
  })),[history]);

  async function record(){
    if(saving || !history?.configured) return;
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/memory/event",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          id:`EV-DEVICE-${crypto.randomUUID()}`,
          sessionId:"DESIGNER-DEVICE-QA",
          type:"operator_note",
          at:new Date().toISOString(),
          payload:{
            subtype:"designer_device_qa",
            version:DEVICE_QA_EVIDENCE_VERSION,
            deviceClass,
            status:accepted?"accepted":"review",
            viewport:`${viewport.width}x${viewport.height}`,
            dpr:viewport.dpr,
            samples:summary.samples,
            sampleDurationsMs:readPreviewPerformanceSamples().map((item)=>item.durationMs),
            medianMs:summary.medianMs,
            p95Ms:summary.p95Ms,
            maxMs:summary.maxMs,
            withinTarget:summary.withinTarget===true,
            hardwareConcurrency:navigator.hardwareConcurrency||0,
            userAgent:navigator.userAgent,
            checks,
            note,
          },
        }),
      });
      const result=await response.json() as {stored?:boolean;error?:string};
      if(!response.ok || !result.stored) throw new Error(result.error||"Device QA evidence was not stored.");
      setMessage(accepted?"Device acceptance recorded.":"Device review recorded with remaining issues.");
      await loadHistory();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Device QA evidence could not be stored.");
    }finally{setSaving(false);}
  }

  return <main className="deviceQa">
    <header className="deviceQaHeader">
      <div><span>LINEN EARTH / PRIVATE OPERATOR</span><h1>Designer Device QA</h1><p>Record real browser/device acceptance separately from the Node performance benchmark. This page never invents a device pass: it requires observed interaction samples and manual visual checks.</p></div>
      <nav><Link href="/designer-studio">Open Designer Studio</Link><Link href="/operator/launch-readiness">Launch Evidence</Link><Link href="/operator/designer-evaluation">Designer Evaluation</Link><Link href="/operator">Operator Desk</Link></nav>
    </header>

    <section className="deviceQaCoverage">
      {coverage.map((item)=><article key={item.kind} data-accepted={item.accepted}>
        <small>{item.kind.toUpperCase()}</small>
        <strong>{item.row?.status==="accepted"?"ACCEPTED":item.row?"REVIEW":"NOT TESTED"}</strong>
        <span>{item.row
          ? `${item.row.viewport} · p95 ${item.row.p95Ms ?? "—"} ms · ${item.row.samples} samples${item.row.evidenceVersion===DEVICE_QA_EVIDENCE_VERSION?"":" · legacy evidence"}`
          : "No recorded target-device session."}</span>
      </article>)}
    </section>

    <section className="deviceQaLayout">
      <article className="deviceQaPanel">
        <div className="deviceQaPanelHead"><span>01 / CURRENT DEVICE</span><strong>{deviceClass}</strong></div>
        <div className="deviceFacts">
          <span><small>VIEWPORT</small><b>{viewport.width} × {viewport.height}</b></span>
          <span><small>PIXEL RATIO</small><b>{viewport.dpr.toFixed(2)}</b></span>
          <span><small>CPU THREADS</small><b>{typeof navigator!=="undefined" ? navigator.hardwareConcurrency||"—" : "—"}</b></span>
          <span><small>TARGET</small><b>p95 &lt; {PREVIEW_PERFORMANCE_TARGET_MS} ms</b></span>
        </div>
        <p className="deviceQaInstruction">Use <b>Open Designer Studio</b> in this same tab. Switch fabrics/cuts/body/view at least 12 times, inspect all four views, then return here. Session samples survive same-tab navigation.</p>
        <button className="deviceRefresh" type="button" onClick={()=>setSummary(readPreviewPerformanceSummary())}>Refresh local measurements</button>
      </article>

      <article className="deviceQaPanel">
        <div className="deviceQaPanelHead"><span>02 / OBSERVED LATENCY</span><strong>{performanceReady?(summary.withinTarget?"PASS":"REVIEW"):"NEEDS SAMPLES"}</strong></div>
        <div className="deviceMetrics">
          <span><small>SAMPLES</small><b>{summary.samples}</b></span>
          <span><small>MEDIAN</small><b>{summary.medianMs ?? "—"} ms</b></span>
          <span><small>P95</small><b>{summary.p95Ms ?? "—"} ms</b></span>
          <span><small>MAX</small><b>{summary.maxMs ?? "—"} ms</b></span>
        </div>
        <p>{performanceReady?summary.withinTarget?"Observed browser interaction is within the current 100 ms p95 target.":"Observed p95 exceeds the current interaction target; record as review and investigate on this device.":`Collect at least ${Math.max(0,12-summary.samples)} more option/view/body interactions before device acceptance.`}</p>
      </article>
    </section>

    <section className="deviceQaChecks">
      <div className="deviceQaChecksHead"><span>03 / VISUAL ACCEPTANCE</span><strong>{Object.values(checks).filter(Boolean).length}/{CHECKS.length} checked</strong></div>
      {CHECKS.map((item)=><label key={item.key} data-checked={checks[item.key]}>
        <input type="checkbox" checked={checks[item.key]} onChange={(event)=>setChecks((current)=>({...current,[item.key]:event.target.checked}))}/>
        <span><b>{item.label}</b><small>{item.detail}</small></span>
      </label>)}
    </section>

    <section className="deviceQaDecision" data-status={accepted?"accepted":"review"}>
      <div><span>04 / RECORD</span><strong>{accepted?"READY TO RECORD ACCEPTED":"RECORD AS REVIEW"}</strong><p>{accepted?"Both measured latency and all manual visual checks pass for this exact browser/device session.":"One or more required checks or measurements are still incomplete/failing. Saving now records review status, not acceptance."}</p>{previous&&<small>Previous {deviceClass} record: {previous.status} · {new Date(previous.at).toLocaleString("en-IN")}{previous.evidenceVersion!==DEVICE_QA_EVIDENCE_VERSION?" · legacy evidence must be re-run":""}</small>}</div>
      <label>Operator note<textarea value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Device model / browser or any visible issue to revisit…" /></label>
      <button type="button" onClick={()=>void record()} disabled={saving||!history?.configured}>{saving?"Saving…":accepted?"Record accepted device":"Record review evidence"}</button>
      {!history?.configured&&<small>Cloud memory must be configured before target-device acceptance can be retained.</small>}
    </section>

    {message&&<button className="deviceQaToast" onClick={()=>setMessage("")}>{message}<b>×</b></button>}
  </main>;
}
