"use client";

import { useEffect, useMemo, useState } from "react";

type StatusCase={
  id:string;
  sourceId:string;
  sourceUrl:string;
  notes:string;
  lastScore:number|null;
  lastRunAt:string|null;
  lastResult:Record<string,unknown>;
};

type StatusPayload={
  totalCases:number;
  scoredCases:number;
  averageScore:number|null;
  cases:StatusCase[];
};

type RunResult={
  caseId:string;
  sourceId:string;
  score:number;
  cached:boolean;
  checks:Array<{name:string;pass:boolean;weight:number;detail:string}>;
};

type RunPayload={
  requested:number;
  completed:number;
  averageScore:number;
  results:RunResult[];
};

export default function FabricAnalyzerCalibrationPanel(){
  const [status,setStatus]=useState<StatusPayload|null>(null);
  const [run,setRun]=useState<RunPayload|null>(null);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    const response=await fetch("/api/operator/fabric-analyzer/calibration-status",{cache:"no-store"});
    if(response.status===401){
      window.location.href="/operator/login?next=/operator/fabric-analyzer";
      return;
    }
    const data=await response.json() as StatusPayload & {error?:string};
    if(!response.ok) throw new Error(data.error||"Calibration status could not be loaded.");
    setStatus(data);
  }

  useEffect(()=>{
    void load().catch((error)=>setMessage(error instanceof Error?error.message:"Calibration status could not be loaded."));
  },[]);

  async function calibrate(){
    if(loading) return;
    setLoading(true);setMessage("");setRun(null);
    try{
      const response=await fetch("/api/operator/fabric-analyzer/calibrate",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({limit:4}),
      });
      if(response.status===401){
        window.location.href="/operator/login?next=/operator/fabric-analyzer";
        return;
      }
      const data=await response.json() as RunPayload & {error?:string};
      if(!response.ok) throw new Error(data.error||"Calibration run failed.");
      setRun(data);
      setMessage(`Calibration completed: ${data.completed}/${data.requested} cases, average ${data.averageScore}%.`);
      await load();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Calibration run failed.");
    }finally{
      setLoading(false);
    }
  }

  const latestAverage=run?.averageScore ?? status?.averageScore ?? null;
  const recent=useMemo(()=>[...(status?.cases||[])].sort((a,b)=>{
    const ta=a.lastRunAt?new Date(a.lastRunAt).getTime():0;
    const tb=b.lastRunAt?new Date(b.lastRunAt).getTime():0;
    return tb-ta;
  }),[status]);

  return <section className="analyzerPanel analyzerCalibration">
    <div className="panelTitle">
      <span>05 / REFERENCE CALIBRATION</span>
      <h2>Test against known external cases.</h2>
      <button type="button" onClick={()=>void calibrate()} disabled={loading}>{loading?"Running 4 cases…":"Run next 4 cases"}</button>
    </div>
    <div className="calibrationGuardrail"><strong>REFERENCE CHECK, NOT OVERALL ACCURACY</strong><p>This score tests known external cases against expected material/pattern/colour/use/formality signals. It does not replace owner-labelled real-fabric ground truth.</p></div>
    <div className="calibrationStats">
      <span><small>CASES</small><b>{status?.totalCases ?? "—"}</b></span>
      <span><small>SCORED</small><b>{status?.scoredCases ?? "—"}</b></span>
      <span><small>AVERAGE</small><b>{latestAverage==null?"—":`${latestAverage}%`}</b></span>
      <span><small>LAST RUN</small><b>{recent[0]?.lastRunAt?new Date(recent[0].lastRunAt).toLocaleString("en-IN"):"Never"}</b></span>
    </div>
    {run&&<div className="calibrationRun">
      {run.results.map((item)=><article key={item.caseId}>
        <div><span>{item.caseId}</span><strong>{item.score}%</strong><small>{item.cached?"cached profile":"fresh analysis"}</small></div>
        <div>{item.checks.map((check)=><p key={check.name} data-pass={check.pass}><b>{check.pass?"✓":"!"} {check.name}</b><span>{check.detail}</span></p>)}</div>
      </article>)}
    </div>}
    {!run&&<div className="calibrationHistory">
      {recent.slice(0,6).map((item)=><article key={item.id}>
        <div><span>{item.id}</span><strong>{item.lastScore==null?"Not run":`${item.lastScore}%`}</strong></div>
        <small>{item.lastRunAt?new Date(item.lastRunAt).toLocaleString("en-IN"):"Waiting for first calibration"}</small>
      </article>)}
    </div>}
    {message&&<button className="batchMessage" type="button" onClick={()=>setMessage("")}>{message}<b>×</b></button>}
  </section>;
}
