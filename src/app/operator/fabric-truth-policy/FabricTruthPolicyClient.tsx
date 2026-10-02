"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { evaluateFabricTruthPolicy, type FabricTruthPolicy } from "@/lib/designer/fabric-truth-policy";

type DesignerData={
  coverage:{
    activeCandidates:number;
    physicalScale:number;
    gsm:number;
    drape:number;
    fiber:number;
  };
};

type PolicyPayload={
  configured:boolean;
  policy:FabricTruthPolicy|null;
  recordedAt?:string;
  error?:string;
};

type FieldKey="physicalScalePercent"|"gsmPercent"|"drapePercent"|"fiberPercent";

const FIELDS:Array<{key:FieldKey;coverage:"physicalScale"|"gsm"|"drape"|"fiber";label:string;detail:string}>=[
  {key:"physicalScalePercent",coverage:"physicalScale",label:"Physical scale",detail:"Pattern repeat / scale evidence. Solid fabrics count as not needing a repeat measurement."},
  {key:"gsmPercent",coverage:"gsm",label:"GSM",detail:"Physical weight evidence from owner or supplier provenance."},
  {key:"drapePercent",coverage:"drape",label:"Drape",detail:"Reviewed physical drape evidence, not image-only inference."},
  {key:"fiberPercent",coverage:"fiber",label:"Fibre",detail:"Reviewed fibre-content evidence with auditable provenance."},
];

export default function FabricTruthPolicyClient(){
  const [designerData,setDesignerData]=useState<DesignerData|null>(null);
  const [policy,setPolicy]=useState<FabricTruthPolicy|null>(null);
  const [recordedAt,setRecordedAt]=useState("");
  const [status,setStatus]=useState<"approved"|"review">("review");
  const [signedBy,setSignedBy]=useState("");
  const [note,setNote]=useState("");
  const [values,setValues]=useState<Record<FieldKey,string>>({
    physicalScalePercent:"",gsmPercent:"",drapePercent:"",fiberPercent:"",
  });
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  function hydrate(next:FabricTruthPolicy|null){
    setPolicy(next);
    if(!next) return;
    setStatus(next.status);
    setSignedBy(next.signedBy);
    setNote(next.note);
    setValues({
      physicalScalePercent:String(next.physicalScalePercent),
      gsmPercent:String(next.gsmPercent),
      drapePercent:String(next.drapePercent),
      fiberPercent:String(next.fiberPercent),
    });
  }

  async function load(){
    setLoading(true);setMessage("");
    try{
      const [policyResponse,dataResponse]=await Promise.all([
        fetch("/api/operator/fabric-truth-policy",{cache:"no-store"}),
        fetch("/api/operator/designer-data",{cache:"no-store"}),
      ]);
      if(policyResponse.status===401||dataResponse.status===401){
        window.location.href="/operator/login?next=/operator/fabric-truth-policy";
        return;
      }
      const policyBody=await policyResponse.json() as PolicyPayload;
      const dataBody=await dataResponse.json() as DesignerData&{error?:string};
      if(!policyResponse.ok) throw new Error(policyBody.error||"Fabric Truth policy could not be loaded.");
      if(!dataResponse.ok) throw new Error(dataBody.error||"Fabric evidence coverage could not be loaded.");
      hydrate(policyBody.policy);
      setRecordedAt(policyBody.recordedAt||"");
      setDesignerData(dataBody);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Fabric Truth policy could not be loaded.");
    }finally{setLoading(false);}
  }

  useEffect(()=>{void load();},[]);

  const draftPolicy=useMemo<FabricTruthPolicy|null>(()=>{
    const parsed=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,Number(value)])) as Record<FieldKey,number>;
    if(Object.values(parsed).some((value)=>!Number.isFinite(value)||value<1||value>100)||signedBy.trim().length<2||note.trim().length<8) return null;
    return {
      version:"fabric-truth-policy-v1",
      status,
      signedBy:signedBy.trim(),
      note:note.trim(),
      physicalScalePercent:Math.round(parsed.physicalScalePercent),
      gsmPercent:Math.round(parsed.gsmPercent),
      drapePercent:Math.round(parsed.drapePercent),
      fiberPercent:Math.round(parsed.fiberPercent),
    };
  },[values,status,signedBy,note]);

  const evaluation=useMemo(
    ()=>evaluateFabricTruthPolicy(draftPolicy||policy,designerData?.coverage),
    [draftPolicy,policy,designerData],
  );

  async function save(){
    if(!draftPolicy||saving) return;
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/operator/fabric-truth-policy",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify(draftPolicy),
      });
      const result=await response.json() as PolicyPayload;
      if(!response.ok||!result.policy) throw new Error(result.error||"Fabric Truth policy could not be saved.");
      hydrate(result.policy);
      setRecordedAt(result.recordedAt||new Date().toISOString());
      setMessage(result.policy.status==="approved"?"Approved Fabric Truth policy saved.":"Review-state Fabric Truth policy saved.");
    }catch(error){
      setMessage(error instanceof Error?error.message:"Fabric Truth policy could not be saved.");
    }finally{setSaving(false);}
  }

  return <main className="fabricPolicy">
    <header className="fabricPolicyHero">
      <div>
        <span>LINEN EARTH / PHASE 2 / PRIVATE OPERATOR</span>
        <h1>Fabric Truth Evidence Policy</h1>
        <p>Set the physical-evidence coverage Linen Earth requires before Phase 2 can be called complete. The software does not choose these thresholds for you.</p>
      </div>
      <nav><Link href="/operator/roadmap-readiness">Roadmap Readiness</Link><Link href="/operator/fabric-ground-truth">Ground Truth</Link><Link href="/operator">Operator Desk</Link></nav>
    </header>

    {loading?<div className="fabricPolicyLoading">Loading current evidence and policy…</div>:<>
      <section className="fabricPolicyCurrent">
        <article><small>ACTIVE FABRICS</small><strong>{designerData?.coverage.activeCandidates??0}</strong><span>Current active catalogue candidates</span></article>
        <article data-pass={policy?.status==="approved"}><small>POLICY STATUS</small><strong>{policy?.status?.toUpperCase()||"NOT SET"}</strong><span>{recordedAt?("Recorded "+new Date(recordedAt).toLocaleString()):"No human threshold decision recorded"}</span></article>
        <article data-pass={evaluation.gateComplete}><small>PHYSICAL GATE</small><strong>{evaluation.gateComplete?"PASS":"OPEN"}</strong><span>{evaluation.completedFields}/{evaluation.totalFields} evidence fields at threshold</span></article>
      </section>

      <section className="fabricPolicyGrid">
        <div className="fabricPolicyForm">
          <div className="fabricPolicyFormHead"><span>OWNER / SUPPLIER DECISION</span><h2>Required coverage</h2><p>Enter a percentage for every physical field. 100% means every current active fabric must have that evidence; lower percentages are allowed only if that is your documented operating policy.</p></div>
          {FIELDS.map((field)=>{
            const row=evaluation.detail[field.coverage];
            const current=designerData?.coverage[field.coverage]??0;
            const active=designerData?.coverage.activeCandidates??0;
            return <label key={field.key}>
              <div><strong>{field.label}</strong><small>{field.detail}</small></div>
              <div className="fabricPolicyInput"><input type="number" min={1} max={100} inputMode="numeric" value={values[field.key]} onChange={(event)=>setValues({...values,[field.key]:event.target.value})} placeholder="%" /><b>%</b></div>
              <p data-pass={row.pass}>{current}/{active} current · {row.requiredCount===null?"set a threshold":(row.requiredCount+" required")}</p>
            </label>;
          })}
          <label className="fabricPolicyDecision"><span>Decision</span><select value={status} onChange={(event)=>setStatus(event.target.value as "approved"|"review")}><option value="review">Review — not a completion gate</option><option value="approved">Approved — use for Phase 2 gate</option></select></label>
          <label className="fabricPolicyDecision"><span>Owner / supplier reviewer</span><input value={signedBy} onChange={(event)=>setSignedBy(event.target.value.slice(0,120))} placeholder="Name or initials" /></label>
          <label className="fabricPolicyDecision"><span>Rationale / evidence policy</span><textarea rows={4} value={note} onChange={(event)=>setNote(event.target.value.slice(0,1200))} placeholder="Which supplier documents, physical roll checks or owner measurements qualify, and why this coverage level is acceptable." /></label>
          <button type="button" onClick={()=>void save()} disabled={!draftPolicy||saving}>{saving?"Saving…":status==="approved"?"Save approved policy":"Save review policy"}</button>
          {message&&<p className="fabricPolicyMessage">{message}</p>}
        </div>

        <aside className="fabricPolicyEvidence">
          <span>LIVE PHYSICAL COVERAGE</span>
          <h2>{evaluation.progressPercent}%</h2>
          <p>This is evidence coverage against the thresholds currently entered above. It does not create or infer any physical facts.</p>
          {FIELDS.map((field)=>{
            const row=evaluation.detail[field.coverage];
            return <article key={field.key} data-pass={row.pass}>
              <div><strong>{field.label}</strong><b>{row.pass?"PASS":"OPEN"}</b></div>
              <div className="fabricPolicyBar"><i style={{width:String(Math.min(100,row.percent))+"%"}}/></div>
              <small>{row.currentCount} verified · {row.percent}% of active catalogue{row.thresholdPercent!==null?(" · threshold "+row.thresholdPercent+"%"):""}</small>
            </article>;
          })}
          <div className="fabricPolicyRule"><strong>Phase 2 still also requires</strong><p>50 reviewed stock fabrics and the physical colour-check gate. This policy only resolves the previously undefined GSM / fibre / drape / scale coverage requirement.</p></div>
        </aside>
      </section>
    </>}
  </main>;
}
